"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { submitOutboundEmail } from "@/lib/communications/email-delivery-server";
import {
  classifyEmailDeliveryError
} from "@/lib/communications/email-delivery-errors";
import {
  archiveThread,
  createGmailLabel,
  createGmailDraft,
  getGmailThread,
  GmailMailboxError,
  markThreadRead,
  markThreadUnread,
  starThread,
  trashGmailDraft,
  trashThread,
  unstarThread,
  untrashThread,
  updateGmailDraft
} from "@/lib/communications/gmail-mailbox-server";
import { sanitizeGmailHtml } from "@/lib/communications/gmail-message";
import { randomToken } from "@/lib/communications/security";
import { zonedDateTimeLocalToUtc } from "@/lib/communications/scheduling";

type ThreadOperation =
  | "archive"
  | "read"
  | "star"
  | "trash"
  | "unread"
  | "unstar"
  | "untrash";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function safeReturnPath(value: string) {
  return value.startsWith("/admin/email") && !value.startsWith("//")
    ? value
    : "/admin/email/inbox";
}

function htmlFromText(value: string) {
  return value
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p>${paragraph
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}

function safeBodyHtml(formData: FormData, bodyText: string) {
  const supplied = String(formData.get("body_html") ?? "");
  if (!supplied.trim()) return htmlFromText(bodyText);
  const sanitized = sanitizeGmailHtml(supplied).html.trim();
  return sanitized || htmlFromText(bodyText);
}

function composerMode(formData: FormData) {
  const value = textValue(formData, "composer_mode");
  return value === "reply" || value === "reply-all" || value === "forward"
    ? value
    : "compose";
}

async function gmailReplyContext(
  profileId: string,
  formData: FormData
) {
  const mode = composerMode(formData);
  const threadId = textValue(formData, "thread_id");
  if (!threadId || (mode !== "reply" && mode !== "reply-all")) return {};

  const thread = await getGmailThread(profileId, threadId);
  const latest = thread.messages.at(-1);
  if (!latest) throw new GmailMailboxError("not_found");

  return {
    inReplyTo: latest.messageId || undefined,
    references:
      [latest.references, latest.messageId].filter(Boolean).join(" ") || undefined,
    threadId
  };
}

function mailboxFailurePath(path: string, error: unknown) {
  const code =
    error instanceof GmailMailboxError
      ? error.code
      : classifyEmailDeliveryError(error).code;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}error=${encodeURIComponent(code)}`;
}

export async function gmailThreadAction(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const operation = textValue(formData, "operation") as ThreadOperation;
  const threadId = textValue(formData, "thread_id");
  const returnTo = safeReturnPath(textValue(formData, "return_to"));

  try {
    if (operation === "read") await markThreadRead(profile.id, threadId);
    else if (operation === "unread") await markThreadUnread(profile.id, threadId);
    else if (operation === "star") await starThread(profile.id, threadId);
    else if (operation === "unstar") await unstarThread(profile.id, threadId);
    else if (operation === "archive") await archiveThread(profile.id, threadId);
    else if (operation === "trash") await trashThread(profile.id, threadId);
    else if (operation === "untrash") await untrashThread(profile.id, threadId);
    else throw new Error("Invalid mailbox operation");
  } catch (error) {
    redirect(mailboxFailurePath(returnTo, error));
  }

  revalidatePath("/admin/email");
  redirect(returnTo);
}

export async function markOpenedThreadReadAction(threadId: string) {
  const profile = await requireRole(["admin"]);
  await markThreadRead(profile.id, threadId);
  revalidatePath("/admin/email");
}

export async function createGmailLabelAction(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const name = textValue(formData, "label_name");
  let label: Awaited<ReturnType<typeof createGmailLabel>>;
  try {
    label = await createGmailLabel(profile.id, name);
  } catch (error) {
    redirect(mailboxFailurePath("/admin/email/inbox", error));
  }
  revalidatePath("/admin/email");
  redirect(`/admin/email/label/${encodeURIComponent(label.id)}?notice=label-created`);
}

export async function saveGmailDraftAction(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const bodyText = textValue(formData, "body_text");
  const bodyHtml = safeBodyHtml(formData, bodyText);
  const draftId = textValue(formData, "draft_id");
  const returnTo = safeReturnPath(
    textValue(formData, "return_to") || "/admin/email/drafts"
  );
  const subject = textValue(formData, "subject");
  const to = textValue(formData, "recipient_email");

  if (!to || !subject || !bodyText) {
    redirect(`${returnTo}?error=missing-fields`);
  }

  let result: Awaited<ReturnType<typeof createGmailDraft>>;
  try {
    const replyContext = await gmailReplyContext(profile.id, formData);
    const message = {
      bcc: textValue(formData, "bcc") || undefined,
      bodyHtml,
      bodyText,
      cc: textValue(formData, "cc") || undefined,
      ...replyContext,
      subject,
      to
    };
    result = draftId
      ? await updateGmailDraft(profile.id, draftId, message)
      : await createGmailDraft(profile.id, message);
  } catch (error) {
    redirect(mailboxFailurePath(returnTo, error));
  }
  revalidatePath("/admin/email");
  redirect(`/admin/email/draft/${result.id}?notice=draft-saved`);
}

export async function trashGmailDraftAction(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const draftId = textValue(formData, "draft_id");
  try {
    await trashGmailDraft(profile.id, draftId);
  } catch (error) {
    redirect(mailboxFailurePath("/admin/email/drafts", error));
  }
  revalidatePath("/admin/email");
  redirect("/admin/email/drafts?notice=draft-trashed");
}

export async function sendWebmailMessageAction(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const bodyText = textValue(formData, "body_text");
  const bodyHtml = safeBodyHtml(formData, bodyText);
  const recipientEmail = textValue(formData, "recipient_email").toLowerCase();
  const returnTo = safeReturnPath(
    textValue(formData, "return_to") || "/admin/email/compose"
  );

  let result: Awaited<ReturnType<typeof submitOutboundEmail>>;
  try {
    const replyContext = await gmailReplyContext(profile.id, formData);
    result = await submitOutboundEmail({
      bcc: textValue(formData, "bcc") || null,
      bodyHtml,
      bodyText,
      cc: textValue(formData, "cc") || null,
      createdBy: profile.id,
      gmailDraftId: textValue(formData, "draft_id") || null,
      idempotencyKey: textValue(formData, "idempotency_key") || randomToken(24),
      ...replyContext,
      mode: "send_now",
      recipientEmail,
      recipientName: textValue(formData, "recipient_name") || null,
      subject: textValue(formData, "subject")
    });
  } catch (error) {
    const classified = classifyEmailDeliveryError(error);
    redirect(`${returnTo}?error=${encodeURIComponent(classified.code)}`);
  }
  revalidatePath("/admin/email");
  redirect(`/admin/email/sent?notice=sent&id=${encodeURIComponent(result.id)}`);
}

export async function scheduleWebmailMessageAction(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const bodyText = textValue(formData, "body_text");
  const bodyHtml = safeBodyHtml(formData, bodyText);
  const returnTo = safeReturnPath(
    textValue(formData, "return_to") || "/admin/email/compose"
  );
  const scheduledAt = textValue(formData, "scheduled_at");
  const scheduledDate = scheduledAt
    ? zonedDateTimeLocalToUtc(scheduledAt, "America/Sao_Paulo")
    : null;

  if (!scheduledDate || scheduledDate.getTime() <= Date.now()) {
    redirect(`${returnTo}?error=invalid-schedule`);
  }

  try {
    const replyContext = await gmailReplyContext(profile.id, formData);
    await submitOutboundEmail({
      bcc: textValue(formData, "bcc") || null,
      bodyHtml,
      bodyText,
      cc: textValue(formData, "cc") || null,
      createdBy: profile.id,
      gmailDraftId: textValue(formData, "draft_id") || null,
      idempotencyKey: textValue(formData, "idempotency_key") || randomToken(24),
      ...replyContext,
      mode: "scheduled",
      recipientEmail: textValue(formData, "recipient_email").toLowerCase(),
      recipientName: textValue(formData, "recipient_name") || null,
      scheduledAt: scheduledDate.toISOString(),
      scheduledTimezone: "America/Sao_Paulo",
      subject: textValue(formData, "subject")
    });
  } catch (error) {
    const classified = classifyEmailDeliveryError(error);
    redirect(`${returnTo}?error=${encodeURIComponent(classified.code)}`);
  }
  revalidatePath("/admin/email");
  redirect("/admin/email/scheduled?notice=scheduled");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/accounting-schema";
import { createGmailDraft, sendGmailMessage, aroGoogleEmail } from "@/lib/communications/google-workspace";
import { decryptSecret, randomToken, sanitizeError } from "@/lib/communications/security";

type EmailMode = "gmail_draft" | "scheduled" | "send_now" | "system_draft";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function htmlFromText(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`)
    .join("");
}

async function getActiveConnection(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("google_workspace_connections")
    .select("id, encrypted_access_token, connected_email, status")
    .eq("profile_id", profileId)
    .eq("status", "connected")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Google Workspace não conectado.");
  if (data.connected_email !== aroGoogleEmail) throw new Error("A conta Google conectada não é claudio@arolab.co.");

  return data as {
    connected_email: string;
    encrypted_access_token: string | null;
    id: string;
    status: string;
  };
}

export async function createOutboundEmailAction(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const mode = (textValue(formData, "mode") || "system_draft") as EmailMode;
  const recipientEmail = textValue(formData, "recipient_email").toLowerCase();
  const bodyText = textValue(formData, "body_text");
  const subject = textValue(formData, "subject");
  const record = {
    body_html: htmlFromText(bodyText),
    body_text: bodyText,
    created_by: profile.id,
    idempotency_key: textValue(formData, "idempotency_key") || randomToken(24),
    mode,
    recipient_email: recipientEmail,
    recipient_name: textValue(formData, "recipient_name") || null,
    status: mode === "scheduled" ? "scheduled" : "draft",
    subject
  };

  if (!recipientEmail || !subject || !bodyText) {
    redirect("/admin/email/compose?error=missing-fields");
  }

  let insertRecord = record;
  try {
    if (mode === "gmail_draft" || mode === "send_now") {
      const connection = await getActiveConnection(profile.id);
      const accessToken = decryptSecret(connection.encrypted_access_token);
      if (!accessToken) throw new Error("Token Google indisponível.");

      if (mode === "send_now" && recipientEmail !== aroGoogleEmail) {
        throw new Error("Durante a implantação, envio real só é permitido para claudio@arolab.co.");
      }

      if (mode === "gmail_draft") {
        const draft = await createGmailDraft(accessToken, {
          bodyHtml: record.body_html,
          bodyText: record.body_text,
          subject,
          to: recipientEmail
        });
        insertRecord = {
          ...record,
          gmail_draft_id: draft.id,
          gmail_message_id: draft.message?.id ?? null,
          gmail_thread_id: draft.message?.threadId ?? null,
          sender_connection_id: connection.id,
          status: "draft"
        } as never;
      }

      if (mode === "send_now") {
        const message = await sendGmailMessage(accessToken, {
          bodyHtml: record.body_html,
          bodyText: record.body_text,
          subject,
          to: recipientEmail
        });
        insertRecord = {
          ...record,
          gmail_message_id: message.id,
          gmail_thread_id: message.threadId ?? null,
          sender_connection_id: connection.id,
          sent_at: new Date().toISOString(),
          status: "sent"
        } as never;
      }
    }

    const { error } = await supabase.from("outbound_emails").insert(insertRecord);
    if (error) throw error;
  } catch (error) {
    if (isMissingSchemaError(error)) redirect("/admin/email?schema=pending");

    await supabase.from("outbound_emails").insert({
      ...record,
      error_message_sanitized: sanitizeError(error),
      failed_at: new Date().toISOString(),
      status: "failed"
    });
  }

  revalidatePath("/admin/email");
  redirect("/admin/email");
}

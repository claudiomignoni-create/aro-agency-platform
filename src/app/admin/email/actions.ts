"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/accounting-schema";
import { createGmailDraft, sendGmailMessage } from "@/lib/communications/google-workspace";
import { assertSafeRecipientForRealSend, getUsableGoogleAccessToken } from "@/lib/communications/google-server";
import { randomToken, sanitizeError } from "@/lib/communications/security";

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

function scheduledDateTime(formData: FormData) {
  const date = textValue(formData, "scheduled_date");
  const time = textValue(formData, "scheduled_time");
  const timezone = textValue(formData, "scheduled_timezone") || "America/Sao_Paulo";

  if (!date || !time) {
    throw new Error("Informe data e hora para agendar.");
  }

  const scheduledAt = zonedDateTimeToUtc(date, time, timezone);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    throw new Error("O agendamento precisa estar no futuro.");
  }

  return {
    scheduled_at: scheduledAt.toISOString(),
    scheduled_timezone: timezone
  };
}

function zonedDateTimeToUtc(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(utcGuess);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const zonedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  const offset = zonedAsUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offset);
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
      const connection = await getUsableGoogleAccessToken(profile.id);
      if (mode === "send_now") assertSafeRecipientForRealSend(recipientEmail);

      if (mode === "gmail_draft") {
        const draft = await createGmailDraft(connection.accessToken, {
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
          sender_connection_id: connection.connectionId,
          status: "draft"
        } as never;
      }

      if (mode === "send_now") {
        const message = await sendGmailMessage(connection.accessToken, {
          bodyHtml: record.body_html,
          bodyText: record.body_text,
          subject,
          to: recipientEmail
        });
        insertRecord = {
          ...record,
          gmail_message_id: message.id,
          gmail_thread_id: message.threadId ?? null,
          sender_connection_id: connection.connectionId,
          sent_at: new Date().toISOString(),
          status: "sent"
        } as never;
      }
    }

    if (mode === "scheduled") {
      assertSafeRecipientForRealSend(recipientEmail);
      const connection = await getUsableGoogleAccessToken(profile.id);
      insertRecord = {
        ...record,
        ...scheduledDateTime(formData),
        sender_connection_id: connection.connectionId,
        status: "scheduled"
      } as never;
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

export async function cancelOutboundEmailAction(id: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outbound_emails")
    .update({
      encrypted_payload: null,
      error_message_sanitized: "Cancelado manualmente por administrador.",
      status: "canceled"
    })
    .eq("id", id)
    .in("status", ["draft", "scheduled", "queued", "retry_pending"])
    .select("id")
    .maybeSingle();

  if (error) throw error;
  revalidatePath("/admin/email");
  revalidatePath("/admin/email/queue");
  revalidatePath(`/admin/email/${id}`);
  redirect(`/admin/email/${id}${data ? "?notice=canceled" : "?error=not-cancelable"}`);
}

export async function duplicateOutboundEmailAction(id: string) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: source, error: sourceError } = await supabase
    .from("outbound_emails")
    .select("recipient_name, recipient_email, subject, body_html, body_text, presentation_id, model_update_request_id")
    .eq("id", id)
    .maybeSingle();

  if (sourceError) throw sourceError;
  if (!source || source.subject === "ARO — Código de verificação") {
    redirect(`/admin/email/${id}?error=not-duplicable`);
  }

  const { data: duplicate, error } = await supabase
    .from("outbound_emails")
    .insert({
      ...source,
      created_by: profile.id,
      idempotency_key: randomToken(24),
      mode: "system_draft",
      status: "draft"
    })
    .select("id")
    .single();

  if (error) throw error;
  revalidatePath("/admin/email");
  revalidatePath("/admin/email/drafts");
  redirect(`/admin/email/${duplicate.id}?notice=duplicated`);
}

export async function updateQueuedRecipientAction(id: string, formData: FormData) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const recipientEmail = textValue(formData, "recipient_email").toLowerCase();
  const recipientName = textValue(formData, "recipient_name") || null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
    redirect(`/admin/email/${id}?error=invalid-recipient`);
  }

  const { data: current, error: currentError } = await supabase
    .from("outbound_emails")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current || !["draft", "scheduled", "queued", "retry_pending"].includes(current.status)) {
    redirect(`/admin/email/${id}?error=not-editable`);
  }
  if (current.status !== "draft") assertSafeRecipientForRealSend(recipientEmail);

  const { data: updated, error } = await supabase
    .from("outbound_emails")
    .update({
      recipient_email: recipientEmail,
      recipient_name: recipientName
    })
    .eq("id", id)
    .eq("status", current.status)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  revalidatePath("/admin/email");
  revalidatePath("/admin/email/queue");
  revalidatePath(`/admin/email/${id}`);
  redirect(
    `/admin/email/${id}${updated ? "?notice=recipient-updated" : "?error=state-changed"}`
  );
}

const emailTemplateCategories = new Set([
  "model_presentation",
  "casting_selection",
  "shortlist",
  "direct_booking",
  "international_placement",
  "material_update",
  "profile_update_full",
  "measurements_update",
  "polaroids_update",
  "videos_update",
  "documents_update",
  "reminder",
  "update_completed",
  "follow_up",
  "custom"
]);

function templatePayload(formData: FormData) {
  const category = textValue(formData, "category");
  const language = textValue(formData, "language");
  const name = textValue(formData, "name");
  const subject = textValue(formData, "subject");
  const bodyText = textValue(formData, "body_text");

  if (
    !emailTemplateCategories.has(category) ||
    !["pt-BR", "en"].includes(language) ||
    !name ||
    !subject ||
    !bodyText
  ) {
    throw new Error("Template inválido.");
  }

  return {
    body_html: htmlFromText(bodyText),
    body_text: bodyText,
    category,
    language,
    name,
    subject
  };
}

export async function createEmailTemplateAction(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      ...templatePayload(formData),
      created_by: profile.id,
      is_active: true,
      is_default: false,
      updated_by: profile.id
    })
    .select("id")
    .single();

  if (error) throw error;
  revalidatePath("/admin/email/templates");
  redirect(`/admin/email/templates/${data.id}/edit?notice=created`);
}

export async function updateEmailTemplateAction(id: string, formData: FormData) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("email_templates")
    .update({
      ...templatePayload(formData),
      updated_by: profile.id
    })
    .eq("id", id);

  if (error) throw error;
  revalidatePath("/admin/email/templates");
  revalidatePath(`/admin/email/templates/${id}/edit`);
  redirect(`/admin/email/templates/${id}/edit?notice=updated`);
}

export async function duplicateEmailTemplateAction(id: string) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: source, error: sourceError } = await supabase
    .from("email_templates")
    .select("name, category, language, subject, body_html, body_text")
    .eq("id", id)
    .maybeSingle();

  if (sourceError) throw sourceError;
  if (!source) redirect("/admin/email/templates");

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      ...source,
      created_by: profile.id,
      is_active: true,
      is_default: false,
      name: `${source.name} — cópia`,
      updated_by: profile.id
    })
    .select("id")
    .single();

  if (error) throw error;
  revalidatePath("/admin/email/templates");
  redirect(`/admin/email/templates/${data.id}/edit?notice=duplicated`);
}

export async function archiveEmailTemplateAction(id: string) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("email_templates")
    .update({
      is_active: false,
      is_default: false,
      updated_by: profile.id
    })
    .eq("id", id);

  if (error) throw error;
  revalidatePath("/admin/email/templates");
  redirect("/admin/email/templates?notice=archived");
}

export async function setDefaultEmailTemplateAction(id: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_default_email_template", {
    p_template_id: id
  });

  if (error) throw error;
  revalidatePath("/admin/email/templates");
  redirect("/admin/email/templates?notice=default");
}

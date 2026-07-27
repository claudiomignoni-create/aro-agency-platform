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

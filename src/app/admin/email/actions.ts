"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/accounting-schema";
import {
  processEmailQueue,
  submitOutboundEmail
} from "@/lib/communications/email-delivery-server";
import { classifyEmailDeliveryError } from "@/lib/communications/email-delivery-errors";
import { getEmailOperationalState } from "@/lib/communications/operational-state-server";
import { assertSafeRecipientForRealSend } from "@/lib/communications/google-server";
import { randomToken } from "@/lib/communications/security";
import {
  emailHtmlFromComposerText,
  emailPlainTextFromComposerText
} from "@/lib/communications/email-compose";

type EmailMode = "gmail_draft" | "scheduled" | "send_now" | "system_draft";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
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
  const requestedMode = textValue(formData, "mode") || "system_draft";
  const mode: EmailMode = ["gmail_draft", "scheduled", "send_now", "system_draft"].includes(
    requestedMode
  )
    ? (requestedMode as EmailMode)
    : "system_draft";
  const recipientEmail = textValue(formData, "recipient_email").toLowerCase();
  const composerBodyText = textValue(formData, "body_text");
  const subject = textValue(formData, "subject");

  if (!recipientEmail || !subject || !composerBodyText) {
    redirect("/admin/email/compose?error=missing-fields");
  }
  const bodyText = emailPlainTextFromComposerText(composerBodyText);

  let schedule: Partial<{
    scheduledAt: string;
    scheduledTimezone: string;
  }> = {};
  try {
    if (mode === "scheduled") {
      const scheduled = scheduledDateTime(formData);
      schedule = {
        scheduledAt: scheduled.scheduled_at,
        scheduledTimezone: scheduled.scheduled_timezone
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    redirect(
      `/admin/email/compose?error=${
        /futuro/i.test(message) ? "invalid-schedule" : "missing-schedule"
      }`
    );
  }

  let result: Awaited<ReturnType<typeof submitOutboundEmail>>;
  try {
    result = await submitOutboundEmail({
      bodyHtml: emailHtmlFromComposerText(composerBodyText),
      bodyText,
      createdBy: profile.id,
      idempotencyKey:
        textValue(formData, "idempotency_key") || randomToken(24),
      mode,
      recipientEmail,
      recipientName: textValue(formData, "recipient_name") || null,
      ...schedule,
      subject
    });

  } catch (error) {
    if (isMissingSchemaError(error)) redirect("/admin/email?schema=pending");
    const classified = classifyEmailDeliveryError(error);
    redirect(`/admin/email/compose?error=${classified.code}`);
  }

  const notice =
    result.status === "sent"
      ? "sent"
      : mode === "gmail_draft"
        ? "gmail-draft-created"
        : mode === "scheduled"
          ? "scheduled"
          : "draft-saved";
  revalidatePath("/admin/email");
  revalidatePath("/admin/email/queue");
  redirect(`/admin/email/${result.id}?notice=${notice}`);
}

export async function processEmailQueueNowAction() {
  const profile = await requireRole(["admin"]);
  const operationalState = await getEmailOperationalState(profile.id);
  if (process.env.VERCEL_ENV === "preview") {
    redirect("/admin/email/queue?error=queue-not-configured");
  }
  if (!operationalState.gmailApiConfigured) {
    redirect("/admin/email/queue?error=google-not-configured");
  }
  if (!operationalState.accountConnected) {
    redirect("/admin/email/queue?error=google-not-connected");
  }
  let result: Awaited<ReturnType<typeof processEmailQueue>>;
  try {
    result = await processEmailQueue(5);
  } catch (error) {
    const classified = classifyEmailDeliveryError(error);
    redirect(`/admin/email/queue?error=${classified.code}`);
  }
  revalidatePath("/admin/email");
  revalidatePath("/admin/email/queue");
  redirect(
    `/admin/email/queue?notice=processed&processed=${result.processed}&sent=${result.sent}&failed=${result.failed}`
  );
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
    body_html: emailHtmlFromComposerText(bodyText),
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

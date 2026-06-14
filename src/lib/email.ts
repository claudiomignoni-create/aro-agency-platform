import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  EmailOutbox,
  EmailProvider,
  EmailSettings,
  EmailTemplate
} from "@/types/database";
import { isMissingNotificationsSchemaError } from "@/lib/notifications";

type EmailVariables = Record<string, string | number | null | undefined>;

type QueueEmailInput = {
  bodyHtml?: string;
  bodyText?: string;
  entityId?: string | null;
  entityType?: string | null;
  recipientEmail: string;
  recipientName?: string | null;
  recipientProfileId?: string | null;
  scheduledFor?: string | null;
  subject?: string;
  templateKey?: string | null;
  variables?: EmailVariables;
};

type ModelEmailInput = {
  actionUrl: string;
  jobId?: string;
  jobTitle?: string;
  modelId?: string;
  modelName: string;
  recipientEmail: string;
  recipientProfileId?: string | null;
};

const defaultSettings: EmailSettings = {
  created_at: new Date(0).toISOString(),
  id: "00000000-0000-0000-0000-000000000010",
  is_enabled: false,
  provider: "disabled",
  reply_to: "claudio@arolab.co",
  sender_email: "claudio@arolab.co",
  sender_name: "AROLAB",
  updated_at: new Date(0).toISOString()
};

function emailSelect() {
  return `
    id,
    template_key,
    recipient_email,
    recipient_name,
    recipient_profile_id,
    sender_email,
    sender_name,
    reply_to,
    subject,
    body_html,
    body_text,
    status,
    provider,
    provider_message_id,
    entity_type,
    entity_id,
    error_message,
    scheduled_for,
    sent_at,
    created_at,
    updated_at
  `;
}

function templateSelect() {
  return `
    id,
    key,
    name,
    subject,
    body_html,
    body_text,
    variables,
    is_active,
    created_at,
    updated_at
  `;
}

function normalizeProvider(value: string | undefined, fallback: EmailProvider) {
  const providers: EmailProvider[] = ["disabled", "gmail", "manual", "resend"];
  return providers.includes(value as EmailProvider)
    ? (value as EmailProvider)
    : fallback;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderString(
  source: string,
  variables: EmailVariables,
  escapeValues: boolean
) {
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const rawValue = variables[key];
    const value =
      rawValue === null || rawValue === undefined ? "" : String(rawValue);

    return escapeValues ? escapeHtml(value) : value;
  });
}

async function getActiveEmailSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_settings")
    .select(
      "id, provider, sender_email, sender_name, reply_to, is_enabled, created_at, updated_at"
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (isMissingNotificationsSchemaError(error)) {
    return defaultSettings;
  }

  if (error) {
    throw error;
  }

  const settings = (data as EmailSettings | null) ?? defaultSettings;
  const provider = normalizeProvider(
    process.env.EMAIL_PROVIDER,
    settings.provider
  );

  return {
    ...settings,
    provider,
    reply_to: process.env.EMAIL_REPLY_TO ?? settings.reply_to,
    sender_email: process.env.EMAIL_FROM ?? settings.sender_email
  } satisfies EmailSettings;
}

export function renderEmailTemplate(
  template: Pick<EmailTemplate, "body_html" | "body_text" | "subject">,
  variables: EmailVariables = {}
) {
  return {
    bodyHtml: renderString(template.body_html, variables, true),
    bodyText: renderString(template.body_text, variables, false),
    subject: renderString(template.subject, variables, false)
  };
}

export async function listEmailTemplates() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select(templateSelect())
    .order("name", { ascending: true });

  if (isMissingNotificationsSchemaError(error)) {
    return [];
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as EmailTemplate[];
}

export async function listEmailOutbox(limit = 40) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_outbox")
    .select(emailSelect())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (isMissingNotificationsSchemaError(error)) {
    return [];
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as EmailOutbox[];
}

export async function getEmailSettings() {
  await requireRole(["admin"]);
  return getActiveEmailSettings();
}

export async function queueEmail(input: QueueEmailInput) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const settings = await getActiveEmailSettings();
  let rendered = {
    bodyHtml: input.bodyHtml ?? "",
    bodyText: input.bodyText ?? "",
    subject: input.subject ?? ""
  };

  if (input.templateKey) {
    const { data: template, error: templateError } = await supabase
      .from("email_templates")
      .select(templateSelect())
      .eq("key", input.templateKey)
      .eq("is_active", true)
      .maybeSingle();

    if (templateError) {
      throw templateError;
    }

    if (!template) {
      throw new Error("Template de e-mail não encontrado ou inativo.");
    }

    rendered = renderEmailTemplate(template as EmailTemplate, input.variables);
  }

  if (!rendered.subject || !rendered.bodyHtml || !rendered.bodyText) {
    throw new Error("E-mail sem assunto ou corpo.");
  }

  const { data, error } = await supabase
    .from("email_outbox")
    .insert({
      body_html: rendered.bodyHtml,
      body_text: rendered.bodyText,
      entity_id: input.entityId ?? null,
      entity_type: input.entityType ?? null,
      provider: settings.provider,
      recipient_email: input.recipientEmail,
      recipient_name: input.recipientName ?? null,
      recipient_profile_id: input.recipientProfileId ?? null,
      reply_to: settings.reply_to,
      scheduled_for: input.scheduledFor ?? null,
      sender_email: settings.sender_email,
      sender_name: settings.sender_name,
      status: "pending",
      subject: rendered.subject,
      template_key: input.templateKey ?? null
    })
    .select(emailSelect())
    .single();

  if (error) {
    throw error;
  }

  return data as EmailOutbox;
}

export async function sendQueuedEmail(id: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const settings = await getActiveEmailSettings();
  const { data: email, error } = await supabase
    .from("email_outbox")
    .select(emailSelect())
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!email) {
    throw new Error("E-mail não encontrado na fila.");
  }

  const outboxEmail = email as EmailOutbox;

  if (!settings.is_enabled || settings.provider === "disabled") {
    const errorMessage =
      "Provider de e-mail desativado. O registro ficou salvo para revisão.";

    await supabase
      .from("email_outbox")
      .update({ error_message: errorMessage, status: "failed" })
      .eq("id", id);

    return { ok: false, provider: settings.provider, error: errorMessage };
  }

  if (settings.provider === "gmail") {
    const errorMessage =
      "Envio por Gmail API ainda não foi conectado. Configure OAuth antes de ativar.";

    await supabase
      .from("email_outbox")
      .update({ error_message: errorMessage, status: "failed" })
      .eq("id", id);

    return { ok: false, provider: settings.provider, error: errorMessage };
  }

  if (settings.provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      const errorMessage = "RESEND_API_KEY não configurada.";

      await supabase
        .from("email_outbox")
        .update({ error_message: errorMessage, status: "failed" })
        .eq("id", id);

      return { ok: false, provider: settings.provider, error: errorMessage };
    }

    const response = await fetch("https://api.resend.com/emails", {
      body: JSON.stringify({
        from: `${settings.sender_name} <${settings.sender_email}>`,
        html: outboxEmail.body_html,
        reply_to: settings.reply_to ?? undefined,
        subject: outboxEmail.subject,
        text: outboxEmail.body_text,
        to: outboxEmail.recipient_email
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    const result = (await response.json().catch(() => null)) as {
      id?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      const errorMessage = result?.message ?? "Falha no envio via Resend.";

      await supabase
        .from("email_outbox")
        .update({ error_message: errorMessage, status: "failed" })
        .eq("id", id);

      return { ok: false, provider: settings.provider, error: errorMessage };
    }

    await supabase
      .from("email_outbox")
      .update({
        provider_message_id: result?.id ?? null,
        sent_at: new Date().toISOString(),
        status: "sent"
      })
      .eq("id", id);

    return { ok: true, provider: settings.provider };
  }

  return { ok: false, provider: settings.provider, error: "Provider manual." };
}

export async function sendEmail(input: QueueEmailInput) {
  const queued = await queueEmail(input);
  const settings = await getActiveEmailSettings();

  if (!settings.is_enabled || settings.provider === "disabled") {
    return queued;
  }

  await sendQueuedEmail(queued.id);
  return queued;
}

export async function sendModelJobInvitationEmail(input: ModelEmailInput) {
  return queueEmail({
    entityId: input.jobId ?? null,
    entityType: "job",
    recipientEmail: input.recipientEmail,
    recipientName: input.modelName,
    recipientProfileId: input.recipientProfileId,
    templateKey: "model_job_invitation",
    variables: {
      action_url: input.actionUrl,
      job_title: input.jobTitle ?? "trabalho AROLAB",
      model_name: input.modelName
    }
  });
}

export async function sendModelJobReminderEmail(input: ModelEmailInput) {
  return queueEmail({
    entityId: input.jobId ?? null,
    entityType: "job",
    recipientEmail: input.recipientEmail,
    recipientName: input.modelName,
    recipientProfileId: input.recipientProfileId,
    templateKey: "model_job_reminder",
    variables: {
      action_url: input.actionUrl,
      job_title: input.jobTitle ?? "trabalho AROLAB",
      model_name: input.modelName
    }
  });
}

export async function sendModelProfileUpdateRequestEmail(
  input: ModelEmailInput & {
    templateKey?:
      | "model_profile_update_request"
      | "model_measurements_update_request"
      | "model_media_update_request";
  }
) {
  return queueEmail({
    entityId: input.modelId ?? null,
    entityType: "model",
    recipientEmail: input.recipientEmail,
    recipientName: input.modelName,
    recipientProfileId: input.recipientProfileId,
    templateKey: input.templateKey ?? "model_profile_update_request",
    variables: {
      action_url: input.actionUrl,
      model_name: input.modelName
    }
  });
}

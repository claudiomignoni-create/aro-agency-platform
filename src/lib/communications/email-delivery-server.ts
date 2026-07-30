import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createGmailDraft,
  encryptedGoogleTokenPayload,
  googleOAuthConfigured,
  refreshGoogleAccessToken,
  sendGmailMessage,
  shouldRefreshGoogleToken
} from "@/lib/communications/google-workspace";
import {
  assertSafeRecipientForRealSend,
  getGoogleConnectionForDelivery
} from "@/lib/communications/google-server";
import {
  classifyEmailDeliveryError,
  EmailDeliveryError,
  type EmailDeliveryErrorCode
} from "@/lib/communications/email-delivery-errors";
import {
  communicationsSchedulerConfigured,
  communicationsSchedulerEnabled
} from "@/lib/communications/operational-state-server";
import { decryptSecret } from "@/lib/communications/security";

export type EmailDeliveryMode =
  | "gmail_draft"
  | "scheduled"
  | "send_now"
  | "system_draft";

type OutboundEmailRecord = {
  attempt_count: number;
  body_html: string;
  body_text: string;
  encrypted_payload: string | null;
  gmail_draft_id: string | null;
  gmail_message_id: string | null;
  id: string;
  idempotency_key: string;
  mode: EmailDeliveryMode;
  model_update_request_id: string | null;
  presentation_id: string | null;
  recipient_email: string;
  sender_connection_id: string | null;
  status: string;
  subject: string;
};

type ConnectionRecord = {
  encrypted_access_token: string | null;
  encrypted_refresh_token: string | null;
  id: string;
  status: string;
  token_expires_at: string | null;
};

export type SubmitOutboundEmailInput = {
  bodyHtml: string;
  bodyText: string;
  createdBy: string;
  idempotencyKey: string;
  mode: EmailDeliveryMode;
  recipientEmail: string;
  recipientName?: string | null;
  scheduledAt?: string | null;
  scheduledTimezone?: string | null;
  subject: string;
};

export type EmailDeliveryResult = {
  errorCode?: EmailDeliveryErrorCode;
  id: string;
  status: string;
};

export type QueueProcessingResult = {
  failed: number;
  processed: number;
  results: EmailDeliveryResult[];
  sent: number;
};

const outboundEmailSelect =
  "id, status, mode, recipient_email, subject, body_html, body_text, encrypted_payload, sender_connection_id, gmail_draft_id, gmail_message_id, attempt_count, idempotency_key, presentation_id, model_update_request_id";

function validRecipient(value: string) {
  return value.length <= 320 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function validateSubmission(input: SubmitOutboundEmailInput) {
  if (!validRecipient(input.recipientEmail)) {
    throw new EmailDeliveryError("invalid-recipient");
  }
  if (!input.subject.trim() || !input.bodyText.trim()) {
    throw new EmailDeliveryError("email-delivery-failed");
  }
  if (input.mode === "scheduled" && !input.scheduledAt) {
    throw new EmailDeliveryError("queue-not-configured");
  }
}

function statusForMode(mode: EmailDeliveryMode) {
  if (mode === "system_draft") return "draft";
  if (mode === "scheduled") return "scheduled";
  return "queued";
}

async function findByIdempotencyKey(idempotencyKey: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outbound_emails")
    .select("id, status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; status: string } | null;
}

async function insertFailureRecord(
  input: SubmitOutboundEmailInput,
  code: EmailDeliveryErrorCode
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outbound_emails")
    .insert({
      body_html: input.bodyHtml,
      body_text: input.bodyText,
      created_by: input.createdBy,
      error_code: code,
      error_message_sanitized: classifyEmailDeliveryError(
        new EmailDeliveryError(code)
      ).message,
      failed_at: new Date().toISOString(),
      idempotency_key: input.idempotencyKey,
      mode: input.mode,
      recipient_email: input.recipientEmail,
      recipient_name: input.recipientName || null,
      scheduled_at: input.scheduledAt || null,
      scheduled_timezone: input.scheduledTimezone || null,
      status: "failed",
      subject: input.subject
    })
    .select("id, status")
    .single();

  if (!error) return data as { id: string; status: string };
  if (error.code === "23505") return findByIdempotencyKey(input.idempotencyKey);
  return null;
}

async function prepareSenderConnection(
  profileId: string,
  mode: EmailDeliveryMode,
  recipientEmail: string
) {
  if (mode === "system_draft") return null;
  assertSafeRecipientForRealSend(recipientEmail);
  if (mode === "scheduled") {
    if (!communicationsSchedulerConfigured() || !communicationsSchedulerEnabled()) {
      throw new EmailDeliveryError("queue-not-configured");
    }
  }

  const connection = await getGoogleConnectionForDelivery(profileId);
  return connection.id;
}

export async function submitOutboundEmail(
  input: SubmitOutboundEmailInput
): Promise<EmailDeliveryResult> {
  let inserted: { id: string; status: string } | null = null;

  try {
    validateSubmission(input);
    const senderConnectionId = await prepareSenderConnection(
      input.createdBy,
      input.mode,
      input.recipientEmail
    );
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("outbound_emails")
      .insert({
        body_html: input.bodyHtml,
        body_text: input.bodyText,
        created_by: input.createdBy,
        idempotency_key: input.idempotencyKey,
        mode: input.mode,
        recipient_email: input.recipientEmail,
        recipient_name: input.recipientName || null,
        scheduled_at: input.scheduledAt || null,
        scheduled_timezone: input.scheduledTimezone || null,
        sender_connection_id: senderConnectionId,
        status: statusForMode(input.mode),
        subject: input.subject
      })
      .select("id, status")
      .single();

    if (error?.code === "23505") {
      inserted = await findByIdempotencyKey(input.idempotencyKey);
    } else if (error) {
      throw error;
    } else {
      inserted = data as { id: string; status: string };
    }

    if (!inserted) throw new Error("Outbound email record was not created");
    if (inserted.status === "sent") return inserted;
    if (input.mode === "send_now" || input.mode === "gmail_draft") {
      return deliverOutboundEmailNow(inserted.id);
    }

    return inserted;
  } catch (error) {
    const classified = classifyEmailDeliveryError(error);
    if (!inserted && validRecipient(input.recipientEmail)) {
      inserted = await insertFailureRecord(input, classified.code);
    }
    throw classified;
  }
}

function resolveEmailContent(email: OutboundEmailRecord) {
  if (!email.encrypted_payload) {
    return { bodyHtml: email.body_html, bodyText: email.body_text };
  }

  const decrypted = decryptSecret(email.encrypted_payload);
  if (!decrypted) throw new Error("Encrypted email payload is unavailable");
  const payload = JSON.parse(decrypted) as { bodyHtml?: unknown; bodyText?: unknown };
  if (typeof payload.bodyHtml !== "string" || typeof payload.bodyText !== "string") {
    throw new Error("Encrypted email payload is invalid");
  }

  return { bodyHtml: payload.bodyHtml, bodyText: payload.bodyText };
}

async function getQueueAccessToken(connectionId: string) {
  if (!googleOAuthConfigured()) {
    throw new EmailDeliveryError("google-not-configured");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("google_workspace_connections")
    .select("id, status, encrypted_access_token, encrypted_refresh_token, token_expires_at")
    .eq("id", connectionId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status !== "connected") {
    throw new EmailDeliveryError(
      data?.status === "revoked" ? "google-token-revoked" : "google-not-connected"
    );
  }

  const connection = data as ConnectionRecord;
  let accessToken = decryptSecret(connection.encrypted_access_token);
  if (!accessToken || shouldRefreshGoogleToken(connection.token_expires_at)) {
    if (!connection.encrypted_refresh_token) {
      throw new EmailDeliveryError("google-refresh-unavailable");
    }

    try {
      const refreshed = await refreshGoogleAccessToken(connection.encrypted_refresh_token);
      const encrypted = encryptedGoogleTokenPayload(refreshed);
      accessToken = decryptSecret(encrypted.encrypted_access_token);
      await admin
        .from("google_workspace_connections")
        .update({
          encrypted_access_token: encrypted.encrypted_access_token,
          encrypted_refresh_token:
            encrypted.encrypted_refresh_token ?? connection.encrypted_refresh_token,
          last_error: null,
          last_used_at: new Date().toISOString(),
          status: "connected",
          token_expires_at: encrypted.token_expires_at
        })
        .eq("id", connection.id);
    } catch (refreshError) {
      const classified = classifyEmailDeliveryError(
        refreshError,
        "google-refresh-unavailable"
      );
      await admin
        .from("google_workspace_connections")
        .update({
          last_error: classified.message,
          status:
            classified.code === "google-token-revoked" ? "revoked" : "error"
        })
        .eq("id", connection.id);
      throw classified;
    }
  }

  if (!accessToken) throw new EmailDeliveryError("google-refresh-unavailable");
  return accessToken;
}

async function finalizePresentationDelivery(email: OutboundEmailRecord) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("model_update_reminders")
    .update({ sent_at: now, status: "sent" })
    .eq("outbound_email_id", email.id)
    .neq("status", "sent");
  await admin
    .from("presentation_recipients")
    .update({ sent_at: now })
    .eq("outbound_email_id", email.id);
  if (email.presentation_id) {
    await admin
      .from("presentations")
      .update({ status: "sent" })
      .eq("id", email.presentation_id)
      .eq("status", "published");
  }
}

async function markDeliveryFailure(
  email: OutboundEmailRecord,
  error: unknown,
  allowRetry: boolean
) {
  const admin = createAdminClient();
  const fallback =
    email.mode === "gmail_draft" ? "gmail-draft-failed" : "gmail-send-failed";
  const classified = classifyEmailDeliveryError(error, fallback);
  const retry = allowRetry && email.attempt_count < 3;
  const delayMinutes = email.attempt_count <= 1 ? 5 : 30;

  await admin
    .from("outbound_emails")
    .update({
      encrypted_payload: retry ? email.encrypted_payload : null,
      error_code: classified.code,
      error_message_sanitized: classified.message,
      failed_at: retry ? null : new Date().toISOString(),
      scheduled_at: retry
        ? new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
        : null,
      status: retry ? "retry_pending" : "failed"
    })
    .eq("id", email.id)
    .eq("status", "processing");

  if (email.sender_connection_id) {
    await admin
      .from("google_workspace_connections")
      .update({
        last_error: classified.message,
        status:
          classified.code === "google-token-revoked"
            ? "revoked"
            : classified.code === "google-not-connected"
              ? "error"
              : "connected"
      })
      .eq("id", email.sender_connection_id);
  }

  if (!retry) {
    await admin
      .from("model_update_reminders")
      .update({ status: "failed" })
      .eq("outbound_email_id", email.id)
      .neq("status", "sent");
  }

  return {
    errorCode: classified.code,
    id: email.id,
    status: retry ? "retry_pending" : "failed"
  } satisfies EmailDeliveryResult;
}

async function deliverClaimedEmail(
  email: OutboundEmailRecord,
  allowRetry: boolean
): Promise<EmailDeliveryResult> {
  try {
    if (!email.sender_connection_id) {
      throw new EmailDeliveryError("google-not-connected");
    }
    const accessToken = await getQueueAccessToken(email.sender_connection_id);
    const content = resolveEmailContent(email);
    const admin = createAdminClient();

    if (email.mode === "gmail_draft") {
      const draft = await createGmailDraft(accessToken, {
        bodyHtml: content.bodyHtml,
        bodyText: content.bodyText,
        subject: email.subject,
        to: email.recipient_email
      });
      const { data, error } = await admin
        .from("outbound_emails")
        .update({
          encrypted_payload: null,
          error_code: null,
          error_message_sanitized: null,
          gmail_draft_id: draft.id,
          gmail_message_id: draft.message?.id ?? null,
          gmail_thread_id: draft.message?.threadId ?? null,
          status: "draft"
        })
        .eq("id", email.id)
        .eq("status", "processing")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new EmailDeliveryError("delivery-in-progress");
      return { id: email.id, status: "draft" };
    }

    assertSafeRecipientForRealSend(email.recipient_email);
    const sent = await sendGmailMessage(accessToken, {
      bodyHtml: content.bodyHtml,
      bodyText: content.bodyText,
      subject: email.subject,
      to: email.recipient_email
    });
    const sentAt = new Date().toISOString();
    const { data, error } = await admin
      .from("outbound_emails")
      .update({
        encrypted_payload: null,
        error_code: null,
        error_message_sanitized: null,
        gmail_message_id: sent.id,
        gmail_thread_id: sent.threadId ?? null,
        sent_at: sentAt,
        status: "sent"
      })
      .eq("id", email.id)
      .eq("status", "processing")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new EmailDeliveryError("delivery-in-progress");
    await finalizePresentationDelivery(email);
    return { id: email.id, status: "sent" };
  } catch (error) {
    return markDeliveryFailure(email, error, allowRetry);
  }
}

export async function deliverOutboundEmailNow(
  emailId: string
): Promise<EmailDeliveryResult> {
  const admin = createAdminClient();
  const { data: current, error } = await admin
    .from("outbound_emails")
    .select(outboundEmailSelect)
    .eq("id", emailId)
    .maybeSingle();
  if (error) throw error;
  if (!current) throw new EmailDeliveryError("email-delivery-failed");

  const email = current as OutboundEmailRecord;
  if (email.status === "sent") return { id: email.id, status: "sent" };
  if (email.mode === "gmail_draft" && email.gmail_draft_id) {
    return { id: email.id, status: "draft" };
  }
  if (!["queued", "retry_pending"].includes(email.status)) {
    throw new EmailDeliveryError("delivery-in-progress");
  }

  const { data: claimed, error: claimError } = await admin
    .from("outbound_emails")
    .update({
      attempt_count: email.attempt_count + 1,
      error_code: null,
      error_message_sanitized: null,
      status: "processing"
    })
    .eq("id", email.id)
    .eq("status", email.status)
    .eq("attempt_count", email.attempt_count)
    .select(outboundEmailSelect)
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) throw new EmailDeliveryError("delivery-in-progress");

  const result = await deliverClaimedEmail(
    claimed as OutboundEmailRecord,
    false
  );
  if (result.errorCode) throw new EmailDeliveryError(result.errorCode);
  return result;
}

export async function processEmailQueue(
  limit = 5
): Promise<QueueProcessingResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_outbound_emails", {
    p_limit: Math.max(1, Math.min(limit, 20))
  });
  if (error) throw error;

  const results: EmailDeliveryResult[] = [];
  for (const email of (data ?? []) as OutboundEmailRecord[]) {
    results.push(await deliverClaimedEmail(email, true));
  }

  return {
    failed: results.filter((result) =>
      ["failed", "retry_pending"].includes(result.status)
    ).length,
    processed: results.length,
    results,
    sent: results.filter((result) => result.status === "sent").length
  };
}

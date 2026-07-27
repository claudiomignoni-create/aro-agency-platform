import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createGmailDraft,
  encryptedGoogleTokenPayload,
  refreshGoogleAccessToken,
  sendGmailMessage,
  shouldRefreshGoogleToken
} from "@/lib/communications/google-workspace";
import { assertSafeRecipientForRealSend } from "@/lib/communications/google-server";
import { decryptSecret, sanitizeError } from "@/lib/communications/security";

type QueueEmail = {
  attempt_count: number;
  body_html: string;
  body_text: string;
  id: string;
  idempotency_key: string;
  model_update_request_id: string | null;
  mode: "gmail_draft" | "scheduled" | "send_now" | "system_draft";
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
  token_expires_at: string | null;
};

function authorized(request: Request) {
  const secret = process.env.COMMUNICATIONS_CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function getQueueAccessToken(connection: ConnectionRecord) {
  const admin = createAdminClient();
  let accessToken = decryptSecret(connection.encrypted_access_token);

  if (!accessToken || shouldRefreshGoogleToken(connection.token_expires_at)) {
    if (!connection.encrypted_refresh_token) {
      throw new Error("Refresh token Google indisponível.");
    }

    const refreshed = await refreshGoogleAccessToken(connection.encrypted_refresh_token);
    const encrypted = encryptedGoogleTokenPayload(refreshed);
    accessToken = decryptSecret(encrypted.encrypted_access_token);
    await admin
      .from("google_workspace_connections")
      .update({
        encrypted_access_token: encrypted.encrypted_access_token,
        encrypted_refresh_token: encrypted.encrypted_refresh_token ?? connection.encrypted_refresh_token,
        last_error: null,
        last_used_at: new Date().toISOString(),
        status: "connected",
        token_expires_at: encrypted.token_expires_at
      })
      .eq("id", connection.id);
  }

  if (!accessToken) throw new Error("Token Google indisponível.");
  return accessToken;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: queue, error } = await admin.rpc("claim_outbound_emails", {
    p_limit: 5
  });

  if (error) throw error;

  const results = [];
  for (const email of (queue ?? []) as QueueEmail[]) {
    try {
      if (!email.sender_connection_id) throw new Error("E-mail sem conexão Google.");
      const { data: connection, error: connectionError } = await admin
        .from("google_workspace_connections")
        .select("id, encrypted_access_token, encrypted_refresh_token, token_expires_at")
        .eq("id", email.sender_connection_id)
        .eq("status", "connected")
        .maybeSingle();

      if (connectionError) throw connectionError;
      if (!connection) throw new Error("Conexão Google indisponível.");

      const accessToken = await getQueueAccessToken(connection as ConnectionRecord);

      if (email.mode === "gmail_draft") {
        const draft = await createGmailDraft(accessToken, {
          bodyHtml: email.body_html,
          bodyText: email.body_text,
          subject: email.subject,
          to: email.recipient_email
        });
        await admin
          .from("outbound_emails")
          .update({
            gmail_draft_id: draft.id,
            gmail_message_id: draft.message?.id ?? null,
            gmail_thread_id: draft.message?.threadId ?? null,
            status: "draft"
          })
          .eq("id", email.id);
        results.push({ id: email.id, status: "draft" });
      } else {
        assertSafeRecipientForRealSend(email.recipient_email);
        const sent = await sendGmailMessage(accessToken, {
          bodyHtml: email.body_html,
          bodyText: email.body_text,
          subject: email.subject,
          to: email.recipient_email
        });
        await admin
          .from("outbound_emails")
          .update({
            gmail_message_id: sent.id,
            gmail_thread_id: sent.threadId ?? null,
            status: "sent",
            sent_at: new Date().toISOString()
          })
          .eq("id", email.id);
        await admin
          .from("model_update_reminders")
          .update({ sent_at: new Date().toISOString(), status: "sent" })
          .eq("outbound_email_id", email.id)
          .neq("status", "sent");
        await admin
          .from("presentation_recipients")
          .update({ sent_at: new Date().toISOString() })
          .eq("outbound_email_id", email.id);
        if (email.presentation_id) {
          await admin
            .from("presentations")
            .update({ status: "sent" })
            .eq("id", email.presentation_id)
            .eq("status", "published");
        }
        results.push({ id: email.id, status: "sent" });
      }
    } catch (error) {
      const retry = email.attempt_count < 3;
      const delayMinutes = email.attempt_count <= 1 ? 5 : 30;
      await admin
        .from("outbound_emails")
        .update({
          error_message_sanitized: sanitizeError(error),
          failed_at: retry ? null : new Date().toISOString(),
          scheduled_at: retry ? new Date(Date.now() + delayMinutes * 60 * 1000).toISOString() : null,
          status: retry ? "retry_pending" : "failed"
        })
        .eq("id", email.id);
      if (!retry) {
        await admin
          .from("model_update_reminders")
          .update({ status: "failed" })
          .eq("outbound_email_id", email.id)
          .neq("status", "sent");
      }
      results.push({ id: email.id, status: retry ? "retry_pending" : "failed" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

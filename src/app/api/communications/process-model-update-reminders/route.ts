import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aroGoogleEmail } from "@/lib/communications/google-workspace";
import { randomToken, sanitizeError } from "@/lib/communications/security";

function authorized(request: Request) {
  const secret = process.env.COMMUNICATIONS_CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function html(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: reminders, error } = await admin
    .from("model_update_reminders")
    .select(`
      id,
      request_id,
      request:model_update_requests(
        id,
        title,
        status,
        expires_at,
        submitted_at,
        applied_at,
        canceled_at,
        model:models(id, display_name, stage_name, email, status)
      )
    `)
    .eq("status", "scheduled")
    .lte("remind_at", now)
    .order("remind_at", { ascending: true })
    .limit(10);

  if (error) throw error;

  const { data: connection } = await admin
    .from("google_workspace_connections")
    .select("id")
    .eq("connected_email", aroGoogleEmail)
    .eq("status", "connected")
    .maybeSingle();

  const results = [];
  for (const reminder of reminders ?? []) {
    const requestRow = Array.isArray(reminder.request) ? reminder.request[0] : reminder.request;
    const model = Array.isArray(requestRow?.model) ? requestRow.model[0] : requestRow?.model;

    try {
      const expired = requestRow?.expires_at && new Date(requestRow.expires_at).getTime() <= Date.now();
      const skip =
        !requestRow ||
        expired ||
        ["submitted", "applied", "canceled", "expired"].includes(requestRow.status) ||
        model?.status === "archived" ||
        !model?.email ||
        !connection?.id;

      if (skip) {
        await admin
          .from("model_update_reminders")
          .update({ status: "skipped" })
          .eq("id", reminder.id);
        results.push({ id: reminder.id, status: "skipped" });
        continue;
      }

      const bodyText = [
        `Olá, ${model.stage_name || model.display_name}.`,
        `Este é um lembrete da ARO para concluir: ${requestRow.title}.`,
        "Caso tenha qualquer dúvida, basta responder a este e-mail.",
        "Claudio Mignoni\nARO"
      ].join("\n\n");

      const { data: email, error: emailError } = await admin
        .from("outbound_emails")
        .insert({
          body_html: html(bodyText),
          body_text: bodyText,
          idempotency_key: `reminder-${reminder.id}-${randomToken(8)}`,
          mode: "send_now",
          model_update_request_id: requestRow.id,
          recipient_email: model.email,
          recipient_name: model.stage_name || model.display_name,
          sender_connection_id: connection.id,
          status: "queued",
          subject: "ARO — Lembrete de atualização"
        })
        .select("id")
        .single();

      if (emailError) throw emailError;

      await admin
        .from("model_update_reminders")
        .update({
          outbound_email_id: email.id,
          sent_at: now,
          status: "sent"
        })
        .eq("id", reminder.id);

      results.push({ id: reminder.id, status: "queued" });
    } catch (error) {
      await admin
        .from("model_update_reminders")
        .update({ status: "failed" })
        .eq("id", reminder.id);
      results.push({ error: sanitizeError(error), id: reminder.id, status: "failed" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { aroGoogleEmail, sendGmailMessage } from "@/lib/communications/google-workspace";
import { getUsableGoogleAccessToken } from "@/lib/communications/google-server";
import { randomToken, sanitizeError } from "@/lib/communications/security";

export async function POST(request: Request) {
  const profile = await requireRole(["admin"]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const supabase = await createClient();
  const { data: connection, error } = await supabase
    .from("google_workspace_connections")
    .select("id, connected_email, status")
    .eq("profile_id", profile.id)
    .eq("status", "connected")
    .maybeSingle();

  if (error) throw error;
  if (!connection || connection.connected_email !== aroGoogleEmail) {
    return NextResponse.redirect(new URL("/admin/settings?tab=integrations&google=no-connection", appUrl));
  }

  try {
    const google = await getUsableGoogleAccessToken(profile.id);

    const sent = await sendGmailMessage(google.accessToken, {
      bodyHtml: "<p>Teste de envio do ARO Email Center.</p><p>Claudio Mignoni<br>ARO</p>",
      bodyText: "Teste de envio do ARO Email Center.\n\nClaudio Mignoni\nARO",
      subject: "ARO — Teste de envio",
      to: aroGoogleEmail
    });

    await supabase.from("outbound_emails").insert({
      body_html: "<p>Teste de envio do ARO Email Center.</p><p>Claudio Mignoni<br>ARO</p>",
      body_text: "Teste de envio do ARO Email Center.\n\nClaudio Mignoni\nARO",
      created_by: profile.id,
      gmail_message_id: sent.id,
      gmail_thread_id: sent.threadId ?? null,
      idempotency_key: randomToken(24),
      mode: "send_now",
      recipient_email: aroGoogleEmail,
      recipient_name: "Claudio Mignoni",
      sender_connection_id: google.connectionId,
      sent_at: new Date().toISOString(),
      status: "sent",
      subject: "ARO — Teste de envio"
    });

    return NextResponse.redirect(new URL("/admin/settings?tab=integrations&google=test-sent", appUrl));
  } catch (error) {
    await supabase
      .from("google_workspace_connections")
      .update({ last_error: sanitizeError(error), status: "error" })
      .eq("id", connection.id);

    return NextResponse.redirect(new URL("/admin/settings?tab=integrations&google=test-failed", appUrl));
  }
}

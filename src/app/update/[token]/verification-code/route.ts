import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aroGoogleEmail } from "@/lib/communications/google-workspace";
import { externalEmailSendEnabled } from "@/lib/communications/google-server";
import { checkCommunicationRateLimit, requestIpHash } from "@/lib/communications/rate-limit";
import { sanitizeError, sha256 } from "@/lib/communications/security";

function html(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`)
    .join("");
}

async function getRequest(token: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("model_update_requests")
    .select("id, model_id, title, status, expires_at, model:models(id, display_name, stage_name, email, status)")
    .eq("public_token_hash", sha256(token))
    .not("status", "in", "(expired,canceled,applied)")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const body = (await request.json().catch(() => ({}))) as { code?: string; mode?: "request" | "verify" };
    const mode = body.mode ?? "request";
    const ipHash = await requestIpHash();
    const tokenHash = sha256(token);
    const allowed = await checkCommunicationRateLimit({
      ipHash,
      limit: mode === "request" ? 3 : 6,
      operation: mode === "request" ? "otp_request" : "otp_verify",
      tokenHash,
      windowSeconds: mode === "request" ? 900 : 300
    });
    if (!allowed) throw new Error("Rate limit exceeded");

    const updateRequest = await getRequest(token);
    if (!updateRequest) throw new Error("Solicitação inválida ou expirada.");
    const model = Array.isArray(updateRequest.model) ? updateRequest.model[0] : updateRequest.model;
    if (!model?.email || model.status === "archived") throw new Error("E-mail da modelo indisponível.");

    const admin = createAdminClient();

    if (mode === "verify") {
      const code = String(body.code ?? "").replace(/\D/g, "");
      if (code.length !== 6) throw new Error("Código inválido.");

      const { data: verified, error } = await admin.rpc("verify_model_update_code", {
        p_submitted_code_hash: sha256(code),
        p_token_hash: tokenHash
      });
      if (error) throw error;
      if (!verified) throw new Error("Código inválido, expirado ou limite atingido.");

      return NextResponse.json({ ok: true, verified: true });
    }

    if (!externalEmailSendEnabled() && model.email.toLowerCase() !== aroGoogleEmail) {
      throw new Error("OTP em modo seguro só pode ser enviado para o endereço autorizado de desenvolvimento.");
    }

    const { data: connection } = await admin
      .from("google_workspace_connections")
      .select("id")
      .eq("connected_email", aroGoogleEmail)
      .eq("status", "connected")
      .maybeSingle();

    if (!connection?.id) throw new Error("Google Workspace não conectado.");

    const code = String(crypto.randomInt(100000, 1000000));
    const bodyText = [
      `Olá, ${model.stage_name || model.display_name}.`,
      `Seu código de verificação da ARO é: ${code}`,
      "Ele expira em 10 minutos. Se você não solicitou este código, ignore este e-mail.",
      "Claudio Mignoni\nARO"
    ].join("\n\n");

    const { data: verification, error: verificationError } = await admin
      .from("model_update_verification_codes")
      .insert({
        code_hash: sha256(code),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        model_id: updateRequest.model_id,
        request_id: updateRequest.id
      })
      .select("id")
      .single();
    if (verificationError) throw verificationError;

    await admin.from("outbound_emails").insert({
      body_html: html(bodyText),
      body_text: bodyText,
      idempotency_key: `otp-${verification.id}`,
      mode: "send_now",
      model_update_request_id: updateRequest.id,
      recipient_email: model.email,
      recipient_name: model.stage_name || model.display_name,
      sender_connection_id: connection.id,
      status: "queued",
      subject: "ARO — Código de verificação"
    });

    return NextResponse.json({ ok: true, queued: true });
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error), ok: false }, { status: 400 });
  }
}

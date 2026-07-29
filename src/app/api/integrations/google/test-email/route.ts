import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { submitOutboundEmail } from "@/lib/communications/email-delivery-server";
import { classifyEmailDeliveryError } from "@/lib/communications/email-delivery-errors";
import { aroGoogleEmail } from "@/lib/communications/google-workspace";
import { deterministicToken, randomToken } from "@/lib/communications/security";

export async function POST(request: Request) {
  const profile = await requireRole(["admin"]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const formData = await request.formData();
  const requestNonce = String(formData.get("request_nonce") ?? "").trim();
  const safeNonce = /^[0-9a-f-]{36}$/i.test(requestNonce)
    ? requestNonce
    : randomToken(24);

  try {
    const result = await submitOutboundEmail({
      bodyHtml: "<p>Esta é uma validação controlada do envio de e-mails da ARO.</p>",
      bodyText: "Esta é uma validação controlada do envio de e-mails da ARO.",
      createdBy: profile.id,
      idempotencyKey: deterministicToken(
        "controlled-gmail-test",
        `${profile.id}|${safeNonce}`
      ),
      mode: "send_now",
      recipientEmail: aroGoogleEmail,
      recipientName: "Claudio Mignoni",
      subject: "ARO Email Center — Teste de envio",
      scheduledAt: null,
      scheduledTimezone: null
    });
    if (result.status !== "sent") throw new Error("Controlled email was not sent");

    return NextResponse.redirect(new URL("/admin/settings?tab=integrations&google=test-sent", appUrl));
  } catch (error) {
    const classified = classifyEmailDeliveryError(error);
    return NextResponse.redirect(
      new URL(
        `/admin/settings?tab=integrations&google=test-failed&error=${classified.code}`,
        appUrl
      )
    );
  }
}

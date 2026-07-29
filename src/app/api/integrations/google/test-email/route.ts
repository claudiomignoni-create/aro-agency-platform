import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { submitOutboundEmail } from "@/lib/communications/email-delivery-server";
import { classifyEmailDeliveryError } from "@/lib/communications/email-delivery-errors";
import { aroGoogleEmail } from "@/lib/communications/google-workspace";
import { randomToken } from "@/lib/communications/security";

export async function POST(request: Request) {
  const profile = await requireRole(["admin"]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  try {
    const result = await submitOutboundEmail({
      bodyHtml: "<p>Teste de envio do ARO Email Center.</p><p>Claudio Mignoni<br>ARO</p>",
      bodyText: "Teste de envio do ARO Email Center.\n\nClaudio Mignoni\nARO",
      createdBy: profile.id,
      idempotencyKey: randomToken(24),
      mode: "send_now",
      recipientEmail: aroGoogleEmail,
      recipientName: "Claudio Mignoni",
      subject: "ARO — Teste de envio",
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

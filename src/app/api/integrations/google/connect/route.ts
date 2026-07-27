import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createGoogleAuthorizationUrl, googleOAuthConfigured } from "@/lib/communications/google-workspace";
import { signOAuthState } from "@/lib/communications/security";

export async function GET() {
  const profile = await requireRole(["admin"]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/admin/settings?tab=integrations&google=missing-env", appUrl));
  }

  const state = signOAuthState({ profileId: profile.id });
  const { url, verifier } = createGoogleAuthorizationUrl(state);
  const cookieStore = await cookies();

  cookieStore.set("aro_google_oauth_state", state, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
    secure: true
  });
  cookieStore.set("aro_google_pkce_verifier", verifier, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
    secure: true
  });

  return NextResponse.redirect(url);
}

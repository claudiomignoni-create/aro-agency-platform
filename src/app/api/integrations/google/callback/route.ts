import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  aroGoogleEmail,
  encryptedGoogleTokenPayload,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  googleScopes,
  hasGoogleMailboxScope,
  revokeGoogleToken,
  safeGoogleError
} from "@/lib/communications/google-workspace";
import { verifyOAuthState } from "@/lib/communications/security";

export async function GET(request: Request) {
  const profile = await requireRole(["admin"]);
  const url = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("aro_google_oauth_state")?.value;
  const verifier = cookieStore.get("aro_google_pkce_verifier")?.value;

  cookieStore.delete("aro_google_oauth_state");
  cookieStore.delete("aro_google_pkce_verifier");

  try {
    if (!state || !code || !expectedState || !verifier || state !== expectedState) {
      throw new Error("Invalid Google OAuth callback state");
    }

    const payload = verifyOAuthState<{ profileId: string }>(state);
    if (payload.profileId !== profile.id) throw new Error("OAuth profile mismatch");

    const token = await exchangeGoogleCode(code, verifier);
    const grantedScopes = token.scope?.split(" ").filter(Boolean) ?? [];
    if (!hasGoogleMailboxScope(grantedScopes)) {
      await revokeGoogleToken(token.access_token);
      throw new Error("Google OAuth insufficient scope: gmail.modify");
    }
    const userInfo = await fetchGoogleUserInfo(token.access_token);
    const connectedEmail = userInfo.email.toLowerCase();
    const supabase = await createClient();

    if (connectedEmail !== aroGoogleEmail) {
      await revokeGoogleToken(token.access_token);
      return NextResponse.redirect(new URL("/admin/settings?tab=integrations&google=wrong-account", appUrl));
    }

    const encrypted = encryptedGoogleTokenPayload(token);
    const { data: existingConnection, error: existingError } = await supabase
      .from("google_workspace_connections")
      .select("encrypted_refresh_token")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (existingError) throw existingError;

    const { error } = await supabase.from("google_workspace_connections").upsert(
      {
        connected_email: connectedEmail,
        encrypted_access_token: encrypted.encrypted_access_token,
        encrypted_refresh_token:
          encrypted.encrypted_refresh_token ?? existingConnection?.encrypted_refresh_token ?? null,
        last_error: null,
        profile_id: profile.id,
        scopes: grantedScopes.length ? grantedScopes : [...googleScopes],
        status: "connected",
        token_expires_at: encrypted.token_expires_at
      },
      { onConflict: "profile_id" }
    );
    if (error) throw error;

    return NextResponse.redirect(new URL("/admin/settings?tab=integrations&google=connected", appUrl));
  } catch (error) {
    const supabase = await createClient();
    await supabase.from("google_workspace_connections").upsert(
      {
        connected_email: aroGoogleEmail,
        last_error: safeGoogleError(error),
        profile_id: profile.id,
        status: "error"
      },
      { onConflict: "profile_id" }
    );

    return NextResponse.redirect(new URL("/admin/settings?tab=integrations&google=error", appUrl));
  }
}

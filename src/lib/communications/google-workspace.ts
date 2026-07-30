import { requireEnv } from "@/lib/env";
import { createPkcePair, decryptSecret, encryptSecret, sanitizeError } from "@/lib/communications/security";

export const aroGoogleEmail = "claudio@arolab.co";

export const googleScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.compose"
] as const;

export function googleOAuthRedirectConfigured() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!appUrl || !redirectUri) return false;

  try {
    const expected = new URL("/api/integrations/google/callback", appUrl);
    return new URL(redirectUri).toString() === expected.toString();
  } catch {
    return false;
  }
}

export type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

export type GoogleUserInfo = {
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  sub: string;
};

export function googleOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REDIRECT_URI &&
      process.env.EMAIL_TOKEN_ENCRYPTION_KEY &&
      googleOAuthRedirectConfigured()
  );
}

export function createGoogleAuthorizationUrl(state: string) {
  const { challenge, verifier } = createPkcePair();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  url.searchParams.set("client_id", requireEnv("GOOGLE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", requireEnv("GOOGLE_OAUTH_REDIRECT_URI"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", googleScopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("login_hint", aroGoogleEmail);

  return { url: url.toString(), verifier };
}

export async function exchangeGoogleCode(code: string, verifier: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: requireEnv("GOOGLE_OAUTH_REDIRECT_URI")
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

export async function refreshGoogleAccessToken(encryptedRefreshToken: string) {
  const refreshToken = decryptSecret(encryptedRefreshToken);
  if (!refreshToken) throw new Error("Missing Google refresh token");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

export async function revokeGoogleToken(token: string) {
  await fetch("https://oauth2.googleapis.com/revoke", {
    body: new URLSearchParams({ token }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST"
  });
}

export async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Google userinfo failed: ${response.status}`);
  }

  return (await response.json()) as GoogleUserInfo;
}

function base64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function encodeMimeHeader(value: string) {
  const chunks: string[] = [];
  let current = "";

  for (const character of value.replace(/[\r\n]+/g, " ")) {
    if (Buffer.byteLength(current + character, "utf8") > 42 && current) {
      chunks.push(current);
      current = character;
    } else {
      current += character;
    }
  }

  if (current) chunks.push(current);

  return chunks
    .map((chunk) => `=?UTF-8?B?${Buffer.from(chunk, "utf8").toString("base64")}?=`)
    .join("\r\n ");
}

function rfc2822Message({
  bodyHtml,
  bodyText,
  from,
  subject,
  to
}: {
  bodyHtml: string;
  bodyText: string;
  from: string;
  subject: string;
  to: string;
}) {
  const boundary = `aro-${Date.now().toString(36)}`;
  return [
    `From: Claudio Mignoni <${from}>`,
    `Reply-To: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    bodyText,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    bodyHtml,
    "",
    `--${boundary}--`
  ].join("\r\n");
}

export async function createGmailDraft(
  accessToken: string,
  message: { bodyHtml: string; bodyText: string; subject: string; to: string }
) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    body: JSON.stringify({
      message: {
        raw: base64Url(rfc2822Message({ ...message, from: aroGoogleEmail }))
      }
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Gmail draft creation failed: ${response.status}`);
  }

  return (await response.json()) as { id: string; message?: { id?: string; threadId?: string } };
}

export async function sendGmailMessage(
  accessToken: string,
  message: { bodyHtml: string; bodyText: string; subject: string; to: string }
) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    body: JSON.stringify({
      raw: base64Url(rfc2822Message({ ...message, from: aroGoogleEmail }))
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Gmail send failed: ${response.status}`);
  }

  return (await response.json()) as { id: string; threadId?: string };
}

export function encryptedGoogleTokenPayload(token: GoogleTokenResponse) {
  return {
    encrypted_access_token: encryptSecret(token.access_token),
    encrypted_refresh_token: token.refresh_token ? encryptSecret(token.refresh_token) : null,
    token_expires_at: token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null
  };
}

export function shouldRefreshGoogleToken(tokenExpiresAt: string | null) {
  if (!tokenExpiresAt) return true;
  return new Date(tokenExpiresAt).getTime() - Date.now() < 5 * 60 * 1000;
}

export function safeGoogleError(error: unknown) {
  return sanitizeError(error);
}

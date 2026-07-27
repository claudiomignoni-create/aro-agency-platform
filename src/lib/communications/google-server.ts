import { isMissingSchemaError } from "@/lib/accounting-schema";
import { createClient } from "@/lib/supabase/server";
import {
  aroGoogleEmail,
  encryptedGoogleTokenPayload,
  refreshGoogleAccessToken,
  shouldRefreshGoogleToken
} from "@/lib/communications/google-workspace";
import { decryptSecret, sanitizeError } from "@/lib/communications/security";

type GoogleConnectionRecord = {
  connected_email: string;
  encrypted_access_token: string | null;
  encrypted_refresh_token: string | null;
  id: string;
  status: string;
  token_expires_at: string | null;
};

export async function getUsableGoogleAccessToken(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("google_workspace_connections")
    .select("id, encrypted_access_token, encrypted_refresh_token, connected_email, status, token_expires_at")
    .eq("profile_id", profileId)
    .eq("status", "connected")
    .maybeSingle();

  if (error && isMissingSchemaError(error)) {
    throw new Error("Migration 025 pendente para Google Workspace.");
  }

  if (error) throw error;

  const connection = data as GoogleConnectionRecord | null;
  if (!connection) throw new Error("Google Workspace não conectado.");
  if (connection.connected_email !== aroGoogleEmail) {
    throw new Error("A conta Google conectada não é claudio@arolab.co.");
  }

  let accessToken = decryptSecret(connection.encrypted_access_token);
  if (!accessToken || shouldRefreshGoogleToken(connection.token_expires_at)) {
    if (!connection.encrypted_refresh_token) {
      throw new Error("Refresh token Google indisponível. Reconecte a conta.");
    }

    try {
      const refreshed = await refreshGoogleAccessToken(connection.encrypted_refresh_token);
      const encrypted = encryptedGoogleTokenPayload(refreshed);
      accessToken = decryptSecret(encrypted.encrypted_access_token);

      await supabase
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
    } catch (error) {
      const message = sanitizeError(error);
      await supabase
        .from("google_workspace_connections")
        .update({
          last_error: message,
          status: /invalid_grant/i.test(message) ? "revoked" : "error"
        })
        .eq("id", connection.id);
      throw error;
    }
  } else {
    await supabase
      .from("google_workspace_connections")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", connection.id);
  }

  if (!accessToken) throw new Error("Token Google indisponível.");

  return {
    accessToken,
    connectionId: connection.id
  };
}

export function externalEmailSendEnabled() {
  return process.env.EMAIL_EXTERNAL_SEND_ENABLED === "true";
}

export function assertSafeRecipientForRealSend(recipientEmail: string) {
  if (!externalEmailSendEnabled() && recipientEmail.toLowerCase() !== aroGoogleEmail) {
    throw new Error("Durante a implantação segura, envio real só é permitido para claudio@arolab.co.");
  }
}

import { isMissingSchemaError } from "@/lib/accounting-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkCommunicationRateLimit } from "@/lib/communications/rate-limit";
import { randomToken, sha256 } from "@/lib/communications/security";

export type CommunicationSchemaState = {
  ready: boolean;
  message?: string;
};

export type GoogleConnection = {
  connected_email: string;
  connected_at: string | null;
  id: string;
  last_error: string | null;
  last_used_at: string | null;
  scopes: string[];
  status: string;
  token_expires_at: string | null;
};

export type EmailTemplate = {
  body_html: string;
  body_text: string;
  category: string;
  id: string;
  language: string;
  name: string;
  subject: string;
};

export type OutboundEmail = {
  created_at: string;
  gmail_draft_id: string | null;
  id: string;
  mode: string;
  recipient_email: string;
  recipient_name: string | null;
  status: string;
  subject: string;
};

export type Presentation = {
  created_at: string;
  description: string | null;
  id: string;
  language: string;
  status: string;
  title: string;
};

export type ModelUpdateRequest = {
  created_at: string;
  due_at: string | null;
  expires_at: string;
  id: string;
  language: string;
  model_id: string;
  status: string;
  title: string;
};

export type PublicPresentationPayload = {
  allow_downloads: boolean;
  description: string | null;
  language: string;
  published_at: string | null;
  snapshot: {
    contact?: {
      email?: string;
      name?: string;
      website?: string;
    };
    description?: string | null;
    models?: Array<{
      board?: string | null;
      city?: string | null;
      country?: string | null;
      display_name: string;
      highlighted?: boolean;
      id?: string;
      main_image_path?: string | null;
      measurements?: Record<string, number | string | null>;
      public_model_key?: string | null;
      media?: Array<{
        media_type: string;
        public_media_key?: string | null;
        storage_bucket?: string | null;
        storage_path?: string | null;
        thumbnail_path?: string | null;
        title?: string | null;
      }>;
    }>;
    title?: string;
  };
  title: string;
};

export type PublicModelUpdateRequestPayload = {
  draft_payload: Record<string, unknown> | null;
  due_at: string | null;
  expires_at: string;
  fields: Array<{
    field_group: string;
    field_key: string;
    is_required: boolean;
    is_sensitive: boolean;
  }>;
  language: string;
  message: string | null;
  model: {
    display_name: string;
    main_image_path: string | null;
    stage_name: string | null;
  };
  status: string;
  submitted_at: string | null;
  title: string;
  verification_required: boolean;
};

export function schemaPending(message = "As tabelas de comunicação serão ativadas após a migration 025.") {
  return { message, ready: false };
}

export async function getCommunicationSchemaState(): Promise<CommunicationSchemaState> {
  const supabase = await createClient();
  const { error } = await supabase.from("email_templates").select("id").limit(1);
  if (error && isMissingSchemaError(error)) return schemaPending();
  if (error) throw error;
  return { ready: true };
}

export async function getGoogleConnection(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("google_workspace_connections")
    .select("id, connected_email, status, scopes, token_expires_at, last_used_at, last_error, connected_at")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error && isMissingSchemaError(error)) return null;
  if (error) throw error;

  return data as GoogleConnection | null;
}

export async function listEmailTemplates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("id, name, category, language, subject, body_html, body_text")
    .eq("is_active", true)
    .order("category", { ascending: true });

  if (error && isMissingSchemaError(error)) return [];
  if (error) throw error;

  return (data ?? []) as EmailTemplate[];
}

export async function listOutboundEmails(status?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("outbound_emails")
    .select("id, recipient_name, recipient_email, subject, status, mode, gmail_draft_id, created_at")
    .order("created_at", { ascending: false })
    .limit(80);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;

  if (error && isMissingSchemaError(error)) return [];
  if (error) throw error;

  return (data ?? []) as OutboundEmail[];
}

export async function listPresentations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("presentations")
    .select("id, title, description, language, status, created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error && isMissingSchemaError(error)) return [];
  if (error) throw error;

  return (data ?? []) as Presentation[];
}

export async function listModelUpdateRequests() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("model_update_requests")
    .select("id, model_id, title, language, status, expires_at, due_at, created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error && isMissingSchemaError(error)) return [];
  if (error) throw error;

  return (data ?? []) as ModelUpdateRequest[];
}

export async function findPresentationByToken(token: string) {
  const supabase = createAdminClient();
  const tokenHash = sha256(token);
  const { data, error } = await supabase.rpc("get_public_presentation_by_token", {
    p_token_hash: tokenHash
  });

  if (error && isMissingSchemaError(error)) return null;
  if (error) throw error;

  if (data) {
    await supabase.rpc("mark_public_presentation_opened", { p_token_hash: tokenHash });
  }

  return data as PublicPresentationPayload | null;
}

export async function findPresentationByTokenWithRateLimit(token: string, ipHash: string) {
  const tokenHash = sha256(token);
  const allowed = await checkCommunicationRateLimit({
    ipHash,
    operation: "presentation_open",
    tokenHash
  });
  if (!allowed) return null;
  return findPresentationByToken(token);
}

export async function getPresentationPrivateMediaRefsByToken(token: string) {
  const admin = createAdminClient();
  const tokenHash = sha256(token);
  const { data: shareLink, error: shareLinkError } = await admin
    .from("presentation_share_links")
    .select(`
      expires_at,
      revoked_at,
      presentation:presentations(status, revoked_at, archived_at, expires_at, snapshot),
      version:presentation_versions(snapshot)
    `)
    .eq("public_token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (shareLinkError && !isMissingSchemaError(shareLinkError)) throw shareLinkError;

  const linkedPresentation = Array.isArray(shareLink?.presentation) ? shareLink?.presentation[0] : shareLink?.presentation;
  const linkedVersion = Array.isArray(shareLink?.version) ? shareLink?.version[0] : shareLink?.version;
  if (
    shareLink &&
    (!shareLink.expires_at || new Date(shareLink.expires_at).getTime() > Date.now()) &&
    linkedPresentation &&
    ["published", "sent"].includes(String(linkedPresentation.status)) &&
    !linkedPresentation.revoked_at &&
    !linkedPresentation.archived_at &&
    (!linkedPresentation.expires_at || new Date(linkedPresentation.expires_at).getTime() > Date.now())
  ) {
    return privateMediaMapFromSnapshot(linkedVersion?.snapshot ?? linkedPresentation.snapshot);
  }

  const { data, error } = await admin
    .from("presentations")
    .select("snapshot")
    .eq("public_token_hash", tokenHash)
    .in("status", ["published", "sent"])
    .is("revoked_at", null)
    .is("archived_at", null)
    .maybeSingle();

  if (error) throw error;

  return privateMediaMapFromSnapshot(data?.snapshot);
}

function privateMediaMapFromSnapshot(snapshotValue: unknown) {
  const snapshot = (snapshotValue ?? {}) as {
    models?: Array<{
      media?: Array<{
        public_media_key?: string | null;
        storage_bucket?: string | null;
        storage_path?: string | null;
        thumbnail_path?: string | null;
      }>;
    }>;
  };

  const refs: Record<
    string,
    {
      storage_bucket?: string | null;
      storage_path?: string | null;
      thumbnail_path?: string | null;
    }
  > = {};

  for (const model of snapshot.models ?? []) {
    for (const media of model.media ?? []) {
      if (media.public_media_key) refs[media.public_media_key] = media;
    }
  }

  return refs;
}

export async function findUpdateRequestByToken(token: string, ipHash?: string) {
  const supabase = createAdminClient();
  const tokenHash = sha256(token);
  if (ipHash) {
    const allowed = await checkCommunicationRateLimit({
      ipHash,
      operation: "update_open",
      tokenHash
    });
    if (!allowed) return null;
  }
  const { data, error } = await supabase.rpc("get_public_model_update_request_by_token", {
    p_token_hash: tokenHash
  });

  if (error && isMissingSchemaError(error)) return null;
  if (error) throw error;

  if (data && !["submitted", "review_required"].includes(String(data.status))) {
    await supabase.rpc("mark_model_update_request_opened", { p_token_hash: tokenHash });
  }

  return data as PublicModelUpdateRequestPayload | null;
}

export async function startUpdateRequestByToken(token: string, ipHash?: string) {
  if (ipHash) {
    const allowed = await checkCommunicationRateLimit({
      ipHash,
      operation: "update_start",
      tokenHash: sha256(token)
    });
    if (!allowed) throw new Error("Rate limit exceeded");
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("start_model_update_request", {
    p_token_hash: sha256(token)
  });
  if (error) throw error;
  if (!data) throw new Error("Update request cannot be started.");
}

export async function saveUpdateRequestDraftByToken(token: string, draft: Record<string, unknown>, ipHash?: string) {
  if (ipHash) {
    const allowed = await checkCommunicationRateLimit({
      ipHash,
      operation: "update_autosave",
      tokenHash: sha256(token)
    });
    if (!allowed) throw new Error("Rate limit exceeded");
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("save_model_update_request_draft", {
    draft,
    p_token_hash: sha256(token)
  });
  if (error) throw error;
  if (!data) throw new Error("Update request draft cannot be saved.");
}

export async function submitUpdateRequestByToken(token: string, submission: Record<string, unknown>, ipHash?: string) {
  if (ipHash) {
    const allowed = await checkCommunicationRateLimit({
      ipHash,
      operation: "update_submit",
      tokenHash: sha256(token)
    });
    if (!allowed) throw new Error("Rate limit exceeded");
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("submit_model_update_request", {
    p_token_hash: sha256(token),
    submission
  });
  if (error) throw error;
  if (!data) throw new Error("Update request cannot be submitted.");
}

export function createPublicToken() {
  const token = randomToken(32);
  return { hash: sha256(token), token };
}

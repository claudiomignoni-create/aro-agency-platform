import { isMissingSchemaError } from "@/lib/accounting-schema";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("presentations")
    .select("id, title, description, language, status, expires_at, snapshot, allow_downloads")
    .eq("public_token_hash", sha256(token))
    .maybeSingle();

  if (error && isMissingSchemaError(error)) return null;
  if (error) throw error;

  return data;
}

export async function findUpdateRequestByToken(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("model_update_requests")
    .select("id, model_id, title, message, language, status, expires_at, due_at, verification_required")
    .eq("public_token_hash", sha256(token))
    .maybeSingle();

  if (error && isMissingSchemaError(error)) return null;
  if (error) throw error;

  return data;
}

export function createPublicToken() {
  const token = randomToken(32);
  return { hash: sha256(token), token };
}

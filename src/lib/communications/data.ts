import { isMissingSchemaError } from "@/lib/accounting-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkCommunicationRateLimit } from "@/lib/communications/rate-limit";
import { randomToken, sha256 } from "@/lib/communications/security";
import {
  buildPresentationOperationalSummaries,
  type PresentationOperationalMetric
} from "@/lib/communications/presentation-operational-summary";

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
  is_active: boolean;
  is_default: boolean;
  language: string;
  name: string;
  subject: string;
  updated_at: string;
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

export type PresentationOperationalSummary = Presentation & {
  last_delivery_at: string | null;
  model_count: number | null;
  recipient_count: number | null;
  selection_count: number | null;
};

export type PresentationMetric = PresentationOperationalMetric;

export type PresentationOperationalSummaryResult = {
  presentations: PresentationOperationalSummary[];
  unavailableMetrics: PresentationMetric[];
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
  link?: {
    expires_at?: string | null;
    recipient_name?: string | null;
    state?: PublicPresentationLinkStatus;
  };
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
      categories?: string[];
      city?: string | null;
      country?: string | null;
      display_name: string;
      eye_color?: string | null;
      gender?: string | null;
      hair_color?: string | null;
      highlighted?: boolean;
      id?: string;
      instagram?: string | null;
      main_image_path?: string | null;
      measurements?: Record<string, number | string | null>;
      nationality?: string | null;
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

export type PublicPresentationDecision = "yes" | "maybe" | "no";
export type PublicPresentationLinkStatus = "active" | "expired" | "invalid" | "not_published" | "revoked";

export type PublicPresentationLinkState = {
  expires_at: string | null;
  recipient_name: string | null;
  schema_ready: boolean;
  selection: {
    client_note: string | null;
    decisions: Record<string, PublicPresentationDecision>;
    submitted_at: string | null;
  };
  state: PublicPresentationLinkStatus;
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
    .select("id, name, category, language, subject, body_html, body_text, is_default, is_active, updated_at")
    .eq("is_active", true)
    .order("category", { ascending: true });

  if (error && isMissingSchemaError(error)) return [];
  if (error) throw error;

  return (data ?? []) as EmailTemplate[];
}

export async function getEmailTemplate(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("id, name, category, language, subject, body_html, body_text, is_default, is_active, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error && isMissingSchemaError(error)) return null;
  if (error) throw error;

  return data as EmailTemplate | null;
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

export async function listPresentationOperationalSummaries() {
  const supabase = await createClient();
  const { data: presentationRows, error: presentationError } = await supabase
    .from("presentations")
    .select("id, title, description, language, status, created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  if (presentationError) {
    console.error("[presentations:list]", {
      code: presentationError.code ?? "unknown",
      reference: "PRES-LIST-001"
    });
    throw new Error("PRES-LIST-001");
  }

  const presentations = (presentationRows ?? []) as Presentation[];
  if (!presentations.length) {
    return {
      presentations: [],
      unavailableMetrics: []
    } satisfies PresentationOperationalSummaryResult;
  }

  const presentationIds = presentations.map((presentation) => presentation.id);
  const metrics = {
    models: () =>
      supabase
        .from("presentation_models")
        .select("presentation_id")
        .in("presentation_id", presentationIds)
        .limit(2000),
    recipients: () =>
      supabase
        .from("presentation_recipients")
        .select("presentation_id")
        .in("presentation_id", presentationIds)
        .limit(2000),
    deliveries: () =>
      supabase
        .from("outbound_emails")
        .select("presentation_id, created_at")
        .in("presentation_id", presentationIds)
        .order("created_at", { ascending: false })
        .limit(2000),
    selections: () =>
      supabase
        .from("presentation_model_selections")
        .select("presentation_id")
        .in("presentation_id", presentationIds)
        .limit(2000)
  };
  const metricEntries = Object.entries(metrics) as Array<
    [PresentationMetric, () => PromiseLike<{ data: unknown[] | null; error: { code?: string } | null }>]
  >;
  const settledMetrics = await Promise.allSettled(
    metricEntries.map(async ([metric, query]) => {
      const result = await query();
      if (result.error) {
        throw {
          code: result.error.code ?? "unknown",
          metric
        };
      }
      return { data: result.data ?? [], metric };
    })
  );
  const metricRows = new Map<PresentationMetric, unknown[]>();
  const unavailableMetrics: PresentationMetric[] = [];

  settledMetrics.forEach((result, index) => {
    const metric = metricEntries[index][0];
    if (result.status === "fulfilled") {
      metricRows.set(metric, result.value.data);
      return;
    }

    unavailableMetrics.push(metric);
    const code =
      result.reason && typeof result.reason === "object" && "code" in result.reason
        ? String(result.reason.code)
        : "unknown";
    console.error("[presentations:metric]", {
      code,
      metric,
      reference: `PRES-METRIC-${metric.toUpperCase()}`
    });
  });

  return {
    presentations: buildPresentationOperationalSummaries(
      presentations,
      {
        deliveries: (metricRows.get("deliveries") ?? []) as Array<{
          created_at: string;
          presentation_id: string | null;
        }>,
        models: (metricRows.get("models") ?? []) as Array<{
          presentation_id: string | null;
        }>,
        recipients: (metricRows.get("recipients") ?? []) as Array<{
          presentation_id: string | null;
        }>,
        selections: (metricRows.get("selections") ?? []) as Array<{
          presentation_id: string | null;
        }>
      },
      unavailableMetrics
    ),
    unavailableMetrics
  } satisfies PresentationOperationalSummaryResult;
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

function isMissingPresentationSelectionSchemaError(error: unknown) {
  if (isMissingSchemaError(error)) return true;
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === "PGRST202" ||
    /get_public_presentation_link_state|presentation_selection_responses|presentation_model_selections/i.test(
      maybeError.message ?? ""
    )
  );
}

export async function findPresentationLinkState(token: string): Promise<PublicPresentationLinkState | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_public_presentation_link_state", {
    p_token_hash: sha256(token)
  });

  if (error && isMissingPresentationSelectionSchemaError(error)) return null;
  if (error) throw error;

  const value = (data ?? {}) as Partial<PublicPresentationLinkState>;
  return {
    expires_at: value.expires_at ?? null,
    recipient_name: value.recipient_name ?? null,
    schema_ready: true,
    selection: {
      client_note: value.selection?.client_note ?? null,
      decisions: value.selection?.decisions ?? {},
      submitted_at: value.selection?.submitted_at ?? null
    },
    state: value.state ?? "invalid"
  };
}

export async function savePresentationModelDecision({
  decision,
  publicModelKey,
  token
}: {
  decision: PublicPresentationDecision;
  publicModelKey: string;
  token: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("save_public_presentation_model_decision", {
    p_decision: decision,
    p_public_model_key: publicModelKey,
    p_token_hash: sha256(token)
  });

  if (error) throw error;
  return data as { decision: PublicPresentationDecision; public_model_key: string; submitted_at: null };
}

export async function submitPresentationSelection({ note, token }: { note: string | null; token: string }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("submit_public_presentation_selection", {
    p_client_note: note,
    p_token_hash: sha256(token)
  });

  if (error) throw error;
  return data as { decision_count: number; submitted_at: string };
}

export async function recordPresentationEvent({
  eventType,
  publicModelKey,
  section,
  token
}: {
  eventType: "file_downloaded" | "model_viewed" | "presentation_viewed" | "section_viewed";
  publicModelKey?: string | null;
  section?: "book" | "digitals" | "downloads" | "overview" | "video" | null;
  token: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("record_public_presentation_event", {
    p_event_type: eventType,
    p_public_model_key: publicModelKey ?? null,
    p_section: section ?? null,
    p_token_hash: sha256(token)
  });

  if (error && isMissingPresentationSelectionSchemaError(error)) return false;
  if (error) throw error;
  return Boolean(data);
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
    .select("expires_at, snapshot")
    .eq("public_token_hash", tokenHash)
    .in("status", ["published", "sent"])
    .is("revoked_at", null)
    .is("archived_at", null)
    .maybeSingle();

  if (error) throw error;
  if (data?.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return {};

  return privateMediaMapFromSnapshot(data?.snapshot);
}

export async function getPresentationPrivateMediaRefByToken(token: string, publicMediaKey: string) {
  const refs = await getPresentationPrivateMediaRefsByToken(token);
  return refs[publicMediaKey] ?? null;
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

import { isMissingSchemaError } from "@/lib/accounting-schema";
import { requireRole } from "@/lib/auth";
import { createModelMainImageUrlsByIds } from "@/lib/models";
import { createClient } from "@/lib/supabase/server";

export const emailCenterPeriodOptions = [
  { label: "Hoje", value: "today" },
  { label: "Últimos 7 dias", value: "7d" },
  { label: "Este mês", value: "month" },
  { label: "Últimos 30 dias", value: "30d" },
  { label: "Este ano", value: "year" },
  { label: "Personalizado", value: "custom" }
] as const;

export type EmailCenterPeriodKey = (typeof emailCenterPeriodOptions)[number]["value"];

export type EmailCenterPeriod = {
  end: string;
  endDate: string;
  key: EmailCenterPeriodKey;
  label: string;
  start: string;
  startDate: string;
};

export type EmailCenterMetric = {
  current: number;
  previous: number;
};

export type EmailActivityStatus =
  | "sent"
  | "scheduled"
  | "opened"
  | "viewed"
  | "replied"
  | "draft"
  | "failed"
  | "pending"
  | "completed";

export type EmailCenterActivity = {
  href: string;
  id: string;
  kind: "email" | "presentation" | "model_update";
  occurred_at: string;
  recipient: string;
  sender: string;
  status: EmailActivityStatus;
  subtitle: string;
  title: string;
};

export type EmailPerformanceSegment = {
  count: number;
  key: "opened" | "unopened" | "failed" | "pending";
  label: string;
};

export type EmailCenterFeatured = {
  access_count: number;
  body_excerpt: string | null;
  href: string;
  id: string;
  model_count: number;
  models: Array<{
    id: string | null;
    image_url?: string | null;
    name: string;
  }>;
  recipient: string;
  sent_at: string;
  status: EmailActivityStatus;
  subject: string;
};

export type EmailCenterTopModel = {
  id: string | null;
  image_url?: string | null;
  name: string;
  presentation_count: number;
  recipient_count: number;
};

export type EmailCenterDashboard = {
  activity: EmailCenterActivity[];
  featured: EmailCenterFeatured | null;
  metrics: {
    emails_sent: EmailCenterMetric;
    models_presented: EmailCenterMetric;
    presentations_sent: EmailCenterMetric;
    responses: {
      available: false;
      current: null;
      previous: null;
    };
  };
  performance: {
    segments: EmailPerformanceSegment[];
    total: number;
  };
  queue: {
    failed: number;
    pending: number;
    scheduled: number;
  };
  ready: boolean;
  schema_message?: string;
  top_models: EmailCenterTopModel[];
};

export type EmailCenterListItem = {
  attempt_count: number;
  created_at: string;
  error_message_sanitized: string | null;
  failed_at: string | null;
  gmail_draft_id: string | null;
  id: string;
  mode: string;
  next_attempt_at: string | null;
  presentation_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  status: string;
  subject: string;
  updated_at: string;
};

export type EmailCenterDetail = EmailCenterListItem & {
  body_excerpt: string | null;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  model_update_request: {
    id: string;
    status: string;
    title: string;
  } | null;
  presentation: {
    id: string;
    status: string;
    title: string;
  } | null;
  recipient: {
    id: string;
    opened_at: string | null;
    sent_at: string | null;
  } | null;
  sender_email: string | null;
  share_link: {
    expires_at: string | null;
    id: string;
    revoked_at: string | null;
  } | null;
  events: Array<{
    event_type: string;
    id: string;
    occurred_at: string;
  }>;
};

export type EmailRecipientOption = {
  category: "agency" | "agency_contact" | "client" | "client_contact" | "manual" | "model";
  email: string;
  id: string;
  name: string;
  organization: string | null;
};

type PeriodSearchParams = {
  end?: string;
  period?: string;
  start?: string;
};

type DashboardRpcPayload = Omit<EmailCenterDashboard, "ready">;

const saoPauloTimeZone = "America/Sao_Paulo";
const dayMs = 24 * 60 * 60 * 1000;

function datePartsInSaoPaulo(date: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: saoPauloTimeZone,
      year: "numeric"
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );

  return {
    day: Number(values.day),
    month: Number(values.month),
    year: Number(values.year)
  };
}

function dateKey(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function saoPauloMidnight(value: string) {
  return new Date(`${value}T00:00:00-03:00`);
}

function addDays(value: string, days: number) {
  const date = saoPauloMidnight(value);
  const shifted = new Date(date.getTime() + days * dayMs);
  const parts = datePartsInSaoPaulo(shifted);
  return dateKey(parts.year, parts.month, parts.day);
}

function validDateKey(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = saoPauloMidnight(value);
  return Number.isNaN(parsed.getTime()) ? null : value;
}

export function resolveEmailCenterPeriod(
  params: PeriodSearchParams = {},
  now = new Date()
): EmailCenterPeriod {
  const current = datePartsInSaoPaulo(now);
  const today = dateKey(current.year, current.month, current.day);
  const requested = emailCenterPeriodOptions.some((option) => option.value === params.period)
    ? (params.period as EmailCenterPeriodKey)
    : "month";
  let startDate = today;
  let endDate = addDays(today, 1);

  if (requested === "7d") {
    startDate = addDays(today, -6);
  } else if (requested === "30d") {
    startDate = addDays(today, -29);
  } else if (requested === "month") {
    startDate = dateKey(current.year, current.month, 1);
    const nextMonth = new Date(Date.UTC(current.year, current.month, 1));
    endDate = dateKey(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 1);
  } else if (requested === "year") {
    startDate = dateKey(current.year, 1, 1);
    endDate = dateKey(current.year + 1, 1, 1);
  } else if (requested === "custom") {
    const customStart = validDateKey(params.start);
    const customEnd = validDateKey(params.end);
    if (customStart && customEnd && customStart <= customEnd) {
      startDate = customStart;
      endDate = addDays(customEnd, 1);
    }
  }

  const option = emailCenterPeriodOptions.find((item) => item.value === requested);
  return {
    end: saoPauloMidnight(endDate).toISOString(),
    endDate: addDays(endDate, -1),
    key: requested,
    label: option?.label ?? "Este mês",
    start: saoPauloMidnight(startDate).toISOString(),
    startDate
  };
}

export function emptyEmailCenterDashboard(message?: string): EmailCenterDashboard {
  return {
    activity: [],
    featured: null,
    metrics: {
      emails_sent: { current: 0, previous: 0 },
      models_presented: { current: 0, previous: 0 },
      presentations_sent: { current: 0, previous: 0 },
      responses: { available: false, current: null, previous: null }
    },
    performance: {
      segments: [
        { count: 0, key: "opened", label: "Apresentação aberta" },
        { count: 0, key: "unopened", label: "Link ainda não aberto" },
        { count: 0, key: "failed", label: "Falha de envio" },
        { count: 0, key: "pending", label: "Agendado ou pendente" }
      ],
      total: 0
    },
    queue: { failed: 0, pending: 0, scheduled: 0 },
    ready: !message,
    schema_message: message,
    top_models: []
  };
}

function missingEmailCenterSchema(error: unknown) {
  return (
    isMissingSchemaError(error) ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "PGRST202")
  );
}

function payloadArray<T>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeDashboardPayload(value: unknown): DashboardRpcPayload {
  const payload = (value ?? {}) as Partial<DashboardRpcPayload>;
  const fallback = emptyEmailCenterDashboard();

  return {
    activity: payloadArray<EmailCenterActivity>(payload.activity),
    featured: payload.featured ?? null,
    metrics: {
      emails_sent: payload.metrics?.emails_sent ?? fallback.metrics.emails_sent,
      models_presented: payload.metrics?.models_presented ?? fallback.metrics.models_presented,
      presentations_sent:
        payload.metrics?.presentations_sent ?? fallback.metrics.presentations_sent,
      responses: fallback.metrics.responses
    },
    performance: {
      segments: payloadArray<EmailPerformanceSegment>(payload.performance?.segments),
      total: Number(payload.performance?.total ?? 0)
    },
    queue: payload.queue ?? fallback.queue,
    schema_message: payload.schema_message,
    top_models: payloadArray<EmailCenterTopModel>(payload.top_models)
  };
}

export async function getEmailCenterDashboard(period: EmailCenterPeriod) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_email_center_dashboard", {
    p_period_end: period.end,
    p_period_start: period.start
  });

  if (error && missingEmailCenterSchema(error)) {
    return emptyEmailCenterDashboard(
      "O dashboard será ativado após a aplicação segura da migration 025."
    );
  }
  if (error) throw error;

  const normalized = normalizeDashboardPayload(data);
  const modelIds = Array.from(
    new Set(
      [
        ...normalized.top_models.map((model) => model.id),
        ...(normalized.featured?.models.map((model) => model.id) ?? [])
      ].filter((id): id is string => Boolean(id))
    )
  );
  let imageUrls: Record<string, string> = {};
  try {
    imageUrls = await createModelMainImageUrlsByIds(modelIds);
  } catch {
    imageUrls = {};
  }

  return {
    ...normalized,
    featured: normalized.featured
      ? {
          ...normalized.featured,
          models: normalized.featured.models.map((model) => ({
            ...model,
            image_url: model.id ? imageUrls[model.id] ?? null : null
          }))
        }
      : null,
    ready: true,
    top_models: normalized.top_models.map((model) => ({
      ...model,
      image_url: model.id ? imageUrls[model.id] ?? null : null
    }))
  } satisfies EmailCenterDashboard;
}

export async function listEmailCenterEmails({
  page = 1,
  statuses
}: {
  page?: number;
  statuses?: string[];
} = {}) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const pageSize = 40;
  const safePage = Math.max(1, Math.floor(page));
  let query = supabase
    .from("outbound_emails")
    .select(
      "id, recipient_name, recipient_email, subject, status, mode, gmail_draft_id, attempt_count, scheduled_at, sent_at, failed_at, error_message_sanitized, presentation_id, created_at, updated_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((safePage - 1) * pageSize, safePage * pageSize - 1);

  if (statuses?.length) query = query.in("status", statuses);
  const { count, data, error } = await query;
  if (error && missingEmailCenterSchema(error)) return { items: [], page: safePage, total: 0 };
  if (error) throw error;

  return {
    items: (data ?? []).map((item) => ({
      ...item,
      next_attempt_at:
        item.status === "retry_pending" && item.scheduled_at ? item.scheduled_at : null
    })) as EmailCenterListItem[],
    page: safePage,
    total: count ?? 0
  };
}

export async function getEmailCenterDetail(id: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outbound_emails")
    .select(`
      id,
      recipient_name,
      recipient_email,
      subject,
      body_text,
      status,
      mode,
      scheduled_at,
      gmail_message_id,
      gmail_thread_id,
      gmail_draft_id,
      attempt_count,
      sent_at,
      failed_at,
      error_message_sanitized,
      presentation_id,
      model_update_request_id,
      presentation_share_link_id,
      sender_connection_id,
      created_at,
      updated_at
    `)
    .eq("id", id)
    .maybeSingle();

  if (error && missingEmailCenterSchema(error)) return null;
  if (error) throw error;
  if (!data) return null;

  const [presentationResult, updateResult, shareResult, recipientResult, senderResult, eventResult] =
    await Promise.all([
      data.presentation_id
        ? supabase
            .from("presentations")
            .select("id, title, status")
            .eq("id", data.presentation_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      data.model_update_request_id
        ? supabase
            .from("model_update_requests")
            .select("id, title, status")
            .eq("id", data.model_update_request_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      data.presentation_share_link_id
        ? supabase
            .from("presentation_share_links")
            .select("id, expires_at, revoked_at")
            .eq("id", data.presentation_share_link_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("presentation_recipients")
        .select("id, sent_at, opened_at")
        .eq("outbound_email_id", id)
        .maybeSingle(),
      data.sender_connection_id
        ? supabase
            .from("google_workspace_connections")
            .select("connected_email")
            .eq("id", data.sender_connection_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      data.presentation_id
        ? supabase
            .from("presentation_access_events")
            .select("id, event_type, occurred_at")
            .eq("presentation_id", data.presentation_id)
            .order("occurred_at", { ascending: false })
            .limit(80)
        : Promise.resolve({ data: [], error: null })
    ]);

  for (const result of [
    presentationResult,
    updateResult,
    shareResult,
    recipientResult,
    senderResult,
    eventResult
  ]) {
    if (result.error) throw result.error;
  }

  const safeExcerpt =
    data.subject === "ARO — Código de verificação"
      ? null
      : data.body_text
          ?.replace(/https?:\/\/\S+/gi, "[link protegido]")
          .replace(/\b\d{6}\b/g, "[código protegido]")
          .slice(0, 360) ?? null;

  return {
    attempt_count: data.attempt_count,
    body_excerpt: safeExcerpt,
    created_at: data.created_at,
    error_message_sanitized: data.error_message_sanitized,
    events: eventResult.data ?? [],
    failed_at: data.failed_at,
    gmail_draft_id: data.gmail_draft_id,
    gmail_message_id: data.gmail_message_id,
    gmail_thread_id: data.gmail_thread_id,
    id: data.id,
    mode: data.mode,
    model_update_request: updateResult.data,
    next_attempt_at:
      data.status === "retry_pending" && data.scheduled_at ? data.scheduled_at : null,
    presentation: presentationResult.data,
    presentation_id: data.presentation_id,
    recipient: recipientResult.data,
    recipient_email: data.recipient_email,
    recipient_name: data.recipient_name,
    scheduled_at: data.scheduled_at,
    sender_email: senderResult.data?.connected_email ?? null,
    sent_at: data.sent_at,
    share_link: shareResult.data,
    status: data.status,
    subject: data.subject,
    updated_at: data.updated_at
  } satisfies EmailCenterDetail;
}

export async function listEmailRecipientOptions() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const [modelsResult, clientsResult, contactsResult, agenciesResult, agencyContactsResult] =
    await Promise.all([
      supabase
        .from("models")
        .select("id, display_name, stage_name, email")
        .not("email", "is", null)
        .neq("status", "archived")
        .limit(100),
      supabase
        .from("clients")
        .select("id, company_name, contact_name, email, general_email, status")
        .neq("status", "do_not_contact")
        .limit(100),
      supabase
        .from("client_contacts")
        .select("id, contact_name, email, client:clients(company_name)")
        .eq("can_receive_emails", true)
        .not("email", "is", null)
        .limit(100),
      supabase
        .from("partner_agencies")
        .select("id, display_name, primary_email, status")
        .in("status", ["active", "prospect"])
        .not("primary_email", "is", null)
        .limit(100),
      supabase
        .from("partner_agency_contacts")
        .select("id, full_name, email, agency:partner_agencies(display_name)")
        .not("email", "is", null)
        .limit(100)
    ]);

  const results = [
    modelsResult,
    clientsResult,
    contactsResult,
    agenciesResult,
    agencyContactsResult
  ];
  for (const result of results) {
    if (result.error && !missingEmailCenterSchema(result.error)) throw result.error;
  }

  const options: EmailRecipientOption[] = [];
  for (const model of modelsResult.data ?? []) {
    if (!model.email) continue;
    options.push({
      category: "model",
      email: model.email,
      id: `model:${model.id}`,
      name: model.stage_name || model.display_name,
      organization: "ARO Model"
    });
  }
  for (const client of clientsResult.data ?? []) {
    const email = client.general_email || client.email;
    if (!email) continue;
    options.push({
      category: "client",
      email,
      id: `client:${client.id}`,
      name: client.contact_name || client.company_name,
      organization: client.company_name
    });
  }
  for (const contact of contactsResult.data ?? []) {
    if (!contact.email) continue;
    const client = Array.isArray(contact.client) ? contact.client[0] : contact.client;
    options.push({
      category: "client_contact",
      email: contact.email,
      id: `client-contact:${contact.id}`,
      name: contact.contact_name,
      organization: client?.company_name ?? null
    });
  }
  for (const agency of agenciesResult.data ?? []) {
    if (!agency.primary_email) continue;
    options.push({
      category: "agency",
      email: agency.primary_email,
      id: `agency:${agency.id}`,
      name: agency.display_name,
      organization: agency.display_name
    });
  }
  for (const contact of agencyContactsResult.data ?? []) {
    if (!contact.email) continue;
    const agency = Array.isArray(contact.agency) ? contact.agency[0] : contact.agency;
    options.push({
      category: "agency_contact",
      email: contact.email,
      id: `agency-contact:${contact.id}`,
      name: contact.full_name,
      organization: agency?.display_name ?? null
    });
  }

  return Array.from(
    new Map(
      options
        .filter((option) => option.email.includes("@"))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .map((option) => [option.email.toLowerCase(), option])
    ).values()
  );
}

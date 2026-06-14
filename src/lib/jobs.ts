import { getCurrentProfile, requireRole } from "@/lib/auth";
import { addDays } from "@/lib/calendar";
import { listClientModelProfiles } from "@/lib/models";
import { createClient } from "@/lib/supabase/server";
import type {
  CalendarBlockStatus,
  Client,
  Job,
  JobModel,
  JobModelStatus,
  JobStatus,
  JobType,
  Model,
  ModelCalendarBlock,
  ModelClientProfile,
  ModelResponseStatus
} from "@/types/database";

type ClientSummary = Pick<Client, "id" | "company_name" | "contact_name" | "city" | "country">;

type ModelSummary = Pick<
  Model,
  | "id"
  | "display_name"
  | "stage_name"
  | "current_city"
  | "current_country"
  | "main_image_path"
  | "height_cm"
  | "bust_cm"
  | "waist_cm"
  | "hips_cm"
  | "categories"
>;

export type JobModelWithModel = JobModel & {
  model: ModelSummary | null;
};

export type JobWithRelations = Job & {
  client: ClientSummary | null;
  job_models: JobModelWithModel[];
};

export type ModelAssignment = JobModel & {
  job: Job | null;
};

export type JobInput = {
  address_line: string | null;
  beauty_notes: string | null;
  brand_name: string | null;
  brief: string | null;
  call_time: string | null;
  city: string | null;
  client_budget: number | null;
  client_id: string | null;
  country: string | null;
  date: string;
  end_time: string | null;
  final_amount: number | null;
  food_notes: string | null;
  internal_notes: string | null;
  location_name: string | null;
  model_ids: string[];
  model_must_bring: string | null;
  model_recommendations: string | null;
  project_name: string | null;
  quote_requested: boolean;
  start_time: string;
  styling_notes: string | null;
  transport_notes: string | null;
  type: JobType;
  usage_countries: string[];
  usage_description: string | null;
  usage_scope: string | null;
  usage_term_months: number | null;
};

export type JobFilters = {
  clientId?: string;
  date?: string;
  modelId?: string;
  status?: string;
  type?: string;
};

const jobSelect = `
  *,
  client:clients (
    id,
    company_name,
    contact_name,
    city,
    country
  ),
  job_models (
    id,
    job_id,
    model_id,
    status,
    model_response_status,
    agency_approved_at,
    model_responded_at,
    fee_amount,
    final_amount,
    notes,
    created_at,
    updated_at,
    model:models (
      id,
      display_name,
      stage_name,
      current_city,
      current_country,
      main_image_path,
      height_cm,
      bust_cm,
      waist_cm,
      hips_cm,
      categories
    )
  )
`;

const clientSafeJobSelect = `
  id,
  client_id,
  created_by,
  type,
  status,
  project_name,
  brand_name,
  brief,
  start_at,
  end_at,
  call_time,
  location_name,
  address_line,
  city,
  country,
  usage_term_months,
  usage_description,
  usage_scope,
  usage_countries,
  client_budget,
  agency_fee_percent,
  final_amount,
  quote_requested,
  transport_notes,
  food_notes,
  model_recommendations,
  model_must_bring,
  styling_notes,
  beauty_notes,
  created_at,
  updated_at,
  job_models (
    id,
    job_id,
    model_id,
    status,
    model_response_status,
    agency_approved_at,
    model_responded_at,
    fee_amount,
    final_amount,
    notes,
    created_at,
    updated_at,
    model:models (
      id,
      display_name,
      stage_name,
      current_city,
      current_country,
      main_image_path,
      height_cm,
      bust_cm,
      waist_cm,
      hips_cm,
      categories
    )
  )
`;

const activeCalendarStatuses: CalendarBlockStatus[] = [
  "booker_review",
  "option",
  "agency_approved",
  "waiting_model",
  "accepted",
  "confirmed"
];

const jobStatusToBlockStatus: Record<JobStatus, CalendarBlockStatus> = {
  agency_approved: "agency_approved",
  booker_review: "booker_review",
  canceled: "canceled",
  client_requested: "booker_review",
  completed: "completed",
  confirmed: "confirmed",
  declined: "declined",
  draft: "booker_review",
  model_accepted: "accepted",
  quote_requested: "booker_review",
  waiting_model: "waiting_model"
};

const typeLabels: Record<JobType, string> = {
  casting: "Casting",
  job: "Trabalho",
  manual_block: "Bloqueio de agenda",
  option: "Opção",
  shoot: "Ensaio fotográfico"
};

const missingAgendaSchemaMessage =
  "A estrutura de Agenda + Trabalhos ainda não foi aplicada no banco. Aplique a migration 009_model_calendar_jobs.sql no Supabase.";

export function jobTypeLabel(type: JobType) {
  return typeLabels[type] ?? type;
}

export function jobTitle(job: Pick<Job, "brand_name" | "project_name" | "type">) {
  return (
    job.project_name ||
    job.brand_name ||
    (job.type === "job" ? "Trabalho sem título" : jobTypeLabel(job.type))
  );
}

export function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency"
  }).format(value);
}

export function combineDateAndTime(date: string, time: string | null | undefined) {
  const safeTime = time && /^\d{2}:\d{2}$/.test(time) ? time : "09:00";
  return `${date}T${safeTime}:00-03:00`;
}

export function splitCsv(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function jobInputFromFormData(formData: FormData): JobInput {
  const type = readString(formData, "type") as JobType;
  const quoteRequested = formData.get("quote_requested") === "on";
  const clientBudget = readNumber(formData, "client_budget");

  return {
    address_line: readNullableString(formData, "address_line"),
    beauty_notes: readNullableString(formData, "beauty_notes"),
    brand_name: readNullableString(formData, "brand_name"),
    brief: readNullableString(formData, "brief"),
    call_time: readNullableString(formData, "call_time"),
    city: readNullableString(formData, "city"),
    client_budget: clientBudget,
    client_id: readNullableString(formData, "client_id"),
    country: readNullableString(formData, "country"),
    date: readString(formData, "date") || "2026-06-13",
    end_time: readNullableString(formData, "end_time"),
    final_amount:
      quoteRequested || clientBudget === null
        ? null
        : Number((clientBudget * 1.2).toFixed(2)),
    food_notes: readNullableString(formData, "food_notes"),
    internal_notes: readNullableString(formData, "internal_notes"),
    location_name: readNullableString(formData, "location_name"),
    model_ids: formData.getAll("model_ids").map(String).filter(Boolean),
    model_must_bring: readNullableString(formData, "model_must_bring"),
    model_recommendations: readNullableString(formData, "model_recommendations"),
    project_name: readNullableString(formData, "project_name"),
    quote_requested: quoteRequested,
    start_time: readString(formData, "start_time") || "09:00",
    styling_notes: readNullableString(formData, "styling_notes"),
    transport_notes: readNullableString(formData, "transport_notes"),
    type: type || "job",
    usage_countries: splitCsv(readNullableString(formData, "usage_countries")),
    usage_description: readNullableString(formData, "usage_description"),
    usage_scope: readNullableString(formData, "usage_scope"),
    usage_term_months: readNumber(formData, "usage_term_months")
  };
}

function readString(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function readNullableString(formData: FormData, name: string) {
  const value = readString(formData, name);
  return value.length ? value : null;
}

function readNumber(formData: FormData, name: string) {
  const value = readString(formData, name).replace(",", ".");
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.length ? parsed : null;
}

function isMissingSchemaError(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    Boolean(error?.message && /does not exist|schema cache/i.test(error.message))
  );
}

function assertAgendaSchema(error: { code?: string; message?: string } | null) {
  if (isMissingSchemaError(error)) {
    throw new Error(missingAgendaSchemaMessage);
  }
}

function normalizeJob(data: unknown) {
  const job = data as JobWithRelations;

  return {
    ...job,
    job_models: job.job_models ?? []
  };
}

async function currentClientId() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}

export async function listAdminJobs(filters: JobFilters = {}) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  let query = supabase
    .from("jobs")
    .select(jobSelect)
    .order("start_at", { ascending: true });

  if (filters.clientId) {
    query = query.eq("client_id", filters.clientId);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.type) {
    query = query.eq("type", filters.type);
  }

  if (filters.date) {
    query = query
      .gte("start_at", combineDateAndTime(filters.date, "00:00"))
      .lt("start_at", combineDateAndTime(addDays(filters.date, 1), "00:00"));
  }

  const { data, error } = await query;

  if (isMissingSchemaError(error)) {
    return [];
  }

  if (error) {
    throw error;
  }

  const jobs = ((data ?? []) as unknown[]).map(normalizeJob);

  if (!filters.modelId) {
    return jobs;
  }

  return jobs.filter((job) =>
    job.job_models.some((jobModel) => jobModel.model_id === filters.modelId)
  );
}

export async function getAdminJob(id: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(jobSelect)
    .eq("id", id)
    .maybeSingle();

  if (isMissingSchemaError(error)) {
    return null;
  }

  if (error) {
    throw error;
  }

  return data ? normalizeJob(data) : null;
}

export async function listClientJobs() {
  await requireRole(["client", "admin"]);
  const supabase = await createClient();
  const clientId = await currentClientId();

  if (!clientId) {
    return [];
  }

  const { data, error } = await supabase
    .from("jobs")
    .select(clientSafeJobSelect)
    .eq("client_id", clientId)
    .order("start_at", { ascending: true });

  if (isMissingSchemaError(error)) {
    return [];
  }

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown[]).map(normalizeJob);
}

export async function listModelCalendar(modelId: string) {
  await requireRole(["admin", "model"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("model_calendar_blocks")
    .select("*")
    .eq("model_id", modelId)
    .order("start_at", { ascending: true });

  if (isMissingSchemaError(error)) {
    return [];
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as ModelCalendarBlock[];
}

export async function listCurrentModelCalendar() {
  const profile = await requireRole(["model", "admin"]);
  const supabase = await createClient();
  const { data: model, error: modelError } = await supabase
    .from("models")
    .select("id")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (modelError) {
    throw modelError;
  }

  if (!model) {
    return [];
  }

  return listModelCalendar(model.id);
}

export async function listCurrentModelAssignments() {
  const profile = await requireRole(["model", "admin"]);
  const supabase = await createClient();
  const { data: model, error: modelError } = await supabase
    .from("models")
    .select("id")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (modelError) {
    throw modelError;
  }

  if (!model) {
    return [];
  }

  const { data, error } = await supabase
    .from("job_models")
    .select(
      `
        *,
        job:jobs (
          id,
          client_id,
          created_by,
          type,
          status,
          project_name,
          brand_name,
          brief,
          start_at,
          end_at,
          call_time,
          location_name,
          address_line,
          city,
          country,
          usage_term_months,
          usage_description,
          usage_scope,
          usage_countries,
          client_budget,
          agency_fee_percent,
          final_amount,
          quote_requested,
          transport_notes,
          food_notes,
          model_recommendations,
          model_must_bring,
          styling_notes,
          beauty_notes,
          created_at,
          updated_at
        )
      `
    )
    .eq("model_id", model.id)
    .order("created_at", { ascending: false });

  if (isMissingSchemaError(error)) {
    return [];
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as ModelAssignment[];
}

export async function listClientVisibleModelCalendar(modelId: string) {
  await requireRole(["client", "admin"]);
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("model_calendar_blocks")
    .select("id, model_id, job_id, type, status, start_at, end_at, title, visibility, source, created_at, updated_at")
    .eq("model_id", modelId)
    .in("status", activeCalendarStatuses)
    .order("start_at", { ascending: true });

  if (isMissingSchemaError(error)) {
    return [];
  }

  if (error) {
    throw error;
  }

  return filterPublicBlocks((data ?? []) as ModelCalendarBlock[]);
}

export async function listAvailableModelsByDate(date: string) {
  const models = await listClientModelProfiles();
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("model_calendar_blocks")
    .select("model_id")
    .in("status", activeCalendarStatuses)
    .lt("start_at", combineDateAndTime(addDays(date, 1), "00:00"))
    .or(`end_at.is.null,end_at.gte.${combineDateAndTime(date, "00:00")}`);

  if (isMissingSchemaError(error)) {
    return models;
  }

  if (error) {
    throw error;
  }

  const blockedIds = new Set((data ?? []).map((block) => block.model_id as string));

  return models.filter((model) => !blockedIds.has(model.id));
}

export async function createAdminJob(input: JobInput) {
  const profile = await requireRole(["admin"]);
  return createJobRecord({
    input,
    createdBy: profile.id,
    status: input.type === "manual_block" ? "confirmed" : "booker_review",
    visibility: "model_private"
  });
}

export async function createClientJobRequest(input: JobInput) {
  const profile = await requireRole(["client", "admin"]);
  const clientId = await currentClientId();

  if (!clientId) {
    throw new Error("Cliente nao encontrado para o usuario logado.");
  }

  return createJobRecord({
    input: {
      ...input,
      client_id: clientId
    },
    createdBy: profile.id,
    status: input.quote_requested ? "quote_requested" : "booker_review",
    visibility: "client_limited"
  });
}

async function createJobRecord({
  createdBy,
  input,
  status,
  visibility
}: {
  createdBy: string;
  input: JobInput;
  status: JobStatus;
  visibility: "client_limited" | "model_private";
}) {
  const supabase = await createClient();
  const modelIds = Array.from(new Set(input.model_ids.filter(Boolean)));

  if (modelIds.length === 0) {
    throw new Error("Selecione pelo menos um modelo para criar este evento de agenda.");
  }

  const clientBudget = input.quote_requested ? null : input.client_budget;
  const finalAmount =
    input.final_amount ??
    (clientBudget === null ? null : Number((clientBudget * 1.2).toFixed(2)));
  const startAt = combineDateAndTime(input.date, input.start_time);
  const endAt = input.end_time ? combineDateAndTime(input.date, input.end_time) : null;
  const title =
    input.project_name ||
    input.brand_name ||
    (input.type === "job" ? "Trabalho sem título" : jobTypeLabel(input.type));

  if (endAt && new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    throw new Error(
      "O horário previsto de término deve ser depois do horário de chegada."
    );
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      address_line: input.address_line,
      beauty_notes: input.beauty_notes,
      brand_name: input.brand_name,
      brief: input.brief,
      call_time: startAt,
      city: input.city,
      client_budget: clientBudget,
      client_id: input.client_id,
      country: input.country,
      created_by: createdBy,
      end_at: endAt,
      final_amount: finalAmount,
      food_notes: input.food_notes,
      internal_notes: input.internal_notes,
      location_name: input.location_name,
      model_must_bring: input.model_must_bring,
      model_recommendations: input.model_recommendations,
      project_name: input.project_name,
      quote_requested: input.quote_requested,
      start_at: startAt,
      status,
      styling_notes: input.styling_notes,
      transport_notes: input.transport_notes,
      type: input.type,
      usage_countries: input.usage_countries,
      usage_description: input.usage_description,
      usage_scope: input.usage_scope,
      usage_term_months: input.usage_term_months
    })
    .select("id")
    .single();

  if (jobError) {
    assertAgendaSchema(jobError);
    throw jobError;
  }

  const jobId = job.id as string;

  const jobModelStatus: JobModelStatus =
    input.type === "option" ? "option" : jobStatusToJobModelStatus(status);
  const modelResponseStatus: ModelResponseStatus =
    status === "waiting_model" ? "waiting" : "not_released";

  const { error: modelError } = await supabase.from("job_models").insert(
    modelIds.map((modelId) => ({
      fee_amount: clientBudget,
      final_amount: finalAmount,
      job_id: jobId,
      model_id: modelId,
      model_response_status: modelResponseStatus,
      status: jobModelStatus
    }))
  );

  if (modelError) {
    await supabase.from("jobs").delete().eq("id", jobId);
    assertAgendaSchema(modelError);
    throw modelError;
  }

  const { error: blockError } = await supabase
    .from("model_calendar_blocks")
    .insert(
      modelIds.map((modelId) => ({
        end_at: endAt,
        job_id: jobId,
        model_id: modelId,
        source: "jobs",
        start_at: startAt,
        status: input.type === "option" ? "option" : jobStatusToBlockStatus[status],
        title,
        type: input.type,
        visibility
      }))
    );

  if (blockError) {
    await supabase.from("jobs").delete().eq("id", jobId);
    assertAgendaSchema(blockError);
    throw blockError;
  }

  return { id: jobId };
}

function jobStatusToJobModelStatus(status: JobStatus): JobModelStatus {
  if (status === "confirmed") {
    return "confirmed";
  }

  if (status === "waiting_model") {
    return "waiting_model";
  }

  if (status === "agency_approved") {
    return "agency_approved";
  }

  if (status === "completed") {
    return "completed";
  }

  if (status === "canceled") {
    return "canceled";
  }

  if (status === "declined") {
    return "declined";
  }

  return "booker_review";
}

export async function approveJobForModel(jobId: string, modelId: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: jobModel, error: modelError } = await supabase
    .from("job_models")
    .update({
      agency_approved_at: now,
      model_response_status: "waiting",
      status: "waiting_model"
    })
    .eq("job_id", jobId)
    .eq("model_id", modelId)
    .in("model_response_status", ["not_released", "waiting"])
    .select("id")
    .maybeSingle();

  if (modelError) {
    throw modelError;
  }

  if (!jobModel) {
    throw new Error("Modelo nao encontrado ou trabalho ja respondido.");
  }

  const { error: blockError } = await supabase
    .from("model_calendar_blocks")
    .update({ status: "waiting_model" })
    .eq("job_id", jobId)
    .eq("model_id", modelId);

  if (blockError) {
    throw blockError;
  }

  const { error: jobError } = await supabase
    .from("jobs")
    .update({ status: "waiting_model" })
    .eq("id", jobId);

  if (jobError) {
    throw jobError;
  }
}

export async function updateJobStatus(jobId: string, status: JobStatus) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ status }).eq("id", jobId);

  if (error) {
    throw error;
  }

  const { error: blockError } = await supabase
    .from("model_calendar_blocks")
    .update({ status: jobStatusToBlockStatus[status] })
    .eq("job_id", jobId);

  if (blockError) {
    throw blockError;
  }
}

export async function modelAcceptJob(jobModelId: string) {
  const profile = await requireRole(["model", "admin"]);
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: jobModel, error: findError } = await supabase
    .from("job_models")
    .select("id, job_id, model_id, model:models(user_id)")
    .eq("id", jobModelId)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  const ownerId = (jobModel?.model as { user_id?: string } | null)?.user_id;

  if (!jobModel || (ownerId !== profile.id && profile.role !== "admin")) {
    throw new Error("Solicitacao nao encontrada para este modelo.");
  }

  const { error } = await supabase
    .from("job_models")
    .update({
      model_responded_at: now,
      model_response_status: "accepted",
      status: "accepted"
    })
    .eq("id", jobModelId)
    .eq("model_response_status", "waiting");

  if (error) {
    throw error;
  }

  const { error: blockError } = await supabase
    .from("model_calendar_blocks")
    .update({ status: "accepted" })
    .eq("job_id", jobModel.job_id)
    .eq("model_id", jobModel.model_id);

  if (blockError) {
    throw blockError;
  }
}

export async function modelDeclineJob(jobModelId: string) {
  const profile = await requireRole(["model", "admin"]);
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: jobModel, error: findError } = await supabase
    .from("job_models")
    .select("id, job_id, model_id, model:models(user_id)")
    .eq("id", jobModelId)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  const ownerId = (jobModel?.model as { user_id?: string } | null)?.user_id;

  if (!jobModel || (ownerId !== profile.id && profile.role !== "admin")) {
    throw new Error("Solicitacao nao encontrada para este modelo.");
  }

  const { error } = await supabase
    .from("job_models")
    .update({
      model_responded_at: now,
      model_response_status: "declined",
      status: "declined"
    })
    .eq("id", jobModelId)
    .eq("model_response_status", "waiting");

  if (error) {
    throw error;
  }

  const { error: blockError } = await supabase
    .from("model_calendar_blocks")
    .update({ status: "declined" })
    .eq("job_id", jobModel.job_id)
    .eq("model_id", jobModel.model_id);

  if (blockError) {
    throw blockError;
  }
}

export function publicAvailabilityStatus(
  blocks: ModelCalendarBlock[],
  dateKey: string
) {
  const hasActiveBlock = blocks.some(
    (block) =>
      activeCalendarStatuses.includes(block.status) &&
      block.start_at.slice(0, 10) <= dateKey &&
      (!block.end_at || block.end_at.slice(0, 10) >= dateKey)
  );

  if (!hasActiveBlock) {
    return "Disponivel";
  }

  const hasReview = blocks.some(
    (block) =>
      block.status === "booker_review" &&
      block.start_at.slice(0, 10) <= dateKey &&
      (!block.end_at || block.end_at.slice(0, 10) >= dateKey)
  );

  return hasReview ? "Em analise" : "Indisponivel";
}

export function modelNames(job: JobWithRelations | Pick<JobWithRelations, "job_models">) {
  return job.job_models
    .map((jobModel) => modelDisplayName(jobModel.model))
    .filter(Boolean)
    .join(", ");
}

export function modelDisplayName(
  model: Pick<Model, "display_name" | "stage_name"> | ModelClientProfile | null
) {
  if (!model) {
    return "";
  }

  return model.stage_name || model.display_name || "";
}

export function modelInitials(
  model: Pick<Model, "display_name" | "stage_name"> | ModelClientProfile | null
) {
  return (
    modelDisplayName(model)
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "AR"
  );
}

export function modelLocation(
  model:
    | Pick<Model, "current_city" | "current_country">
    | Pick<ModelClientProfile, "current_city" | "current_country">
    | null
) {
  if (!model) {
    return "";
  }

  return [model.current_city, model.current_country].filter(Boolean).join(", ");
}

export function modelMeasurements(
  model:
    | Pick<Model, "bust_cm" | "height_cm" | "hips_cm" | "waist_cm">
    | Pick<ModelClientProfile, "bust_cm" | "height_cm" | "hips_cm" | "waist_cm">
    | null
) {
  if (!model) {
    return "";
  }

  const measures = [model.bust_cm, model.waist_cm, model.hips_cm]
    .filter(Boolean)
    .join(" / ");

  return [model.height_cm ? `${model.height_cm} cm` : null, measures || null]
    .filter(Boolean)
    .join(" · ");
}

export function countJobsByStatus(jobs: JobWithRelations[], statuses: JobStatus[]) {
  return jobs.filter((job) => statuses.includes(job.status)).length;
}

export function countJobsByType(jobs: JobWithRelations[], types: JobType[]) {
  return jobs.filter((job) => types.includes(job.type)).length;
}

export function filterPublicBlocks(blocks: ModelCalendarBlock[]) {
  return blocks.map((block) => ({
    ...block,
    notes: null,
    title:
      block.status === "booker_review"
        ? "Em analise"
        : activeCalendarStatuses.includes(block.status)
          ? "Indisponivel"
          : "Disponivel"
  }));
}

export type AvailableModel = ModelClientProfile;

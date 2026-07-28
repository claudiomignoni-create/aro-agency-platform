import { requireRole } from "@/lib/auth";
import { isMissingSchemaError } from "@/lib/accounting-schema";
import { createClient } from "@/lib/supabase/server";

type PortalItem = {
  href?: string;
  meta?: string | null;
  title: string;
};

export type ModelPortalData = {
  alerts: PortalItem[];
  completion: number;
  documents: PortalItem[];
  jobs: PortalItem[];
  materials: PortalItem[];
  measurements: PortalItem[];
  model: {
    base_city: string | null;
    base_country: string | null;
    display_name: string;
    email: string | null;
    height_cm: number | null;
    id: string;
    main_image_path: string | null;
    stage_name: string | null;
    updated_at: string;
  } | null;
  payments: PortalItem[];
  requests: PortalItem[];
  travel: PortalItem[];
};

function percent(values: unknown[]) {
  const filled = values.filter((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== "";
  }).length;
  return Math.round((filled / values.length) * 100);
}

function item(title: string, meta?: string | null, href?: string): PortalItem {
  return { href, meta, title };
}

export async function getModelPortalData(): Promise<ModelPortalData> {
  const profile = await requireRole(["model", "admin"]);
  const supabase = await createClient();
  let query = supabase
    .from("models")
    .select("id, display_name, stage_name, email, height_cm, bust_cm, waist_cm, hips_cm, shoe_size, base_city, base_country, main_image_path, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (profile.role === "model") {
    query = query.eq("user_id", profile.id);
  }

  const { data: model, error } = await query.maybeSingle();
  if (error) throw error;

  if (!model) {
    return {
      alerts: [item("Perfil ainda não vinculado", "Fale com a ARO para ativar seu acesso.")],
      completion: 0,
      documents: [],
      jobs: [],
      materials: [],
      measurements: [],
      model: null,
      payments: [],
      requests: [],
      travel: []
    };
  }

  const [mediaResult, jobsResult, travelResult, paymentsResult, requestsResult] = await Promise.allSettled([
    supabase
      .from("model_media")
      .select("id, media_type, title, status, visibility, updated_at")
      .eq("model_id", model.id)
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("job_models")
      .select("status, job:jobs(id, project_name, brand_name, start_at, city, country, status)")
      .eq("model_id", model.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("model_trips")
      .select("id, title, destination_city, destination_country, status, start_date, end_date")
      .eq("model_id", model.id)
      .order("start_date", { ascending: false })
      .limit(8),
    supabase
      .from("model_accounting_entries")
      .select("id, entry_type, status, currency, amount, created_at")
      .eq("model_id", model.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.rpc("get_my_model_update_requests")
  ]);

  const media =
    mediaResult.status === "fulfilled" && !mediaResult.value.error ? mediaResult.value.data ?? [] : [];
  const jobRows =
    jobsResult.status === "fulfilled" && !jobsResult.value.error ? jobsResult.value.data ?? [] : [];
  const tripRows =
    travelResult.status === "fulfilled" && !travelResult.value.error ? travelResult.value.data ?? [] : [];
  const paymentRows =
    paymentsResult.status === "fulfilled" && !paymentsResult.value.error ? paymentsResult.value.data ?? [] : [];
  const requestRows =
    requestsResult.status === "fulfilled" && !requestsResult.value.error
      ? ((requestsResult.value.data ?? []) as Array<{ due_at: string | null; expires_at: string; status: string; title: string }>)
      : [];

  const schemaAlerts = [travelResult, paymentsResult, requestsResult]
    .filter((result) => result.status === "fulfilled" && result.value.error && isMissingSchemaError(result.value.error))
    .map(() => item("Módulo aguardando atualização de banco", "A ARO ativará esta área após migration."));

  return {
    alerts: [
      ...schemaAlerts,
      ...(requestRows as Array<{ status: string; title: string }> )
        .filter((request) => !["submitted", "applied", "canceled", "expired"].includes(request.status))
        .map((request) => item(request.title, "Atualização pendente", "/model/requests"))
    ],
    completion: percent([
      model.email,
      model.height_cm,
      model.bust_cm,
      model.waist_cm,
      model.hips_cm,
      model.shoe_size,
      model.base_city,
      model.base_country,
      media.length
    ]),
    documents: (media as Array<{ media_type: string; status: string; title: string | null }> )
      .filter((entry) => entry.media_type === "document")
      .map((entry) => item(entry.title || "Documento", entry.status)),
    jobs: (jobRows as unknown as Array<{ job: { brand_name: string | null; city: string | null; country: string | null; project_name: string | null; start_at: string; status: string } | Array<{ brand_name: string | null; city: string | null; country: string | null; project_name: string | null; start_at: string; status: string }> | null; status: string }> )
      .map((entry) => {
        const job = Array.isArray(entry.job) ? entry.job[0] : entry.job;
        return item(job?.project_name || job?.brand_name || "Trabalho ARO", job?.start_at ? new Date(job.start_at).toLocaleDateString("pt-BR") : entry.status);
      }),
    materials: (media as Array<{ media_type: string; status: string; title: string | null }> )
      .filter((entry) => entry.media_type !== "document")
      .map((entry) => item(entry.title || entry.media_type, entry.status)),
    measurements: [
      item("Altura", model.height_cm ? `${model.height_cm} cm` : "—"),
      item("Busto", model.bust_cm ? `${model.bust_cm} cm` : "—"),
      item("Cintura", model.waist_cm ? `${model.waist_cm} cm` : "—"),
      item("Quadril", model.hips_cm ? `${model.hips_cm} cm` : "—"),
      item("Sapato", model.shoe_size || "—")
    ],
    model,
    payments: (paymentRows as Array<{ amount: number; currency: string; entry_type: string; status: string }> )
      .map((entry) => item(`${entry.currency} ${entry.amount}`, `${entry.entry_type} · ${entry.status}`)),
    requests: (requestRows as Array<{ due_at: string | null; expires_at: string; status: string; title: string }> )
      .map((entry) => item(entry.title, `${entry.status} · vence ${new Date(entry.due_at ?? entry.expires_at).toLocaleDateString("pt-BR")}`)),
    travel: (tripRows as Array<{ destination_city: string | null; destination_country: string | null; start_date: string; status: string; title: string }> )
      .map((entry) => item(entry.title, `${[entry.destination_city, entry.destination_country].filter(Boolean).join(", ")} · ${entry.status}`))
  };
}

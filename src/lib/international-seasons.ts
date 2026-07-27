import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  InternationalSeasonAlert,
  InternationalSeasonRevenueShare,
  Model,
  ModelInternationalSeason,
  PartnerAgency
} from "@/types/database";

export type InternationalSeasonWithRelations = ModelInternationalSeason & {
  alerts: InternationalSeasonAlert[];
  model: Pick<Model, "id" | "display_name" | "stage_name" | "main_image_path"> | null;
  receiving_agency: Pick<PartnerAgency, "id" | "display_name" | "country" | "city"> | null;
  revenue_shares: InternationalSeasonRevenueShare[];
};

export const activeInternationalSeasonStatuses = [
  "booked",
  "traveling",
  "active",
  "ending_soon"
] as const;

export function isMissingInternationalSeasonsSchemaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };

  return (
    maybeError.code === "PGRST205" ||
    maybeError.code === "42P01" ||
    maybeError.code === "42703" ||
    /model_international_seasons|international_season_|partner_agencies|schema cache|does not exist|Could not find the table/i.test(
      maybeError.message ?? ""
    )
  );
}

export function internationalSeasonStatusLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    active: "Ativa",
    booked: "Reservada",
    canceled: "Cancelada",
    completed: "Concluida",
    ending_soon: "Terminando",
    planned: "Planejada",
    preparing: "Preparando",
    settled: "Fechada",
    settlement_pending: "Fechamento pendente",
    traveling: "Viajando",
    visa_pending: "Visto pendente"
  };

  return labels[value ?? ""] ?? "Planejada";
}

export async function getInternationalSeasonSchemaStatus() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("model_international_seasons").select("id").limit(1);

  if (error && isMissingInternationalSeasonsSchemaError(error)) return { ready: false };
  if (error) throw error;

  return { ready: true };
}

export async function listInternationalSeasons(filters: { activeOnly?: boolean; modelId?: string } = {}) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  let query = supabase
    .from("model_international_seasons")
    .select(
      `
        *,
        model:models(id, display_name, stage_name, main_image_path),
        receiving_agency:partner_agencies!model_international_seasons_receiving_agency_id_fkey(id, display_name, country, city),
        revenue_shares:international_season_revenue_shares(*),
        alerts:international_season_alerts(*)
      `
    )
    .order("contract_start_date", { ascending: false })
    .limit(120);

  if (filters.modelId) query = query.eq("model_id", filters.modelId);
  if (filters.activeOnly) {
    query = query.in("status", activeInternationalSeasonStatuses as unknown as string[]);
  }

  const { data, error } = await query;
  if (error && isMissingInternationalSeasonsSchemaError(error)) return [];
  if (error) throw error;

  return (data ?? []) as unknown as InternationalSeasonWithRelations[];
}

export async function getSeasonForTrip(tripId: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("model_international_seasons")
    .select(
      `
        *,
        model:models(id, display_name, stage_name, main_image_path),
        receiving_agency:partner_agencies!model_international_seasons_receiving_agency_id_fkey(id, display_name, country, city),
        revenue_shares:international_season_revenue_shares(*),
        alerts:international_season_alerts(*)
      `
    )
    .eq("trip_id", tripId)
    .maybeSingle();

  if (error && isMissingInternationalSeasonsSchemaError(error)) return null;
  if (error) throw error;

  return data as unknown as InternationalSeasonWithRelations | null;
}

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  Model,
  ModelInternationalSeason,
  PartnerAgency,
  PartnerAgencyStatus,
  PartnerAgencyType
} from "@/types/database";

export type PartnerAgencyInput = {
  agency_type: PartnerAgencyType;
  city: string | null;
  contact_name: string | null;
  contact_role: string | null;
  country: string | null;
  country_code: string | null;
  default_currency: string | null;
  default_payment_terms_days: number | null;
  display_name: string;
  instagram_url: string | null;
  legal_name: string | null;
  notes: string | null;
  phone: string | null;
  primary_email: string | null;
  secondary_email: string | null;
  state_region: string | null;
  status: PartnerAgencyStatus;
  timezone: string | null;
  website_url: string | null;
  whatsapp: string | null;
};

export type AgencyFilters = {
  q?: string;
  status?: string;
  type?: string;
};

export type AgencySeason = Pick<
  ModelInternationalSeason,
  | "id"
  | "title"
  | "status"
  | "city"
  | "country"
  | "contract_start_date"
  | "contract_end_date"
  | "final_payment_due_date"
  | "trip_id"
> & {
  model: Pick<Model, "id" | "display_name" | "stage_name"> | null;
};

export type AgencyWithSeasons = PartnerAgency & {
  seasons: AgencySeason[];
};

export const agencyTypeOptions: Array<{ label: string; value: PartnerAgencyType }> = [
  { label: "Agencia mae", value: "mother_agency" },
  { label: "Placement", value: "placement_agency" },
  { label: "Receiving agency", value: "receiving_agency" },
  { label: "Parceira", value: "partner_agency" },
  { label: "Scouting partner", value: "scouting_partner" },
  { label: "Direct booking", value: "direct_booking_partner" },
  { label: "Outro", value: "other" }
];

export const agencyStatusOptions: Array<{ label: string; value: PartnerAgencyStatus }> = [
  { label: "Ativa", value: "active" },
  { label: "Prospect", value: "prospect" },
  { label: "Inativa", value: "inactive" },
  { label: "Suspensa", value: "suspended" },
  { label: "Arquivada", value: "archived" }
];

export function isMissingAgenciesSchemaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };

  return (
    maybeError.code === "PGRST205" ||
    maybeError.code === "42P01" ||
    maybeError.code === "42703" ||
    /partner_agencies|model_international_seasons|schema cache|does not exist|Could not find the table/i.test(
      maybeError.message ?? ""
    )
  );
}

export async function getAgenciesSchemaStatus() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("partner_agencies").select("id").limit(1);

  if (error && isMissingAgenciesSchemaError(error)) return { ready: false };
  if (error) throw error;

  return { ready: true };
}

export function agencyTypeLabel(value: string | null | undefined) {
  return agencyTypeOptions.find((option) => option.value === value)?.label ?? "Parceira";
}

export function agencyStatusLabel(value: string | null | undefined) {
  return agencyStatusOptions.find((option) => option.value === value)?.label ?? "Prospect";
}

export async function listPartnerAgencies(filters: AgencyFilters = {}) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  let query = supabase
    .from("partner_agencies")
    .select("*")
    .order("display_name", { ascending: true })
    .limit(150);

  if (filters.status && agencyStatusOptions.some((option) => option.value === filters.status)) {
    query = query.eq("status", filters.status);
  }

  if (filters.type && agencyTypeOptions.some((option) => option.value === filters.type)) {
    query = query.eq("agency_type", filters.type);
  }

  const { data, error } = await query;
  if (error && isMissingAgenciesSchemaError(error)) return [];
  if (error) throw error;

  let agencies = (data ?? []) as PartnerAgency[];
  const search = filters.q?.trim().toLowerCase();
  if (search) {
    agencies = agencies.filter((agency) =>
      [
        agency.display_name,
        agency.legal_name,
        agency.city,
        agency.country,
        agency.primary_email,
        agency.instagram_url,
        agency.website_url
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }

  return agencies;
}

export async function getPartnerAgency(id: string): Promise<AgencyWithSeasons | null> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_agencies")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error && isMissingAgenciesSchemaError(error)) return null;
  if (error) throw error;
  if (!data) return null;

  const { data: seasons, error: seasonsError } = await supabase
    .from("model_international_seasons")
    .select(
      "id, title, status, city, country, contract_start_date, contract_end_date, final_payment_due_date, trip_id, model:models(id, display_name, stage_name)"
    )
    .eq("receiving_agency_id", id)
    .order("contract_start_date", { ascending: false })
    .limit(80);

  if (seasonsError && !isMissingAgenciesSchemaError(seasonsError)) throw seasonsError;

  return {
    ...((data ?? {}) as PartnerAgency),
    seasons: ((seasons ?? []) as unknown as AgencySeason[])
  };
}

export async function createPartnerAgency(input: PartnerAgencyInput) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_agencies")
    .insert({
      ...input,
      country_code: input.country_code?.toUpperCase() ?? null,
      created_by: profile.id,
      updated_by: profile.id
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function updatePartnerAgency(id: string, input: PartnerAgencyInput) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_agencies")
    .update({
      ...input,
      country_code: input.country_code?.toUpperCase() ?? null,
      updated_by: profile.id
    })
    .eq("id", id);

  if (error) throw error;
}

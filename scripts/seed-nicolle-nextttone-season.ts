import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  calculateRevenueShares,
  nicolleNextttOneSeasonDates,
  validateRevenueShareTotal
} from "../src/lib/international-season-utils";

type AnyRecord = Record<string, unknown>;

const REPORT_ROOT = path.join(homedir(), "Documents", "AROLAB-seed-reports");
const NEXTTT_ONE_NAME = "Nexttt One";
const SEASON_TITLE = "Nicolle Cunha — Nexttt One India 2026";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function assertSingleNicolle(rows: AnyRecord[]) {
  const matches = rows.filter((row) => {
    const text = normalize([row.display_name, row.stage_name, row.legal_name].filter(Boolean).join(" "));
    return /\bnicoll?e\b/.test(text) && text.includes("cunha");
  });

  const ids = Array.from(new Set(matches.map((row) => row.id)));
  if (ids.length === 0) {
    throw new Error("Nicolle Cunha/Nicole Cunha was not found. Seed stopped before creating a duplicate.");
  }
  if (ids.length > 1) {
    throw new Error("More than one Nicolle/Nicole Cunha candidate was found. Seed stopped to avoid duplicates.");
  }

  return matches.find((row) => row.id === ids[0])!;
}

async function writeReport(report: AnyRecord) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const directory = path.join(REPORT_ROOT, stamp);
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, "summary.json");
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return file;
}

async function main() {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
  const dates = nicolleNextttOneSeasonDates();

  const { data: modelRows, error: modelError } = await supabase
    .from("models")
    .select("id, display_name, stage_name, legal_name")
    .or("display_name.ilike.%nicolle%,display_name.ilike.%nicole%,stage_name.ilike.%nicolle%,stage_name.ilike.%nicole%,legal_name.ilike.%nicolle%,legal_name.ilike.%nicole%");

  if (modelError) throw modelError;
  const model = assertSingleNicolle(modelRows ?? []);

  const { data: existingAgency, error: agencyLookupError } = await supabase
    .from("partner_agencies")
    .select("id")
    .eq("display_name", NEXTTT_ONE_NAME)
    .eq("country_code", "IN")
    .maybeSingle();

  if (agencyLookupError) throw agencyLookupError;

  const agencyPayload = {
    display_name: NEXTTT_ONE_NAME,
    legal_name: "Nexttt One Talent Management Private Limited",
    agency_type: "receiving_agency",
    status: "active",
    country: "India",
    country_code: "IN",
    city: "New Delhi",
    state_region: "Delhi",
    timezone: "Asia/Kolkata",
    website_url: "https://www.nextttone.com/",
    instagram_url: "https://www.instagram.com/nexttt.one/",
    primary_email: "queries@nextttone.com",
    default_payment_terms_days: 30
  };

  const agencyResult = existingAgency
    ? await supabase
        .from("partner_agencies")
        .update(agencyPayload)
        .eq("id", existingAgency.id)
        .select("id")
        .single()
    : await supabase
        .from("partner_agencies")
        .insert(agencyPayload)
        .select("id")
        .single();

  if (agencyResult.error) throw agencyResult.error;
  const agencyId = agencyResult.data.id as string;

  const { data: existingTrip, error: tripLookupError } = await supabase
    .from("model_trips")
    .select("id")
    .eq("model_id", model.id)
    .eq("title", SEASON_TITLE)
    .maybeSingle();

  if (tripLookupError) throw tripLookupError;

  const tripPayload = {
    agency_name: NEXTTT_ONE_NAME,
    destination_city: "New Delhi",
    destination_country: "India",
    destination_latitude: 28.6139,
    destination_longitude: 77.209,
    ends_on: dates.contractEndDate,
    internal_notes: "Temporada internacional criada por seed idempotente. Dados financeiros, voos, PNR, ticket e documentos pendentes.",
    model_id: model.id,
    origin_city: null,
    origin_country: "Brasil",
    reason: "international_season",
    starts_on: dates.seasonStartDate,
    status: "hosted",
    title: SEASON_TITLE
  };

  const tripResult = existingTrip
    ? await supabase.from("model_trips").update(tripPayload).eq("id", existingTrip.id).select("id").single()
    : await supabase.from("model_trips").insert(tripPayload).select("id").single();

  if (tripResult.error) throw tripResult.error;
  const tripId = tripResult.data.id as string;

  const seasonPayload = {
    accommodation_status: "pending_information",
    city: "New Delhi",
    contract_document_status: "pending_document",
    contract_end_date: dates.contractEndDate,
    contract_reminder_date: dates.twoMonthAlertDate,
    contract_start_date: dates.contractStartDate,
    contract_status: "active",
    country: "India",
    country_code: "IN",
    destination_latitude: 28.6139,
    destination_longitude: 77.209,
    duration_months: 5,
    final_payment_due_date: dates.finalPaymentDueDate,
    final_payment_terms_days: 30,
    gross_earnings: null,
    gross_earnings_currency: null,
    model_amount_due: null,
    model_amount_paid: null,
    model_id: model.id,
    model_share_percentage: 50,
    mother_agency_amount_due: null,
    mother_agency_amount_received: null,
    mother_agency_id: null,
    mother_agency_share_percentage: 10,
    notes: "Valores financeiros, moeda, voos, PNR, ticket, visto e documentos ainda pendentes.",
    outbound_ticket_status: "pending_document",
    payment_status: "pending_calculation",
    receiving_agency_amount_due: null,
    receiving_agency_amount_settled: null,
    receiving_agency_id: agencyId,
    receiving_agency_share_percentage: 40,
    return_ticket_status: "pending_document",
    settlement_status: "open",
    status: "active",
    timezone: "Asia/Kolkata",
    title: SEASON_TITLE,
    trip_id: tripId,
    visa_status: "pending_information"
  };

  const { data: season, error: seasonError } = await supabase
    .from("model_international_seasons")
    .upsert(seasonPayload, {
      onConflict: "model_id,receiving_agency_id,contract_start_date,contract_end_date"
    })
    .select("id")
    .single();

  if (seasonError) throw seasonError;
  const seasonId = season.id as string;

  validateRevenueShareTotal([
    { participantType: "model", percentage: 50 },
    { participantType: "receiving_agency", percentage: 40 },
    { participantType: "mother_agency", percentage: 10 }
  ]);
  const shares = calculateRevenueShares(null, [
    { participantType: "model", percentage: 50 },
    { participantType: "receiving_agency", percentage: 40 },
    { participantType: "mother_agency", percentage: 10 }
  ]);

  const { data: existingShares, error: sharesLookupError } = await supabase
    .from("international_season_revenue_shares")
    .select("id, participant_type, agency_id, model_id, percentage, status")
    .eq("season_id", seasonId);

  if (sharesLookupError) throw sharesLookupError;

  if ((existingShares ?? []).length === 0) {
    const { error: shareInsertError } = await supabase
      .from("international_season_revenue_shares")
      .insert([
        {
          agency_id: null,
          calculated_amount: shares[0].calculatedAmount,
          currency: null,
          model_id: model.id,
          participant_type: "model",
          percentage: 50,
          season_id: seasonId,
          status: "configured"
        },
        {
          agency_id: agencyId,
          calculated_amount: shares[1].calculatedAmount,
          currency: null,
          model_id: null,
          participant_type: "receiving_agency",
          percentage: 40,
          season_id: seasonId,
          status: "configured"
        },
        {
          agency_id: null,
          calculated_amount: shares[2].calculatedAmount,
          currency: null,
          model_id: null,
          participant_type: "mother_agency",
          percentage: 10,
          season_id: seasonId,
          status: "configured"
        }
      ]);

    if (shareInsertError) throw shareInsertError;
  } else {
    const configuredTotal = (existingShares ?? [])
      .filter((share) => share.status !== "void")
      .reduce((total, share) => total + Number(share.percentage ?? 0), 0);
    if (configuredTotal !== 100) {
      throw new Error("Existing season revenue shares do not total 100. Seed stopped before changing finance.");
    }
  }

  const { data: relation, error: relationLookupError } = await supabase
    .from("model_partner_agencies")
    .select("id")
    .eq("model_id", model.id)
    .eq("agency_id", agencyId)
    .eq("relationship_type", "receiving_agency")
    .maybeSingle();

  if (relationLookupError) throw relationLookupError;

  const relationPayload = {
    agency_id: agencyId,
    ends_on: dates.contractEndDate,
    model_id: model.id,
    notes: SEASON_TITLE,
    relationship_type: "receiving_agency",
    starts_on: dates.contractStartDate,
    status: "active"
  };

  const relationResult = relation
    ? await supabase.from("model_partner_agencies").update(relationPayload).eq("id", relation.id)
    : await supabase.from("model_partner_agencies").insert(relationPayload);

  if (relationResult.error) throw relationResult.error;

  const { error: alertError } = await supabase.rpc(
    "generate_international_season_contract_alerts",
    { target_season_id: seasonId }
  );
  if (alertError) throw alertError;

  const { data: alertRows, error: alertLookupError } = await supabase
    .from("international_season_alerts")
    .select("id, alert_type, due_on, title")
    .eq("season_id", seasonId)
    .order("due_on", { ascending: true });

  if (alertLookupError) throw alertLookupError;

  const report = {
    agency: { id: agencyId, name: NEXTTT_ONE_NAME, status: "upserted" },
    alerts: {
      count: alertRows?.length ?? 0,
      contract60TitlePresent: (alertRows ?? []).some(
        (alert) => alert.title === "Contrato de Nicolle Cunha na Nexttt One termina em dois meses."
      )
    },
    model: { id: model.id, name: model.stage_name || model.display_name, status: "existing" },
    season: {
      contractEndDate: dates.contractEndDate,
      contractReminderDate: dates.twoMonthAlertDate,
      contractStartDate: dates.contractStartDate,
      finalPaymentDueDate: dates.finalPaymentDueDate,
      id: seasonId,
      seasonStartDate: dates.seasonStartDate,
      title: SEASON_TITLE
    },
    trip: { id: tripId, status: "upserted" }
  };
  const reportFile = await writeReport(report);

  console.log(`Seed completed. Sanitized report: ${reportFile}`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

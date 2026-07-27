import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { isMissingSchemaError } from "@/lib/accounting-schema";
import { isMissingAgenciesSchemaError } from "@/lib/agencies";
import { createClient } from "@/lib/supabase/server";

type SearchResult = {
  href: string;
  id: string;
  subtitle: string | null;
  title: string;
  type: "model" | "client" | "job" | "agency" | "travel" | "flight";
};

function likeQuery(value: string) {
  return `%${value.replace(/[%_]/g, "")}%`;
}

function compactSubtitle(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" · ") || null;
}

export async function GET(request: Request) {
  await requireRole(["admin"]);
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const supabase = await createClient();

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const pattern = likeQuery(q);
  const [modelsResult, clientsResult, agenciesResult, jobsResult, tripsResult, flightsResult] =
    await Promise.allSettled([
      supabase
        .from("models")
        .select("id, display_name, stage_name, current_city, current_country, nationality")
        .or(
          `display_name.ilike.${pattern},stage_name.ilike.${pattern},legal_name.ilike.${pattern},email.ilike.${pattern},current_city.ilike.${pattern},current_country.ilike.${pattern},nationality.ilike.${pattern}`
        )
        .limit(8),
      supabase
        .from("clients")
        .select("id, company_name, contact_name, client_type, city, country")
        .or(
          `company_name.ilike.${pattern},contact_name.ilike.${pattern},general_email.ilike.${pattern},city.ilike.${pattern},country.ilike.${pattern}`
        )
        .limit(8),
      supabase
        .from("partner_agencies")
        .select("id, display_name, legal_name, agency_type, city, country")
        .or(
          `display_name.ilike.${pattern},legal_name.ilike.${pattern},city.ilike.${pattern},country.ilike.${pattern},primary_email.ilike.${pattern},website_url.ilike.${pattern},instagram_url.ilike.${pattern}`
        )
        .limit(8),
      supabase
        .from("jobs")
        .select("id, project_name, brand_name, type, status, city, country")
        .or(
          `project_name.ilike.${pattern},brand_name.ilike.${pattern},brief.ilike.${pattern},city.ilike.${pattern},country.ilike.${pattern}`
        )
        .limit(8),
      supabase
        .from("model_trips")
        .select("id, title, destination_city, destination_country, status")
        .or(
          `title.ilike.${pattern},destination_city.ilike.${pattern},destination_country.ilike.${pattern},origin_city.ilike.${pattern},origin_country.ilike.${pattern}`
        )
        .limit(6),
      supabase
        .from("travel_flight_segments")
        .select("id, trip_id, airline_name, airline_code, flight_number, departure_iata, arrival_iata, status")
        .or(
          `airline_name.ilike.${pattern},airline_code.ilike.${pattern},flight_number.ilike.${pattern},departure_iata.ilike.${pattern},arrival_iata.ilike.${pattern}`
        )
        .limit(6)
    ]);

  const results: SearchResult[] = [];

  if (modelsResult.status === "fulfilled" && !modelsResult.value.error) {
    for (const model of modelsResult.value.data ?? []) {
      results.push({
        href: `/admin/models/${model.id}/edit`,
        id: `model:${model.id}`,
        subtitle: compactSubtitle([model.current_city, model.current_country, model.nationality]),
        title: model.stage_name || model.display_name,
        type: "model"
      });
    }
  }

  if (clientsResult.status === "fulfilled" && !clientsResult.value.error) {
    for (const client of clientsResult.value.data ?? []) {
      results.push({
        href: `/admin/clients/${client.id}`,
        id: `client:${client.id}`,
        subtitle: compactSubtitle([client.contact_name, client.city, client.country]),
        title: client.company_name,
        type: "client"
      });
    }
  }

  if (agenciesResult.status === "fulfilled" && !agenciesResult.value.error) {
    for (const agency of agenciesResult.value.data ?? []) {
      results.push({
        href: `/admin/agencies/${agency.id}`,
        id: `agency:${agency.id}`,
        subtitle: compactSubtitle([agency.agency_type, agency.city, agency.country]),
        title: agency.display_name,
        type: "agency"
      });
    }
  } else if (
    agenciesResult.status === "fulfilled" &&
    agenciesResult.value.error &&
    !isMissingAgenciesSchemaError(agenciesResult.value.error)
  ) {
    throw agenciesResult.value.error;
  }

  if (jobsResult.status === "fulfilled" && !jobsResult.value.error) {
    for (const job of jobsResult.value.data ?? []) {
      results.push({
        href: `/admin/calendar/${job.id}`,
        id: `job:${job.id}`,
        subtitle: compactSubtitle([job.type, job.status, job.city, job.country]),
        title: job.project_name || job.brand_name || "Job",
        type: "job"
      });
    }
  }

  if (tripsResult.status === "fulfilled" && !tripsResult.value.error) {
    for (const trip of tripsResult.value.data ?? []) {
      results.push({
        href: `/admin/travel/${trip.id}`,
        id: `travel:${trip.id}`,
        subtitle: compactSubtitle([trip.destination_city, trip.destination_country, trip.status]),
        title: trip.title,
        type: "travel"
      });
    }
  } else if (
    tripsResult.status === "fulfilled" &&
    tripsResult.value.error &&
    !isMissingSchemaError(tripsResult.value.error)
  ) {
    throw tripsResult.value.error;
  }

  if (flightsResult.status === "fulfilled" && !flightsResult.value.error) {
    for (const flight of flightsResult.value.data ?? []) {
      results.push({
        href: `/admin/travel/${flight.trip_id}`,
        id: `flight:${flight.id}`,
        subtitle: compactSubtitle([flight.departure_iata, flight.arrival_iata, flight.status]),
        title: [flight.airline_code, flight.flight_number].filter(Boolean).join(" ") || flight.airline_name || "Voo",
        type: "flight"
      });
    }
  } else if (
    flightsResult.status === "fulfilled" &&
    flightsResult.value.error &&
    !isMissingSchemaError(flightsResult.value.error)
  ) {
    throw flightsResult.value.error;
  }

  return NextResponse.json({ results: results.slice(0, 28) });
}

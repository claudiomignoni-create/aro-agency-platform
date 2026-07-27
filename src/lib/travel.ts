import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  FlightSegmentStatus,
  Model,
  ModelTrip,
  TravelFlightSegment,
  TripReason,
  TripStatus
} from "@/types/database";

export type TravelTripWithRelations = ModelTrip & {
  flight_segments: TravelFlightSegment[];
  model: Pick<Model, "id" | "display_name" | "stage_name" | "main_image_path" | "current_city" | "current_country"> | null;
};

export type TravelFilters = {
  airline?: string;
  dateFrom?: string;
  dateTo?: string;
  destination?: string;
  modelId?: string;
  origin?: string;
  q?: string;
  status?: string;
};

export type TravelTripInput = {
  agency_name: string | null;
  destination_city: string | null;
  destination_country: string | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  ends_on: string | null;
  internal_notes: string | null;
  model_id: string;
  origin_city: string | null;
  origin_country: string | null;
  reason: TripReason;
  starts_on: string | null;
  status: TripStatus;
  title: string;
};

export type FlightSegmentInput = {
  airline_code: string | null;
  airline_name: string | null;
  arrival_airport: string | null;
  arrival_at: string | null;
  arrival_city: string | null;
  arrival_country: string | null;
  arrival_iata: string | null;
  arrival_terminal: string | null;
  arrival_timezone: string | null;
  baggage: string | null;
  cabin_class: string | null;
  check_in_url: string | null;
  cost_amount: number | null;
  currency: string | null;
  departure_airport: string | null;
  departure_at: string | null;
  departure_city: string | null;
  departure_country: string | null;
  departure_gate: string | null;
  departure_iata: string | null;
  departure_terminal: string | null;
  departure_timezone: string | null;
  flight_number: string | null;
  internal_notes: string | null;
  pnr: string | null;
  seat: string | null;
  status: FlightSegmentStatus;
  ticket_number: string | null;
};

const travelSelect = `
  *,
  model:models (
    id,
    display_name,
    stage_name,
    main_image_path,
    current_city,
    current_country
  ),
  flight_segments:travel_flight_segments (
    *
  )
`;

export const tripReasonOptions: Array<{ label: string; value: TripReason }> = [
  { label: "Temporada internacional", value: "international_season" },
  { label: "Trabalho", value: "job" },
  { label: "Casting", value: "casting" },
  { label: "Test Shoot", value: "test_shoot" },
  { label: "Retorno", value: "return" },
  { label: "Reunião", value: "meeting" },
  { label: "Outro", value: "other" }
];

export const tripStatusOptions: Array<{ label: string; value: TripStatus }> = [
  { label: "Planejado", value: "planned" },
  { label: "Reservado", value: "booked" },
  { label: "Em trânsito", value: "in_transit" },
  { label: "Chegou", value: "arrived" },
  { label: "Hospedado", value: "hosted" },
  { label: "Concluído", value: "completed" },
  { label: "Cancelado", value: "canceled" }
];

export const flightStatusOptions: Array<{
  label: string;
  value: FlightSegmentStatus;
}> = [
  { label: "Planejado", value: "planned" },
  { label: "Reservado", value: "booked" },
  { label: "Check-in disponível", value: "check_in_open" },
  { label: "Embarque", value: "boarding" },
  { label: "Partiu", value: "departed" },
  { label: "Em voo", value: "in_flight" },
  { label: "Pousou", value: "landed" },
  { label: "Atrasado", value: "delayed" },
  { label: "Cancelado", value: "canceled" }
];

const tripReasons = new Set(tripReasonOptions.map((option) => option.value));
const tripStatuses = new Set(tripStatusOptions.map((option) => option.value));
const flightStatuses = new Set(flightStatusOptions.map((option) => option.value));

export function isMissingTravelSchemaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };

  return (
    maybeError.code === "PGRST205" ||
    maybeError.code === "42P01" ||
    maybeError.code === "42703" ||
    /model_trips|travel_flight_segments|travel_documents|schema cache|does not exist|Could not find the table/i.test(
      maybeError.message ?? ""
    )
  );
}

export function tripReasonLabel(value: string | null | undefined) {
  return tripReasonOptions.find((option) => option.value === value)?.label ?? "Outro";
}

export function tripStatusLabel(value: string | null | undefined) {
  return tripStatusOptions.find((option) => option.value === value)?.label ?? "Planejado";
}

export function flightStatusLabel(value: string | null | undefined) {
  return flightStatusOptions.find((option) => option.value === value)?.label ?? "Planejado";
}

export function safeTripReason(value: string | null | undefined): TripReason {
  return tripReasons.has(value as TripReason) ? (value as TripReason) : "other";
}

export function safeTripStatus(value: string | null | undefined): TripStatus {
  return tripStatuses.has(value as TripStatus) ? (value as TripStatus) : "planned";
}

export function safeFlightStatus(value: string | null | undefined): FlightSegmentStatus {
  return flightStatuses.has(value as FlightSegmentStatus)
    ? (value as FlightSegmentStatus)
    : "planned";
}

export async function getTravelSchemaStatus() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("model_trips").select("id").limit(1);

  if (error && isMissingTravelSchemaError(error)) {
    return { ready: false };
  }

  if (error) throw error;
  return { ready: true };
}

export async function listTravelTrips(filters: TravelFilters = {}) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  let query = supabase
    .from("model_trips")
    .select(travelSelect)
    .order("starts_on", { ascending: true, nullsFirst: false })
    .limit(150);

  if (filters.modelId) query = query.eq("model_id", filters.modelId);
  if (tripStatuses.has(filters.status as TripStatus)) {
    query = query.eq("status", filters.status);
  }
  if (filters.dateFrom) query = query.gte("starts_on", filters.dateFrom);
  if (filters.dateTo) query = query.lte("starts_on", filters.dateTo);
  if (filters.origin) {
    query = query.or(`origin_city.ilike.%${filters.origin}%,origin_country.ilike.%${filters.origin}%`);
  }
  if (filters.destination) {
    query = query.or(
      `destination_city.ilike.%${filters.destination}%,destination_country.ilike.%${filters.destination}%`
    );
  }

  const { data, error } = await query;

  if (error && isMissingTravelSchemaError(error)) return [];
  if (error) throw error;

  let trips = (data ?? []) as TravelTripWithRelations[];
  const search = filters.q?.trim().toLowerCase();

  if (search) {
    trips = trips.filter((trip) =>
      [
        trip.title,
        trip.destination_city,
        trip.destination_country,
        trip.origin_city,
        trip.origin_country,
        trip.agency_name,
        trip.model?.stage_name,
        trip.model?.display_name,
        ...(trip.flight_segments ?? []).flatMap((segment) => [
          segment.airline_name,
          segment.airline_code,
          segment.flight_number,
          segment.departure_iata,
          segment.arrival_iata
        ])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }

  if (filters.airline) {
    const airline = filters.airline.toLowerCase();
    trips = trips.filter((trip) =>
      (trip.flight_segments ?? []).some((segment) =>
        [segment.airline_name, segment.airline_code, segment.flight_number]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(airline)
      )
    );
  }

  return trips;
}

export async function getTravelTrip(id: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("model_trips")
    .select(travelSelect)
    .eq("id", id)
    .maybeSingle();

  if (error && isMissingTravelSchemaError(error)) return null;
  if (error) throw error;

  return data as TravelTripWithRelations | null;
}

export async function createTravelTrip(input: TravelTripInput, segment?: FlightSegmentInput) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("model_trips")
    .insert({ ...input, created_by: profile.id })
    .select("id")
    .single();

  if (error) throw error;

  if (segment && hasFlightSegmentData(segment)) {
    const { error: segmentError } = await supabase
      .from("travel_flight_segments")
      .insert({ ...segment, trip_id: data.id });

    if (segmentError) throw segmentError;
  }

  return data.id as string;
}

export async function updateTravelTrip(
  id: string,
  input: TravelTripInput,
  segment?: FlightSegmentInput
) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("model_trips").update(input).eq("id", id);

  if (error) throw error;

  if (segment && hasFlightSegmentData(segment)) {
    const trip = await getTravelTrip(id);
    const firstSegment = trip?.flight_segments?.[0];
    const segmentPayload = { ...segment, trip_id: id };
    const { error: segmentError } = firstSegment
      ? await supabase
          .from("travel_flight_segments")
          .update(segmentPayload)
          .eq("id", firstSegment.id)
      : await supabase.from("travel_flight_segments").insert(segmentPayload);

    if (segmentError) throw segmentError;
  }
}

function hasFlightSegmentData(segment: FlightSegmentInput) {
  return Boolean(
    segment.airline_name ||
      segment.airline_code ||
      segment.flight_number ||
      segment.pnr ||
      segment.ticket_number ||
      segment.departure_iata ||
      segment.arrival_iata ||
      segment.departure_at ||
      segment.arrival_at
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  nullableNumber,
  nullableString,
  requiredString
} from "@/lib/form-data";
import {
  createTravelTrip,
  safeFlightStatus,
  safeTripReason,
  safeTripStatus,
  updateTravelTrip,
  type FlightSegmentInput,
  type TravelTripInput
} from "@/lib/travel";

function tripInputFromFormData(formData: FormData): TravelTripInput {
  return {
    agency_name: nullableString(formData, "agency_name"),
    destination_city: nullableString(formData, "destination_city"),
    destination_country: nullableString(formData, "destination_country"),
    destination_latitude: nullableNumber(formData, "destination_latitude"),
    destination_longitude: nullableNumber(formData, "destination_longitude"),
    ends_on: nullableString(formData, "ends_on"),
    internal_notes: nullableString(formData, "internal_notes"),
    model_id: requiredString(formData, "model_id"),
    origin_city: nullableString(formData, "origin_city"),
    origin_country: nullableString(formData, "origin_country"),
    reason: safeTripReason(nullableString(formData, "reason")),
    starts_on: nullableString(formData, "starts_on"),
    status: safeTripStatus(nullableString(formData, "status")),
    title: requiredString(formData, "title")
  };
}

function flightInputFromFormData(formData: FormData): FlightSegmentInput {
  return {
    airline_code: nullableString(formData, "airline_code"),
    airline_name: nullableString(formData, "airline_name"),
    arrival_airport: nullableString(formData, "arrival_airport"),
    arrival_at: nullableString(formData, "arrival_at"),
    arrival_city: nullableString(formData, "arrival_city"),
    arrival_country: nullableString(formData, "arrival_country"),
    arrival_iata: nullableString(formData, "arrival_iata"),
    arrival_terminal: nullableString(formData, "arrival_terminal"),
    arrival_timezone: nullableString(formData, "arrival_timezone"),
    baggage: nullableString(formData, "baggage"),
    cabin_class: nullableString(formData, "cabin_class"),
    check_in_url: nullableString(formData, "check_in_url"),
    cost_amount: nullableNumber(formData, "cost_amount"),
    currency: nullableString(formData, "currency") ?? "BRL",
    departure_airport: nullableString(formData, "departure_airport"),
    departure_at: nullableString(formData, "departure_at"),
    departure_city: nullableString(formData, "departure_city"),
    departure_country: nullableString(formData, "departure_country"),
    departure_gate: nullableString(formData, "departure_gate"),
    departure_iata: nullableString(formData, "departure_iata"),
    departure_terminal: nullableString(formData, "departure_terminal"),
    departure_timezone: nullableString(formData, "departure_timezone"),
    flight_number: nullableString(formData, "flight_number"),
    internal_notes: nullableString(formData, "flight_internal_notes"),
    pnr: nullableString(formData, "pnr"),
    seat: nullableString(formData, "seat"),
    status: safeFlightStatus(nullableString(formData, "flight_status")),
    ticket_number: nullableString(formData, "ticket_number")
  };
}

export async function createTravelTripAction(formData: FormData) {
  const tripId = await createTravelTrip(
    tripInputFromFormData(formData),
    flightInputFromFormData(formData)
  );

  revalidatePath("/admin/travel");
  redirect(`/admin/travel/${tripId}`);
}

export async function updateTravelTripAction(id: string, formData: FormData) {
  await updateTravelTrip(
    id,
    tripInputFromFormData(formData),
    flightInputFromFormData(formData)
  );

  revalidatePath("/admin/travel");
  revalidatePath(`/admin/travel/${id}`);
  redirect(`/admin/travel/${id}`);
}

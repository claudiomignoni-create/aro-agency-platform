"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nullableNumber, nullableString, requiredString } from "@/lib/form-data";
import {
  agencyStatusOptions,
  agencyTypeOptions,
  createPartnerAgency,
  updatePartnerAgency,
  type PartnerAgencyInput
} from "@/lib/agencies";
import type { PartnerAgencyStatus, PartnerAgencyType } from "@/types/database";

function agencyTypeFromFormData(formData: FormData) {
  const value = (nullableString(formData, "agency_type") ?? "partner_agency") as PartnerAgencyType;
  if (!agencyTypeOptions.some((option) => option.value === value)) {
    throw new Error("Tipo de agencia invalido.");
  }
  return value;
}

function agencyStatusFromFormData(formData: FormData) {
  const value = (nullableString(formData, "status") ?? "prospect") as PartnerAgencyStatus;
  if (!agencyStatusOptions.some((option) => option.value === value)) {
    throw new Error("Status invalido.");
  }
  return value;
}

function agencyInputFromFormData(formData: FormData): PartnerAgencyInput {
  return {
    agency_type: agencyTypeFromFormData(formData),
    city: nullableString(formData, "city"),
    contact_name: nullableString(formData, "contact_name"),
    contact_role: nullableString(formData, "contact_role"),
    country: nullableString(formData, "country"),
    country_code: nullableString(formData, "country_code"),
    default_currency: nullableString(formData, "default_currency"),
    default_payment_terms_days: nullableNumber(formData, "default_payment_terms_days"),
    display_name: requiredString(formData, "display_name"),
    instagram_url: nullableString(formData, "instagram_url"),
    legal_name: nullableString(formData, "legal_name"),
    notes: nullableString(formData, "notes"),
    phone: nullableString(formData, "phone"),
    primary_email: nullableString(formData, "primary_email"),
    secondary_email: nullableString(formData, "secondary_email"),
    state_region: nullableString(formData, "state_region"),
    status: agencyStatusFromFormData(formData),
    timezone: nullableString(formData, "timezone"),
    website_url: nullableString(formData, "website_url"),
    whatsapp: nullableString(formData, "whatsapp")
  };
}

export async function createAgencyAction(formData: FormData) {
  const id = await createPartnerAgency(agencyInputFromFormData(formData));
  revalidatePath("/admin/agencies");
  redirect(`/admin/agencies/${id}`);
}

export async function updateAgencyAction(id: string, formData: FormData) {
  await updatePartnerAgency(id, agencyInputFromFormData(formData));
  revalidatePath("/admin/agencies");
  revalidatePath(`/admin/agencies/${id}`);
  redirect(`/admin/agencies/${id}`);
}

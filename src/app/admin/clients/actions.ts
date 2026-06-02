"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  nullableString,
  requiredString,
  stringList
} from "@/lib/form-data";
import {
  createClientWithContacts,
  type ClientContactInput,
  type ClientInput
} from "@/lib/clients";
import type { ClientStatus, ClientType } from "@/types/database";

const allowedClientTypes: ClientType[] = [
  "international_agency",
  "brand",
  "production",
  "photographer",
  "casting_director",
  "partner",
  "other"
];

const allowedClientStatuses: ClientStatus[] = [
  "lead",
  "active",
  "partner",
  "inactive",
  "do_not_contact"
];

function clientTypeFromFormData(formData: FormData) {
  const clientType = (nullableString(formData, "client_type") ??
    "other") as ClientType;

  if (!allowedClientTypes.includes(clientType)) {
    throw new Error("Tipo de cliente inválido.");
  }

  return clientType;
}

function clientStatusFromFormData(formData: FormData) {
  const status = (nullableString(formData, "status") ?? "lead") as ClientStatus;

  if (!allowedClientStatuses.includes(status)) {
    throw new Error("Status inválido.");
  }

  return status;
}

function clientInputFromFormData(formData: FormData): ClientInput {
  return {
    city: nullableString(formData, "city"),
    client_type: clientTypeFromFormData(formData),
    company_name: requiredString(formData, "company_name"),
    country: nullableString(formData, "country"),
    general_email: nullableString(formData, "general_email"),
    general_phone: nullableString(formData, "general_phone"),
    general_whatsapp: nullableString(formData, "general_whatsapp"),
    general_wechat: nullableString(formData, "general_wechat"),
    internal_notes: nullableString(formData, "internal_notes"),
    last_contact_at: nullableString(formData, "last_contact_at"),
    market_notes: nullableString(formData, "market_notes"),
    next_follow_up_at: nullableString(formData, "next_follow_up_at"),
    preferred_model_profile: nullableString(
      formData,
      "preferred_model_profile"
    ),
    status: clientStatusFromFormData(formData),
    tags: stringList(formData, "tags"),
    website: nullableString(formData, "website")
  };
}

function hasContactData(formData: FormData, index: number) {
  return [
    "contact_name",
    "role",
    "email",
    "phone",
    "whatsapp",
    "wechat",
    "notes"
  ].some((field) => nullableString(formData, `contacts[${index}].${field}`));
}

function contactInputFromFormData(
  formData: FormData,
  index: number
): ClientContactInput | null {
  if (!hasContactData(formData, index)) {
    return null;
  }

  return {
    can_receive_emails:
      formData.get(`contacts[${index}].can_receive_emails`) === "on",
    contact_name: requiredString(formData, `contacts[${index}].contact_name`),
    email: nullableString(formData, `contacts[${index}].email`),
    is_primary: formData.get(`contacts[${index}].is_primary`) === "on",
    notes: nullableString(formData, `contacts[${index}].notes`),
    phone: nullableString(formData, `contacts[${index}].phone`),
    role: nullableString(formData, `contacts[${index}].role`),
    whatsapp: nullableString(formData, `contacts[${index}].whatsapp`),
    wechat: nullableString(formData, `contacts[${index}].wechat`)
  };
}

function contactInputsFromFormData(formData: FormData) {
  const count = Number(nullableString(formData, "contacts_count") ?? 0);

  if (!Number.isInteger(count) || count < 0 || count > 20) {
    throw new Error("Quantidade de contatos inválida.");
  }

  return Array.from({ length: count })
    .map((_, index) => contactInputFromFormData(formData, index))
    .filter((contact): contact is ClientContactInput => Boolean(contact));
}

export async function createClientAction(formData: FormData) {
  await createClientWithContacts(
    clientInputFromFormData(formData),
    contactInputsFromFormData(formData)
  );
  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  redirect("/admin/clients");
}

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
  updateClientWithContacts,
  type ClientChannelInput,
  type ClientContactInput,
  type ClientInput
} from "@/lib/clients";
import type {
  ClientChannelType,
  ClientStatus,
  ClientType
} from "@/types/database";

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

const allowedChannelTypes: ClientChannelType[] = [
  "instagram",
  "personal_instagram",
  "tiktok",
  "wechat",
  "rednote",
  "linkedin",
  "facebook",
  "telegram",
  "line",
  "kakao_talk",
  "whatsapp",
  "website",
  "email",
  "phone",
  "other"
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

function channelTypeFromFormData(formData: FormData, index: number) {
  const channelType = (nullableString(
    formData,
    `channels[${index}].channel_type`
  ) ?? "other") as ClientChannelType;

  if (!allowedChannelTypes.includes(channelType)) {
    throw new Error("Tipo de canal inválido.");
  }

  return channelType;
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
    id: nullableString(formData, `contacts[${index}].id`) ?? undefined,
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

function originalContactIdsFromFormData(formData: FormData) {
  return stringList(formData, "original_contact_ids");
}

function hasChannelData(formData: FormData, index: number) {
  return ["value", "url", "label", "notes"].some((field) =>
    nullableString(formData, `channels[${index}].${field}`)
  );
}

function channelInputFromFormData(
  formData: FormData,
  index: number
): ClientChannelInput | null {
  if (!hasChannelData(formData, index)) {
    return null;
  }

  const value = nullableString(formData, `channels[${index}].value`);
  const url = nullableString(formData, `channels[${index}].url`);

  if (!value && !url) {
    throw new Error("Canal da empresa precisa ter valor ou URL.");
  }

  return {
    channel_type: channelTypeFromFormData(formData, index),
    id: nullableString(formData, `channels[${index}].id`) ?? undefined,
    is_primary: formData.get(`channels[${index}].is_primary`) === "on",
    label: nullableString(formData, `channels[${index}].label`),
    notes: nullableString(formData, `channels[${index}].notes`),
    url,
    value
  };
}

function channelInputsFromFormData(formData: FormData) {
  const count = Number(nullableString(formData, "channels_count") ?? 0);

  if (!Number.isInteger(count) || count < 0 || count > 20) {
    throw new Error("Quantidade de canais inválida.");
  }

  return Array.from({ length: count })
    .map((_, index) => channelInputFromFormData(formData, index))
    .filter((channel): channel is ClientChannelInput => Boolean(channel));
}

function originalChannelIdsFromFormData(formData: FormData) {
  return stringList(formData, "original_channel_ids");
}

export async function createClientAction(formData: FormData) {
  await createClientWithContacts(
    clientInputFromFormData(formData),
    contactInputsFromFormData(formData),
    channelInputsFromFormData(formData)
  );
  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  redirect("/admin/clients");
}

export async function updateClientAction(id: string, formData: FormData) {
  await updateClientWithContacts(
    id,
    clientInputFromFormData(formData),
    contactInputsFromFormData(formData),
    originalContactIdsFromFormData(formData),
    channelInputsFromFormData(formData),
    originalChannelIdsFromFormData(formData)
  );
  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  revalidatePath(`/admin/clients/${id}/edit`);
  redirect(`/admin/clients/${id}`);
}

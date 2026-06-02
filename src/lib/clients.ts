import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  Client,
  ClientContact,
  ClientStatus,
  ClientType
} from "@/types/database";

const clientSelect = `
  id,
  user_id,
  company_name,
  contact_name,
  email,
  phone,
  company_type,
  client_type,
  status,
  country,
  city,
  general_email,
  general_phone,
  general_whatsapp,
  general_wechat,
  website,
  tags,
  market_notes,
  preferred_model_profile,
  internal_notes,
  last_contact_at,
  next_follow_up_at,
  notes,
  created_at,
  updated_at
`;

export async function listClients() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(clientSelect)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Client[];
}

export type ClientProfile = {
  client: Client;
  contacts: ClientContact[];
};

export type ClientInput = {
  city: string | null;
  client_type: ClientType;
  company_name: string;
  country: string | null;
  general_email: string | null;
  general_phone: string | null;
  general_whatsapp: string | null;
  general_wechat: string | null;
  internal_notes: string | null;
  last_contact_at: string | null;
  market_notes: string | null;
  next_follow_up_at: string | null;
  preferred_model_profile: string | null;
  status: ClientStatus;
  tags: string[];
  website: string | null;
};

export type ClientContactInput = {
  can_receive_emails: boolean;
  contact_name: string;
  email: string | null;
  id?: string;
  is_primary: boolean;
  notes: string | null;
  phone: string | null;
  role: string | null;
  whatsapp: string | null;
  wechat: string | null;
};

export async function createClientRecord(input: ClientInput) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      ...input,
      company_type: input.client_type,
      contact_name: input.company_name,
      email: input.general_email ?? "",
      notes: input.internal_notes,
      phone: input.general_phone
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data as Pick<Client, "id">;
}

export async function createClientWithContacts(
  input: ClientInput,
  contacts: ClientContactInput[]
) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      ...input,
      company_type: input.client_type,
      contact_name: input.company_name,
      email: input.general_email ?? "",
      notes: input.internal_notes,
      phone: input.general_phone
    })
    .select("id")
    .single();

  if (clientError) {
    throw clientError;
  }

  const createdClient = client as Pick<Client, "id">;

  if (contacts.length) {
    const { error: contactsError } = await supabase
      .from("client_contacts")
      .insert(
        contacts.map((contact) => ({
          ...contact,
          client_id: createdClient.id
        }))
      );

    if (contactsError) {
      throw contactsError;
    }
  }

  return createdClient;
}

export async function getClientProfile(id: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select(clientSelect)
    .eq("id", id)
    .maybeSingle();

  if (clientError) {
    throw clientError;
  }

  if (!client) {
    return null;
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("client_contacts")
    .select("*")
    .eq("client_id", id)
    .order("is_primary", { ascending: false })
    .order("contact_name", { ascending: true });

  if (contactsError) {
    throw contactsError;
  }

  return {
    client: client as Client,
    contacts: (contacts ?? []) as ClientContact[]
  } satisfies ClientProfile;
}

function clientPayload(input: ClientInput) {
  return {
    ...input,
    company_type: input.client_type,
    contact_name: input.company_name,
    email: input.general_email ?? "",
    notes: input.internal_notes,
    phone: input.general_phone
  };
}

function contactPayload(contact: ClientContactInput) {
  return {
    can_receive_emails: contact.can_receive_emails,
    contact_name: contact.contact_name,
    email: contact.email,
    is_primary: contact.is_primary,
    notes: contact.notes,
    phone: contact.phone,
    role: contact.role,
    whatsapp: contact.whatsapp,
    wechat: contact.wechat
  };
}

export async function updateClientWithContacts(
  id: string,
  input: ClientInput,
  contacts: ClientContactInput[],
  originalContactIds: string[]
) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .update(clientPayload(input))
    .eq("id", id)
    .select("id")
    .single();

  if (clientError) {
    throw clientError;
  }

  const submittedExistingIds = contacts
    .map((contact) => contact.id)
    .filter((contactId): contactId is string => Boolean(contactId));
  const removedContactIds = originalContactIds.filter(
    (contactId) => !submittedExistingIds.includes(contactId)
  );

  if (removedContactIds.length) {
    const { error: removeError } = await supabase
      .from("client_contacts")
      .delete()
      .eq("client_id", id)
      .in("id", removedContactIds);

    if (removeError) {
      throw removeError;
    }
  }

  for (const contact of contacts) {
    if (contact.id) {
      const { error: updateError } = await supabase
        .from("client_contacts")
        .update(contactPayload(contact))
        .eq("client_id", id)
        .eq("id", contact.id);

      if (updateError) {
        throw updateError;
      }
    } else {
      const { error: insertError } = await supabase
        .from("client_contacts")
        .insert({
          ...contactPayload(contact),
          client_id: id
        });

      if (insertError) {
        throw insertError;
      }
    }
  }

  return client as Pick<Client, "id">;
}

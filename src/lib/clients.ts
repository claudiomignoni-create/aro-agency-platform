import { requireRole } from "@/lib/auth";
import { isMissingSchemaError } from "@/lib/accounting-schema";
import { createClient } from "@/lib/supabase/server";
import type {
  Client,
  ClientChannel,
  ClientChannelType,
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
  billing_person_type,
  billing_trade_name,
  billing_legal_name,
  billing_cnpj,
  billing_cpf,
  billing_state_registration,
  billing_municipal_registration,
  billing_tax_regime,
  billing_postal_code,
  billing_address_line,
  billing_address_number,
  billing_address_complement,
  billing_neighborhood,
  billing_city,
  billing_state,
  billing_country,
  billing_contact_name,
  billing_email,
  billing_phone,
  payment_terms,
  default_currency,
  invoice_notes,
  tax_notes,
  intl_trading_name,
  intl_legal_company_name,
  intl_country,
  intl_tax_id,
  intl_vat_number,
  intl_company_registration_number,
  intl_billing_address,
  intl_billing_city,
  intl_billing_state,
  intl_billing_postal_code,
  intl_billing_country,
  intl_billing_contact,
  intl_billing_email,
  intl_payment_terms,
  intl_invoice_notes,
  intl_tax_notes,
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

const baseClientSelect = `
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

function withEmptyBillingFields(client: Partial<Client>) {
  return {
    billing_address_complement: null,
    billing_address_line: null,
    billing_address_number: null,
    billing_city: null,
    billing_cnpj: null,
    billing_contact_name: null,
    billing_country: null,
    billing_cpf: null,
    billing_email: null,
    billing_legal_name: null,
    billing_municipal_registration: null,
    billing_neighborhood: null,
    billing_person_type: null,
    billing_phone: null,
    billing_postal_code: null,
    billing_state: null,
    billing_state_registration: null,
    billing_tax_regime: null,
    billing_trade_name: null,
    default_currency: "BRL",
    intl_billing_address: null,
    intl_billing_city: null,
    intl_billing_contact: null,
    intl_billing_country: null,
    intl_billing_email: null,
    intl_billing_postal_code: null,
    intl_billing_state: null,
    intl_company_registration_number: null,
    intl_country: null,
    intl_invoice_notes: null,
    intl_legal_company_name: null,
    intl_payment_terms: null,
    intl_tax_id: null,
    intl_tax_notes: null,
    intl_trading_name: null,
    intl_vat_number: null,
    invoice_notes: null,
    payment_terms: null,
    tax_notes: null,
    ...client
  } as Client;
}

export type ClientOption = Pick<Client, "company_name" | "id">;

export async function listClientOptions() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, company_name")
    .order("company_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ClientOption[];
}

export async function listClients() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(clientSelect)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("clients")
        .select(baseClientSelect)
        .order("updated_at", { ascending: false });

      if (fallbackError) {
        throw fallbackError;
      }

      return (fallbackData ?? []).map((client) => withEmptyBillingFields(client));
    }

    throw error;
  }

  return (data ?? []).map((client) => withEmptyBillingFields(client));
}

export type ClientProfile = {
  channels: ClientChannel[];
  client: Client;
  contacts: ClientContact[];
};

export type ClientInput = {
  billing_address_complement: string | null;
  billing_address_line: string | null;
  billing_address_number: string | null;
  billing_city: string | null;
  billing_cnpj: string | null;
  billing_contact_name: string | null;
  billing_country: string | null;
  billing_cpf: string | null;
  billing_email: string | null;
  billing_legal_name: string | null;
  billing_municipal_registration: string | null;
  billing_neighborhood: string | null;
  billing_person_type: string | null;
  billing_phone: string | null;
  billing_postal_code: string | null;
  billing_state: string | null;
  billing_state_registration: string | null;
  billing_tax_regime: string | null;
  billing_trade_name: string | null;
  city: string | null;
  client_type: ClientType;
  company_name: string;
  country: string | null;
  default_currency: string | null;
  general_email: string | null;
  general_phone: string | null;
  general_whatsapp: string | null;
  general_wechat: string | null;
  intl_billing_address: string | null;
  intl_billing_city: string | null;
  intl_billing_contact: string | null;
  intl_billing_country: string | null;
  intl_billing_email: string | null;
  intl_billing_postal_code: string | null;
  intl_billing_state: string | null;
  intl_company_registration_number: string | null;
  intl_country: string | null;
  intl_invoice_notes: string | null;
  intl_legal_company_name: string | null;
  intl_payment_terms: string | null;
  intl_tax_id: string | null;
  intl_tax_notes: string | null;
  intl_trading_name: string | null;
  intl_vat_number: string | null;
  internal_notes: string | null;
  invoice_notes: string | null;
  last_contact_at: string | null;
  market_notes: string | null;
  next_follow_up_at: string | null;
  payment_terms: string | null;
  preferred_model_profile: string | null;
  status: ClientStatus;
  tags: string[];
  tax_notes: string | null;
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

export type ClientChannelInput = {
  channel_type: ClientChannelType;
  id?: string;
  is_primary: boolean;
  label: string | null;
  notes: string | null;
  url: string | null;
  value: string | null;
};

export async function createClientRecord(input: ClientInput) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("clients")
    .insert(clientPayload(input))
    .select("id")
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      const fallback = await supabase
        .from("clients")
        .insert(clientPayload(input, false))
        .select("id")
        .single();

      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      throw error;
    }
  }

  return data as Pick<Client, "id">;
}

export async function createClientWithContacts(
  input: ClientInput,
  contacts: ClientContactInput[],
  channels: ClientChannelInput[] = []
) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const clientResult = await supabase
    .from("clients")
    .insert(clientPayload(input))
    .select("id")
    .single();
  let client = clientResult.data as Pick<Client, "id"> | null;
  let clientError = clientResult.error;

  if (clientError) {
    if (isMissingSchemaError(clientError)) {
      const fallback = await supabase
        .from("clients")
        .insert(clientPayload(input, false))
        .select("id")
        .single();

      client = fallback.data as Pick<Client, "id"> | null;
      clientError = fallback.error;
    }

    if (clientError) {
      throw clientError;
    }
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

  if (channels.length) {
    const { error: channelsError } = await supabase
      .from("client_channels")
      .insert(
        channels.map((channel) => ({
          ...channelPayload(channel),
          client_id: createdClient.id,
          contact_id: null
        }))
      );

    if (channelsError) {
      throw channelsError;
    }
  }

  return createdClient;
}

export async function getClientProfile(id: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const clientResult = await supabase
    .from("clients")
    .select(clientSelect)
    .eq("id", id)
    .maybeSingle();
  let client = clientResult.data as Partial<Client> | null;
  let clientError = clientResult.error;

  if (clientError) {
    if (isMissingSchemaError(clientError)) {
      const fallback = await supabase
        .from("clients")
        .select(baseClientSelect)
        .eq("id", id)
        .maybeSingle();

      client = fallback.data as Partial<Client> | null;
      clientError = fallback.error;
    }

    if (clientError) {
      throw clientError;
    }
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

  const { data: channels, error: channelsError } = await supabase
    .from("client_channels")
    .select("*")
    .eq("client_id", id)
    .is("contact_id", null)
    .order("is_primary", { ascending: false })
    .order("channel_type", { ascending: true });

  if (channelsError) {
    throw channelsError;
  }

  return {
    channels: (channels ?? []) as ClientChannel[],
    client: withEmptyBillingFields(client as Partial<Client>),
    contacts: (contacts ?? []) as ClientContact[]
  } satisfies ClientProfile;
}

function coreClientPayload(input: ClientInput) {
  return {
    city: input.city,
    client_type: input.client_type,
    company_name: input.company_name,
    country: input.country,
    general_email: input.general_email,
    general_phone: input.general_phone,
    general_whatsapp: input.general_whatsapp,
    general_wechat: input.general_wechat,
    internal_notes: input.internal_notes,
    last_contact_at: input.last_contact_at,
    market_notes: input.market_notes,
    next_follow_up_at: input.next_follow_up_at,
    preferred_model_profile: input.preferred_model_profile,
    status: input.status,
    tags: input.tags,
    website: input.website
  };
}

function clientPayload(input: ClientInput, includeBilling = true) {
  const payload = includeBilling ? input : coreClientPayload(input);

  return {
    ...payload,
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

function channelPayload(channel: ClientChannelInput) {
  return {
    channel_type: channel.channel_type,
    is_primary: channel.is_primary,
    label: channel.label,
    notes: channel.notes,
    url: channel.url,
    value: channel.value
  };
}

export async function updateClientWithContacts(
  id: string,
  input: ClientInput,
  contacts: ClientContactInput[],
  originalContactIds: string[],
  channels: ClientChannelInput[] = [],
  originalChannelIds: string[] = []
) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  let { data: client, error: clientError } = await supabase
    .from("clients")
    .update(clientPayload(input))
    .eq("id", id)
    .select("id")
    .single();

  if (clientError) {
    if (isMissingSchemaError(clientError)) {
      const fallback = await supabase
        .from("clients")
        .update(clientPayload(input, false))
        .eq("id", id)
        .select("id")
        .single();

      client = fallback.data;
      clientError = fallback.error;
    }

    if (clientError) {
      throw clientError;
    }
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

  const submittedExistingChannelIds = channels
    .map((channel) => channel.id)
    .filter((channelId): channelId is string => Boolean(channelId));
  const removedChannelIds = originalChannelIds.filter(
    (channelId) => !submittedExistingChannelIds.includes(channelId)
  );

  if (removedChannelIds.length) {
    const { error: removeChannelsError } = await supabase
      .from("client_channels")
      .delete()
      .eq("client_id", id)
      .is("contact_id", null)
      .in("id", removedChannelIds);

    if (removeChannelsError) {
      throw removeChannelsError;
    }
  }

  for (const channel of channels) {
    if (channel.id) {
      const { error: updateChannelError } = await supabase
        .from("client_channels")
        .update(channelPayload(channel))
        .eq("client_id", id)
        .is("contact_id", null)
        .eq("id", channel.id);

      if (updateChannelError) {
        throw updateChannelError;
      }
    } else {
      const { error: insertChannelError } = await supabase
        .from("client_channels")
        .insert({
          ...channelPayload(channel),
          client_id: id,
          contact_id: null
        });

      if (insertChannelError) {
        throw insertChannelError;
      }
    }
  }

  return client as Pick<Client, "id">;
}

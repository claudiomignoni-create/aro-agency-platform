import type { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

export type JsonValue =
  | boolean
  | number
  | string
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type IntegerToolProperty = {
  description: string;
  maximum?: number;
  minimum?: number;
  type: "integer" | readonly ["integer", "null"];
};

type StringToolProperty = {
  description: string;
  enum?: readonly (string | null)[];
  format?: "uuid";
  maxLength?: number;
  minLength?: number;
  type: "string" | readonly ["string", "null"];
};

type ToolProperty = IntegerToolProperty | StringToolProperty;

export type ToolSchema = {
  additionalProperties: false;
  properties: Record<string, ToolProperty>;
  required: readonly string[];
  type: "object";
};

export type ToolName =
  | "get_casting_guidelines"
  | "get_client_contacts"
  | "get_model_profile"
  | "get_my_profile"
  | "recommend_models_for_brief"
  | "search_clients"
  | "search_models"
  | "search_public_models";

export type ToolDefinition = {
  description: string;
  name: ToolName;
  schema: ToolSchema;
};

type ToolContext = {
  profile: Profile;
  supabase: SupabaseServerClient;
};

type ToolExecution = {
  input: Record<string, JsonValue>;
  output: JsonValue;
  tool: ToolDefinition;
};

const emptySchema = {
  additionalProperties: false,
  properties: {},
  required: [],
  type: "object"
} as const satisfies ToolSchema;

const limitProperty = {
  description: "Maximum number of records to return.",
  maximum: 12,
  minimum: 1,
  type: ["integer", "null"]
} as const;

const modelStatusValues = [
  "all",
  "draft",
  "pending_review",
  "approved",
  "archived"
] as const;

const clientStatusValues = [
  "all",
  "lead",
  "active",
  "partner",
  "inactive",
  "do_not_contact"
] as const;

const clientTypeValues = [
  "all",
  "international_agency",
  "brand",
  "production",
  "photographer",
  "casting_director",
  "partner",
  "other"
] as const;

const nullableModelStatusValues = [...modelStatusValues, null] as const;
const nullableClientStatusValues = [...clientStatusValues, null] as const;
const nullableClientTypeValues = [...clientTypeValues, null] as const;

const toolDefinitions = {
  search_models: {
    description: "Search internal model records for admin review.",
    name: "search_models",
    schema: {
      additionalProperties: false,
      properties: {
        limit: limitProperty,
        query: {
          description: "Name, city, country, category, tag, or contact term.",
          maxLength: 120,
          type: ["string", "null"]
        },
        status: {
          description: "Model status filter.",
          enum: nullableModelStatusValues,
          type: ["string", "null"]
        }
      },
      required: ["limit", "query", "status"],
      type: "object"
    }
  },
  get_model_profile: {
    description: "Read a detailed internal model profile for admin review.",
    name: "get_model_profile",
    schema: {
      additionalProperties: false,
      properties: {
        model_id: {
          description: "Model id.",
          format: "uuid",
          type: "string"
        }
      },
      required: ["model_id"],
      type: "object"
    }
  },
  search_clients: {
    description: "Search internal client CRM records.",
    name: "search_clients",
    schema: {
      additionalProperties: false,
      properties: {
        limit: limitProperty,
        query: {
          description: "Company, market, city, country, tag, or contact term.",
          maxLength: 120,
          type: ["string", "null"]
        },
        status: {
          description: "Client status filter.",
          enum: nullableClientStatusValues,
          type: ["string", "null"]
        },
        type: {
          description: "Client type filter.",
          enum: nullableClientTypeValues,
          type: ["string", "null"]
        }
      },
      required: ["limit", "query", "status", "type"],
      type: "object"
    }
  },
  get_client_contacts: {
    description: "Read contacts and channels for a client CRM record.",
    name: "get_client_contacts",
    schema: {
      additionalProperties: false,
      properties: {
        client_id: {
          description: "Client id.",
          format: "uuid",
          type: "string"
        }
      },
      required: ["client_id"],
      type: "object"
    }
  },
  get_my_profile: {
    description: "Read the signed-in model profile.",
    name: "get_my_profile",
    schema: emptySchema
  },
  get_casting_guidelines: {
    description: "Read AROLAB casting preparation guidelines.",
    name: "get_casting_guidelines",
    schema: emptySchema
  },
  search_public_models: {
    description: "Search approved public model profiles visible to clients.",
    name: "search_public_models",
    schema: {
      additionalProperties: false,
      properties: {
        limit: limitProperty,
        location: {
          description: "City or country filter.",
          maxLength: 80,
          type: ["string", "null"]
        },
        query: {
          description: "Name, category, type, location, or measurement term.",
          maxLength: 120,
          type: ["string", "null"]
        }
      },
      required: ["limit", "location", "query"],
      type: "object"
    }
  },
  recommend_models_for_brief: {
    description: "Recommend public model profiles for a client brief.",
    name: "recommend_models_for_brief",
    schema: {
      additionalProperties: false,
      properties: {
        brief: {
          description: "Client booking or casting brief.",
          maxLength: 1200,
          minLength: 3,
          type: "string"
        },
        limit: limitProperty
      },
      required: ["brief", "limit"],
      type: "object"
    }
  }
} satisfies Record<ToolName, ToolDefinition>;

export const toolsByRole = {
  admin: [
    "search_models",
    "get_model_profile",
    "search_clients",
    "get_client_contacts"
  ],
  model: ["get_my_profile", "get_casting_guidelines"],
  client: ["search_public_models", "recommend_models_for_brief"]
} as const satisfies Record<UserRole, readonly ToolName[]>;

export function getToolDefinitionsForRole(role: UserRole) {
  return toolsByRole[role].map((name) => toolDefinitions[name]);
}

export function getToolDefinition(name: ToolName) {
  return toolDefinitions[name];
}

export function isToolName(value: unknown): value is ToolName {
  return typeof value === "string" && value in toolDefinitions;
}

export function chooseToolForMessage(
  role: UserRole,
  message: string,
  requestedTool?: ToolName
) {
  if (requestedTool && isToolAllowedForRole(role, requestedTool)) {
    return requestedTool;
  }

  const normalized = message.toLowerCase();

  if (role === "admin") {
    if (
      extractUuid(message) &&
      (normalized.includes("contato") || normalized.includes("contact"))
    ) {
      return "get_client_contacts";
    }

    if (normalized.includes("client") || normalized.includes("cliente")) {
      return "search_clients";
    }

    if (extractUuid(message)) {
      return "get_model_profile";
    }

    return "search_models";
  }

  if (role === "model") {
    if (
      normalized.includes("casting") ||
      normalized.includes("brief") ||
      normalized.includes("orienta")
    ) {
      return "get_casting_guidelines";
    }

    return "get_my_profile";
  }

  if (
    normalized.includes("recom") ||
    normalized.includes("brief") ||
    normalized.includes("casting")
  ) {
    return "recommend_models_for_brief";
  }

  return "search_public_models";
}

export function inputFromMessage(
  toolName: ToolName,
  message: string
): Record<string, JsonValue> {
  const uuid = extractUuid(message);

  switch (toolName) {
    case "get_client_contacts":
      return { client_id: uuid ?? "" };
    case "get_model_profile":
      return { model_id: uuid ?? "" };
    case "get_casting_guidelines":
    case "get_my_profile":
      return {};
    case "recommend_models_for_brief":
      return { brief: message, limit: 6 };
    case "search_clients":
      return { limit: 8, query: message, status: "all", type: "all" };
    case "search_models":
      return { limit: 8, query: message, status: "all" };
    case "search_public_models":
      return { limit: 8, query: message };
  }
}

export async function executeTool(
  context: ToolContext,
  toolName: ToolName,
  rawInput: unknown
): Promise<ToolExecution> {
  if (!isToolAllowedForRole(context.profile.role, toolName)) {
    throw new Error("Ferramenta indisponível para este perfil.");
  }

  const tool = toolDefinitions[toolName];
  const input = validateInput(tool.schema, rawInput);
  const output = await toolExecutors[toolName](context, input);

  return { input, output, tool };
}

function validateInput(schema: ToolSchema, rawInput: unknown) {
  if (!isPlainObject(rawInput)) {
    throw new Error("Entrada da ferramenta deve ser um objeto.");
  }

  const input = rawInput as Record<string, unknown>;
  const allowedKeys = new Set(Object.keys(schema.properties));

  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Campo não permitido: ${key}.`);
    }
  }

  const output: Record<string, JsonValue> = {};

  for (const requiredKey of schema.required) {
    if (input[requiredKey] === undefined) {
      throw new Error(`Campo obrigatório ausente: ${requiredKey}.`);
    }
  }

  for (const [key, property] of Object.entries(schema.properties)) {
    const value = input[key];

    if (value === undefined) {
      continue;
    }

    if (value === null) {
      if (allowsNull(property)) {
        continue;
      }

      throw new Error(`Campo ${key} não pode ser nulo.`);
    }

    if (isStringProperty(property)) {
      if (typeof value !== "string") {
        throw new Error(`Campo ${key} deve ser texto.`);
      }

      const trimmedValue = value.trim();

      if (!trimmedValue && allowsNull(property)) {
        continue;
      }

      if (property.minLength && trimmedValue.length < property.minLength) {
        throw new Error(`Campo ${key} está muito curto.`);
      }

      if (property.maxLength && trimmedValue.length > property.maxLength) {
        throw new Error(`Campo ${key} está muito longo.`);
      }

      if (property.format === "uuid" && !isUuid(trimmedValue)) {
        throw new Error(`Campo ${key} deve ser um UUID válido.`);
      }

      if (property.enum && !property.enum.includes(trimmedValue)) {
        throw new Error(`Campo ${key} tem valor inválido.`);
      }

      output[key] = trimmedValue;
      continue;
    }

    if (!isIntegerProperty(property)) {
      throw new Error(`Tipo inválido para o campo ${key}.`);
    }

    if (!Number.isInteger(value)) {
      throw new Error(`Campo ${key} deve ser um inteiro.`);
    }

    let normalizedNumber = value as number;

    if (property.minimum !== undefined) {
      normalizedNumber = Math.max(normalizedNumber, property.minimum);
    }

    if (property.maximum !== undefined) {
      normalizedNumber = Math.min(normalizedNumber, property.maximum);
    }

    output[key] = normalizedNumber;
  }

  return output;
}

export function isToolAllowedForRole(role: UserRole, toolName: ToolName) {
  return (toolsByRole[role] as readonly ToolName[]).includes(toolName);
}

const toolExecutors: Record<
  ToolName,
  (context: ToolContext, input: Record<string, JsonValue>) => Promise<JsonValue>
> = {
  async search_models({ supabase }, input) {
    const limit = numberInput(input.limit, 8);
    let query = supabase
      .from("models")
      .select(
        "id, display_name, stage_name, email, status, is_published, categories, current_city, current_country, model_type, tags, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (typeof input.status === "string" && input.status !== "all") {
      query = query.eq("status", input.status);
    }

    query = applyTextSearch(query, input.query, [
      "display_name",
      "stage_name",
      "email",
      "current_city",
      "current_country",
      "model_type"
    ]);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return { models: data ?? [] };
  },
  async get_model_profile({ supabase }, input) {
    const modelId = stringInput(input.model_id);

    const [
      modelResult,
      socialResult,
      skillsResult,
      workHistoryResult,
      healthResult,
      representationResult
    ] = await Promise.all([
      supabase
        .from("models")
        .select(
          "id, display_name, stage_name, legal_name, email, phone, whatsapp, wechat, status, is_published, categories, gender, pronouns, nationality, birth_date, is_minor, location, current_city, current_country, base_city, base_country, model_type, bio, height_cm, bust_cm, waist_cm, hips_cm, shoe_size_br, shoe_size_eu, shoe_size_us, dress_size_br, dress_size_eu, dress_size_us, shirt_size, pants_size, suit_size, hair_color, hair_length, hair_type, eye_color, skin_tone, tattoos, piercings, visible_scars, braces, tags, notes, updated_at"
        )
        .eq("id", modelId)
        .maybeSingle(),
      supabase.from("model_social_links").select("*").eq("model_id", modelId).maybeSingle(),
      supabase.from("model_skills").select("*").eq("model_id", modelId).maybeSingle(),
      supabase
        .from("model_work_history")
        .select("brand, year, market, category, photographer, client, agency, link, notes")
        .eq("model_id", modelId)
        .order("year", { ascending: false, nullsFirst: false }),
      supabase.from("model_health_logistics").select("*").eq("model_id", modelId).maybeSingle(),
      supabase.from("model_representation").select("*").eq("model_id", modelId).maybeSingle()
    ]);

    for (const result of [
      modelResult,
      socialResult,
      skillsResult,
      workHistoryResult,
      healthResult,
      representationResult
    ]) {
      if (result.error && !isMissingOptionalProfileTable(result.error)) {
        throw result.error;
      }
    }

    return {
      healthLogistics: healthResult.data ?? null,
      model: modelResult.data ?? null,
      representation: representationResult.data ?? null,
      skills: skillsResult.data ?? null,
      socialLinks: socialResult.data ?? null,
      workHistory: workHistoryResult.data ?? []
    };
  },
  async search_clients({ supabase }, input) {
    const limit = numberInput(input.limit, 8);
    let query = supabase
      .from("clients")
      .select(
        "id, company_name, client_type, status, country, city, general_email, general_phone, general_whatsapp, general_wechat, website, tags, market_notes, preferred_model_profile, last_contact_at, next_follow_up_at, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (typeof input.status === "string" && input.status !== "all") {
      query = query.eq("status", input.status);
    }

    if (typeof input.type === "string" && input.type !== "all") {
      query = query.eq("client_type", input.type);
    }

    query = applyTextSearch(query, input.query, [
      "company_name",
      "general_email",
      "country",
      "city",
      "client_type",
      "status"
    ]);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return { clients: data ?? [] };
  },
  async get_client_contacts({ supabase }, input) {
    const clientId = stringInput(input.client_id);
    const [clientResult, contactsResult, channelsResult] = await Promise.all([
      supabase
        .from("clients")
        .select(
          "id, company_name, client_type, status, country, city, general_email, general_phone, general_whatsapp, general_wechat, website"
        )
        .eq("id", clientId)
        .maybeSingle(),
      supabase
        .from("client_contacts")
        .select(
          "id, contact_name, role, email, phone, whatsapp, wechat, is_primary, can_receive_emails, notes"
        )
        .eq("client_id", clientId)
        .order("is_primary", { ascending: false })
        .order("contact_name", { ascending: true }),
      supabase
        .from("client_channels")
        .select("id, channel_type, value, url, label, notes, is_primary")
        .eq("client_id", clientId)
        .order("is_primary", { ascending: false })
        .order("channel_type", { ascending: true })
    ]);

    for (const result of [clientResult, contactsResult, channelsResult]) {
      if (result.error) {
        throw result.error;
      }
    }

    return {
      channels: channelsResult.data ?? [],
      client: clientResult.data ?? null,
      contacts: contactsResult.data ?? []
    };
  },
  async get_my_profile({ profile, supabase }) {
    const { data: model, error: modelError } = await supabase
      .from("models")
      .select(
        "id, display_name, stage_name, email, phone, status, is_published, categories, current_city, current_country, base_city, base_country, model_type, height_cm, bust_cm, waist_cm, hips_cm, updated_at"
      )
      .eq("user_id", profile.id)
      .maybeSingle();

    if (modelError) {
      throw modelError;
    }

    if (!model) {
      return { model: null, skills: null };
    }

    const { data: skills, error: skillsError } = await supabase
      .from("model_skills")
      .select(
        "acting, dancing, singing, languages, instruments, runway_experience, ecommerce_experience, beauty_experience, tv_commercial_experience"
      )
      .eq("model_id", model.id)
      .maybeSingle();

    if (skillsError && !isMissingOptionalProfileTable(skillsError)) {
      throw skillsError;
    }

    return { model, skills: skills ?? null };
  },
  async get_casting_guidelines() {
    return {
      guidelines: [
        "Confirme disponibilidade, cidade base e restrições antes de responder a um casting.",
        "Mantenha medidas, fotos recentes e contatos atualizados no Cadastro360.",
        "Use polaroids limpas, sem filtro, com boa luz e roupas simples.",
        "Para trabalhos fora da cidade, revise documento, transporte, alimentação e horários."
      ]
    };
  },
  async search_public_models({ supabase }, input) {
    const limit = numberInput(input.limit, 8);
    let query = supabase
      .from("model_client_profiles")
      .select("*")
      .order("stage_name", { ascending: true })
      .limit(limit);

    query = applyTextSearch(query, input.query, [
      "stage_name",
      "display_name",
      "current_city",
      "current_country",
      "base_city",
      "base_country",
      "model_type"
    ]);

    query = applyTextSearch(query, input.location, [
      "current_city",
      "current_country",
      "base_city",
      "base_country"
    ]);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return { models: data ?? [] };
  },
  async recommend_models_for_brief({ supabase }, input) {
    const brief = stringInput(input.brief);
    const limit = numberInput(input.limit, 6);
    const { data, error } = await supabase
      .from("model_client_profiles")
      .select("*")
      .limit(60);

    if (error) {
      throw error;
    }

    const terms = importantTerms(brief);
    const scoredModels = (data ?? [])
      .map((model) => {
        const haystack = Object.values(model)
          .flat()
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matchedTerms = terms.filter((term) => haystack.includes(term));

        return {
          model,
          reasons: matchedTerms.slice(0, 5),
          score: matchedTerms.length
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.model.stage_name.localeCompare(b.model.stage_name))
      .slice(0, limit);

    return {
      recommendations: scoredModels,
      terms
    };
  }
};

function applyTextSearch<QueryBuilder>(
  query: QueryBuilder,
  value: JsonValue | undefined,
  fields: string[]
) {
  if (typeof value !== "string" || !value.trim()) {
    return query;
  }

  const term = value.trim().replace(/[%,()]/g, " ").replace(/\s+/g, " ").slice(0, 80);

  if (!term) {
    return query;
  }

  return (
    query as QueryBuilder & {
      or: (filters: string) => QueryBuilder;
    }
  ).or(fields.map((field) => `${field}.ilike.%${term}%`).join(","));
}

function extractUuid(value: string) {
  return value.match(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
  )?.[0];
}

function importantTerms(value: string) {
  const stopWords = new Set([
    "para",
    "com",
    "uma",
    "por",
    "the",
    "and",
    "for",
    "modelo",
    "model",
    "brief",
    "casting"
  ]);

  return Array.from(
    new Set(
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((term) => term.length > 2 && !stopWords.has(term))
    )
  ).slice(0, 16);
}

function isMissingOptionalProfileTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}

function isPlainObject(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function allowsNull(property: ToolProperty) {
  return Array.isArray(property.type) && property.type.some((type) => type === "null");
}

function isStringProperty(property: ToolProperty): property is StringToolProperty {
  return (
    property.type === "string" ||
    (Array.isArray(property.type) && property.type.some((type) => type === "string"))
  );
}

function isIntegerProperty(property: ToolProperty): property is IntegerToolProperty {
  return (
    property.type === "integer" ||
    (Array.isArray(property.type) && property.type.some((type) => type === "integer"))
  );
}

function numberInput(value: JsonValue | undefined, fallback: number) {
  return typeof value === "number" ? value : fallback;
}

function stringInput(value: JsonValue | undefined) {
  return typeof value === "string" ? value : "";
}

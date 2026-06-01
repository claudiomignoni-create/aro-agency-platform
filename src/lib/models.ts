import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  MediaStatus,
  Model,
  ModelClientProfile,
  ModelDocuments,
  ModelHealthLogistics,
  ModelMedia,
  ModelProfile,
  ModelRepresentation,
  ModelSkills,
  ModelSocialLinks,
  ModelStatus,
  ModelUpdateRequest,
  ModelWorkHistory
} from "@/types/database";

const modelSelect = `
  id,
  user_id,
  display_name,
  stage_name,
  legal_name,
  email,
  phone,
  whatsapp,
  wechat,
  status,
  is_published,
  categories,
  gender,
  pronouns,
  nationality,
  birth_date,
  is_minor,
  location,
  current_city,
  current_country,
  base_city,
  base_country,
  model_type,
  bio,
  main_image_path,
  height_cm,
  bust_cm,
  waist_cm,
  hips_cm,
  shoe_size,
  shoe_size_br,
  shoe_size_eu,
  shoe_size_us,
  dress_size_br,
  dress_size_eu,
  dress_size_us,
  shirt_size,
  pants_size,
  suit_size,
  hair_color,
  hair_length,
  hair_type,
  eye_color,
  clothing_size,
  skin_tone,
  tattoos,
  piercings,
  visible_scars,
  braces,
  emergency_contact_name,
  emergency_contact_phone,
  emergency_contact_relationship,
  address_line,
  city,
  state,
  country,
  postal_code,
  tags,
  notes,
  consent_lgpd,
  last_profile_update_at,
  last_media_update_at,
  last_measurements_update_at,
  last_update_request_sent_at,
  profile_reviewed_at,
  created_at,
  updated_at
`;

const socialLinksSelect = `
  id,
  model_id,
  instagram,
  tiktok,
  youtube,
  xiaohongshu,
  weibo,
  wechat_id,
  website,
  external_portfolio_url,
  composite_url,
  created_at,
  updated_at
`;

const documentsSelect = `
  id,
  model_id,
  cpf,
  rg,
  passport_number,
  passport_expiration,
  visa_us,
  visa_eu,
  visa_china,
  other_visas,
  legal_guardian_name,
  legal_guardian_document,
  legal_guardian_phone,
  legal_guardian_email,
  travel_authorization_file,
  agency_contract_file,
  proof_of_address_file,
  banking_info_private,
  created_at,
  updated_at
`;

const skillsSelect = `
  id,
  model_id,
  acting,
  dancing,
  singing,
  swimming,
  surfing,
  skating,
  skiing,
  yoga,
  pilates,
  running,
  gym,
  martial_arts,
  cycling,
  horseback_riding,
  drives_car,
  drives_motorcycle,
  has_drivers_license,
  languages,
  instruments,
  runway_experience,
  ecommerce_experience,
  beauty_experience,
  tv_commercial_experience,
  approved_for_client_view,
  created_at,
  updated_at
`;

const workHistorySelect = `
  id,
  model_id,
  brand,
  year,
  market,
  category,
  photographer,
  client,
  agency,
  link,
  notes,
  approved_for_client_view,
  created_at,
  updated_at
`;

const healthLogisticsSelect = `
  id,
  model_id,
  food_restrictions,
  allergies,
  medications_notes,
  travel_availability,
  passport_valid,
  can_travel_internationally,
  accepts_out_of_city_jobs,
  accepts_hair_change,
  accepts_lingerie,
  accepts_swimwear,
  accepts_artistic_nudity,
  commercial_restrictions,
  created_at,
  updated_at
`;

const representationSelect = `
  id,
  model_id,
  mother_agency,
  international_agencies,
  available_markets,
  previous_markets,
  exclusive_contract,
  contract_start_date,
  contract_end_date,
  agency_commission,
  model_commission,
  responsible_booker,
  commercial_status,
  strategic_notes,
  created_at,
  updated_at
`;

const mediaSelect = `
  id,
  model_id,
  media_type,
  storage_bucket,
  storage_path,
  title,
  thumbnail_path,
  status,
  visibility,
  sort_order,
  uploaded_by,
  review_notes,
  created_at,
  updated_at
`;

const updateRequestsSelect = `
  id,
  model_id,
  requested_by,
  email_to,
  requested_sections,
  message,
  status,
  sent_at,
  completed_at,
  created_at,
  updated_at
`;

export type ModelInput = {
  bio?: string | null;
  birth_date?: string | null;
  bust_cm?: number | null;
  categories?: string[];
  clothing_size?: string | null;
  consent_lgpd?: boolean;
  display_name: string;
  email?: string | null;
  eye_color?: string | null;
  gender?: string | null;
  hair_color?: string | null;
  height_cm?: number | null;
  hips_cm?: number | null;
  is_published?: boolean;
  legal_name?: string | null;
  location?: string | null;
  nationality?: string | null;
  notes?: string | null;
  phone?: string | null;
  shoe_size?: string | null;
  stage_name?: string;
  status?: ModelStatus;
  tags?: string[];
  waist_cm?: number | null;
};

export type ModelBasicInput = {
  stage_name: string;
  display_name: string;
  legal_name: string | null;
  gender: string | null;
  pronouns: string | null;
  birth_date: string | null;
  is_minor: boolean;
  nationality: string | null;
  current_city: string | null;
  current_country: string | null;
  base_city: string | null;
  base_country: string | null;
  categories: string[];
  model_type: string | null;
  status: ModelStatus;
  is_published: boolean;
  location: string | null;
  bio: string | null;
};

export type ModelMeasurementsInput = {
  height_cm: number | null;
  bust_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  shoe_size: string | null;
  shoe_size_br: string | null;
  shoe_size_eu: string | null;
  shoe_size_us: string | null;
  clothing_size: string | null;
  dress_size_br: string | null;
  dress_size_eu: string | null;
  dress_size_us: string | null;
  shirt_size: string | null;
  pants_size: string | null;
  suit_size: string | null;
  hair_color: string | null;
  hair_length: string | null;
  hair_type: string | null;
  eye_color: string | null;
  skin_tone: string | null;
  tattoos: string | null;
  piercings: string | null;
  visible_scars: string | null;
  braces: string | null;
};

export type ModelContactInput = {
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  wechat: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
};

type ModelTimestampInput = {
  last_profile_update_at?: string | null;
  last_media_update_at?: string | null;
  last_measurements_update_at?: string | null;
  last_update_request_sent_at?: string | null;
  profile_reviewed_at?: string | null;
};

type ModelUpdateInput = Partial<
  ModelInput &
    ModelBasicInput &
    ModelMeasurementsInput &
    ModelContactInput &
    ModelTimestampInput
>;

export type ModelSocialLinksInput = Omit<
  ModelSocialLinks,
  "id" | "model_id" | "created_at" | "updated_at"
>;

export type ModelDocumentsInput = Omit<
  ModelDocuments,
  "id" | "model_id" | "created_at" | "updated_at"
>;

export type ModelSkillsInput = Omit<
  ModelSkills,
  "id" | "model_id" | "created_at" | "updated_at"
>;

export type ModelWorkHistoryInput = Omit<
  ModelWorkHistory,
  "id" | "model_id" | "created_at" | "updated_at"
>;

export type ModelHealthLogisticsInput = Omit<
  ModelHealthLogistics,
  "id" | "model_id" | "created_at" | "updated_at"
>;

export type ModelRepresentationInput = Omit<
  ModelRepresentation,
  "id" | "model_id" | "created_at" | "updated_at"
>;

export async function listModels() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .select(modelSelect)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Model[];
}

export async function listClientModelProfiles() {
  await requireRole(["admin", "client"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("model_client_profiles")
    .select("*")
    .order("stage_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ModelClientProfile[];
}

export async function getModel(id: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .select(modelSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Model | null;
}

export async function getModelProfile(id: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { data: model, error: modelError } = await supabase
    .from("models")
    .select(modelSelect)
    .eq("id", id)
    .maybeSingle();

  if (modelError) {
    throw modelError;
  }

  if (!model) {
    return null;
  }

  const [
    socialLinksResult,
    documentsResult,
    skillsResult,
    workHistoryResult,
    healthLogisticsResult,
    representationResult,
    mediaResult,
    updateRequestsResult
  ] = await Promise.all([
    supabase
      .from("model_social_links")
      .select(socialLinksSelect)
      .eq("model_id", id)
      .maybeSingle(),
    supabase
      .from("model_documents")
      .select(documentsSelect)
      .eq("model_id", id)
      .maybeSingle(),
    supabase
      .from("model_skills")
      .select(skillsSelect)
      .eq("model_id", id)
      .maybeSingle(),
    supabase
      .from("model_work_history")
      .select(workHistorySelect)
      .eq("model_id", id)
      .order("year", { ascending: false, nullsFirst: false }),
    supabase
      .from("model_health_logistics")
      .select(healthLogisticsSelect)
      .eq("model_id", id)
      .maybeSingle(),
    supabase
      .from("model_representation")
      .select(representationSelect)
      .eq("model_id", id)
      .maybeSingle(),
    supabase
      .from("model_media")
      .select(mediaSelect)
      .eq("model_id", id)
      .order("sort_order", { ascending: true, nullsFirst: false }),
    supabase
      .from("model_update_requests")
      .select(updateRequestsSelect)
      .eq("model_id", id)
      .order("sent_at", { ascending: false })
  ]);

  const results = [
    socialLinksResult,
    documentsResult,
    skillsResult,
    workHistoryResult,
    healthLogisticsResult,
    representationResult,
    mediaResult,
    updateRequestsResult
  ];

  for (const result of results) {
    if (result.error) {
      throw result.error;
    }
  }

  return {
    model: model as Model,
    socialLinks: socialLinksResult.data as ModelSocialLinks | null,
    documents: documentsResult.data as ModelDocuments | null,
    skills: skillsResult.data as ModelSkills | null,
    workHistory: (workHistoryResult.data ?? []) as ModelWorkHistory[],
    healthLogistics:
      healthLogisticsResult.data as ModelHealthLogistics | null,
    representation:
      representationResult.data as ModelRepresentation | null,
    media: (mediaResult.data ?? []) as ModelMedia[],
    updateRequests: (updateRequestsResult.data ?? []) as ModelUpdateRequest[]
  } satisfies ModelProfile;
}

export async function createModel(input: ModelInput) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .insert(input)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data as { id: string };
}

export async function updateModel(
  id: string,
  input: ModelUpdateInput
) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("models").update(input).eq("id", id);

  if (error) {
    throw error;
  }
}

export async function updateModelSocialLinks(
  modelId: string,
  input: ModelSocialLinksInput
) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("model_social_links")
    .upsert({ model_id: modelId, ...input }, { onConflict: "model_id" });

  if (error) {
    throw error;
  }
}

export async function updateModelDocuments(
  modelId: string,
  input: ModelDocumentsInput
) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("model_documents")
    .upsert({ model_id: modelId, ...input }, { onConflict: "model_id" });

  if (error) {
    throw error;
  }
}

export async function updateModelSkills(
  modelId: string,
  input: ModelSkillsInput
) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("model_skills")
    .upsert({ model_id: modelId, ...input }, { onConflict: "model_id" });

  if (error) {
    throw error;
  }
}

export async function createModelWorkHistory(
  modelId: string,
  input: ModelWorkHistoryInput
) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("model_work_history")
    .insert({ model_id: modelId, ...input });

  if (error) {
    throw error;
  }
}

export async function deleteModelWorkHistory(modelId: string, workId: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("model_work_history")
    .delete()
    .eq("model_id", modelId)
    .eq("id", workId);

  if (error) {
    throw error;
  }
}

export async function updateModelHealthLogistics(
  modelId: string,
  input: ModelHealthLogisticsInput
) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("model_health_logistics")
    .upsert({ model_id: modelId, ...input }, { onConflict: "model_id" });

  if (error) {
    throw error;
  }
}

export async function updateModelRepresentation(
  modelId: string,
  input: ModelRepresentationInput
) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("model_representation")
    .upsert({ model_id: modelId, ...input }, { onConflict: "model_id" });

  if (error) {
    throw error;
  }
}

export async function updateModelMediaStatus(
  mediaId: string,
  status: MediaStatus
) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("model_media")
    .update({ status })
    .eq("id", mediaId);

  if (error) {
    throw error;
  }
}

export async function createModelUpdateRequest(modelId: string) {
  const profile = await requireRole(["admin"]);
  const model = await getModel(modelId);
  const supabase = await createClient();
  const sentAt = new Date().toISOString();

  if (!model) {
    throw new Error("Modelo não encontrado.");
  }

  const { error: requestError } = await supabase
    .from("model_update_requests")
    .insert({
      model_id: modelId,
      requested_by: profile.id,
      email_to: model?.email ?? null,
      requested_sections: ["perfil", "medidas", "midia"],
      message: "Pedido administrativo de atualização de perfil.",
      status: "sent",
      sent_at: sentAt
    });

  if (requestError) {
    throw requestError;
  }

  await updateModel(modelId, {
    last_update_request_sent_at: sentAt
  });
}

export async function touchModelProfileReviewed(modelId: string) {
  const model = await getModel(modelId);

  if (!model) {
    throw new Error("Modelo não encontrado.");
  }

  await updateModel(modelId, {
    profile_reviewed_at: new Date().toISOString()
  });
}

export async function touchModelMeasurementsUpdated(modelId: string) {
  const model = await getModel(modelId);

  if (!model) {
    throw new Error("Modelo não encontrado.");
  }

  await updateModel(modelId, {
    last_measurements_update_at: new Date().toISOString()
  });
}

export async function touchModelMediaUpdated(modelId: string) {
  const model = await getModel(modelId);

  if (!model) {
    throw new Error("Modelo não encontrado.");
  }

  await updateModel(modelId, {
    last_media_update_at: new Date().toISOString()
  });
}

export async function deleteModel(id: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("models").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

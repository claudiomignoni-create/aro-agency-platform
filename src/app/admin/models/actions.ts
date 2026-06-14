"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  nullableNumber,
  nullableString,
  requiredString,
  stringList
} from "@/lib/form-data";
import { requireRole } from "@/lib/auth";
import {
  createModel,
  createModelMedia,
  createModelMediaDownloadUrl,
  createModelOption,
  createModelMediaPreviewUrls,
  createModelUpdateRequest,
  createModelWorkHistory,
  deleteModel,
  deleteModelMedia,
  deleteModelWorkHistory,
  getModel,
  touchModelMeasurementsUpdated,
  touchModelMediaUpdated,
  touchModelProfileReviewed,
  updateModel,
  updateModelDocuments,
  updateModelHealthLogistics,
  updateModelInternationalAgencies,
  updateModelMainImageFromMedia,
  updateModelMediaStatus,
  updateModelMediaTitle,
  updateModelMediaContractDetails,
  updateModelMediaVisibility,
  updateModelRepresentation,
  updateModelSkills,
  updateModelSocialLinks,
  type ModelBasicInput,
  type ModelContactInput,
  type ModelDocumentsInput,
  type ModelHealthLogisticsInput,
  type ModelInput,
  type ModelInternationalAgencyInput,
  type ModelMeasurementsInput,
  type ModelMediaInput,
  type ModelOptionInput,
  type ModelRepresentationInput,
  type ModelSkillsInput,
  type ModelSocialLinksInput,
  type ModelWorkHistoryInput
} from "@/lib/models";
import { sendModelProfileUpdateRequestEmail } from "@/lib/email";
import {
  createMediaUpdateRequestNotification,
  createMeasurementsUpdateRequestNotification,
  createProfileUpdateRequestNotification
} from "@/lib/notifications";
import type {
  MediaStatus,
  MediaType,
  MediaVisibility,
  ModelOptionType,
  ModelStatus
} from "@/types/database";

const allowedStatuses: ModelStatus[] = [
  "draft",
  "pending_review",
  "approved",
  "archived"
];

const allowedMediaStatuses: MediaStatus[] = [
  "pending_review",
  "approved",
  "rejected",
  "archived"
];

const allowedUploadMediaStatuses: MediaStatus[] = [
  "pending_review",
  "approved"
];

const allowedMediaTypes: MediaType[] = [
  "portfolio",
  "polaroid",
  "video",
  "document"
];

const allowedMediaVisibilities: MediaVisibility[] = [
  "private",
  "client_only",
  "public"
];

const allowedModelOptionTypes: ModelOptionType[] = [
  "skill",
  "sport",
  "hobby",
  "language",
  "instrument"
];

const mediaCategoryTypes: Record<string, MediaType> = {
  book: "portfolio",
  documents: "document",
  polaroids: "polaroid",
  videos: "video"
};

const mediaCategoryAccepts: Record<string, RegExp> = {
  book: /^image\//,
  documents: /^(application\/pdf|image\/)/,
  polaroids: /^image\//,
  videos: /^video\//
};

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function statusFromFormData(formData: FormData) {
  const status = requiredString(formData, "status") as ModelStatus;

  if (!allowedStatuses.includes(status)) {
    throw new Error("Status inválido.");
  }

  return status;
}

function mediaInputsFromFormData(formData: FormData): ModelMediaInput[] {
  const files = formData
    .getAll("files")
    .filter((file): file is File => file instanceof File && file.size > 0);
  const mediaCategory = requiredString(formData, "media_category");
  const mediaType = requiredString(formData, "media_type") as MediaType;
  const status = (formData.get("media_status") ||
    "pending_review") as MediaStatus;
  const visibility = (formData.get("media_visibility") ||
    "private") as MediaVisibility;
  const expectedMediaType = mediaCategoryTypes[mediaCategory];
  const acceptPattern = mediaCategoryAccepts[mediaCategory];

  if (files.length === 0) {
    throw new Error("Selecione ao menos um arquivo para upload.");
  }

  if (!expectedMediaType) {
    throw new Error("Categoria de mídia ainda não disponível para upload.");
  }

  if (!allowedMediaTypes.includes(mediaType)) {
    throw new Error("Tipo de mídia inválido.");
  }

  if (expectedMediaType !== mediaType) {
    throw new Error("Categoria e tipo de mídia não correspondem.");
  }

  if (!allowedUploadMediaStatuses.includes(status)) {
    throw new Error("Status de mídia inválido para upload.");
  }

  if (!allowedMediaVisibilities.includes(visibility)) {
    throw new Error("Visibilidade de mídia inválida.");
  }

  for (const file of files) {
    if (!acceptPattern.test(file.type || "application/octet-stream")) {
      throw new Error("Um ou mais arquivos não correspondem à categoria escolhida.");
    }
  }

  return files.map((file) => ({
    file,
    media_type: mediaType,
    review_notes: nullableString(formData, "review_notes"),
    sort_order: null,
    status,
    title: nullableString(formData, "title") || file.name,
    visibility: mediaType === "document" ? "private" : visibility
  }));
}

function mediaIdsFromFormData(formData: FormData) {
  return formData
    .getAll("media_ids")
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function stringValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function stringListValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function nullableValue(value: FormDataEntryValue | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized.length ? normalized : null;
}

function modelOptionInputFromFormData(formData: FormData): ModelOptionInput {
  const optionType = requiredString(formData, "option_type") as ModelOptionType;

  if (!allowedModelOptionTypes.includes(optionType)) {
    throw new Error("Tipo de opção inválido.");
  }

  return {
    label: requiredString(formData, "label"),
    option_type: optionType
  };
}

function mediaVisibilityFromFormData(formData: FormData) {
  const visibility = requiredString(
    formData,
    "media_visibility"
  ) as MediaVisibility;

  if (!allowedMediaVisibilities.includes(visibility)) {
    throw new Error("Visibilidade de mídia inválida.");
  }

  return visibility;
}

function revalidateModelPaths(id: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/models");
  revalidatePath(`/admin/models/${id}`);
  revalidatePath(`/admin/models/${id}/edit`);
}

function redirectToTab(id: string, tab: string) {
  redirect(`/admin/models/${id}/edit?tab=${tab}&saved=1`);
}

function displayNameFromModel(model: { display_name: string; stage_name: string | null; legal_name: string | null }) {
  return model.stage_name ?? model.display_name ?? model.legal_name ?? "Modelo";
}

type ModelUpdateRequestKind = "profile" | "measurements" | "media";

const modelUpdateRequestConfig = {
  media: {
    actionUrl: "/model/media",
    notice: "media_update_requested",
    templateKey: "model_media_update_request" as const
  },
  measurements: {
    actionUrl: "/model/profile",
    notice: "measurements_update_requested",
    templateKey: "model_measurements_update_request" as const
  },
  profile: {
    actionUrl: "/model/profile",
    notice: "profile_update_requested",
    templateKey: "model_profile_update_request" as const
  }
};

function modelInputFromFormData(formData: FormData): ModelInput {
  const status = statusFromFormData(formData);
  const displayName = requiredString(formData, "display_name");
  const isPublished = checked(formData, "is_published");

  return {
    bio: nullableString(formData, "bio"),
    birth_date: nullableString(formData, "birth_date"),
    bust_cm: nullableNumber(formData, "bust_cm"),
    categories: stringList(formData, "categories"),
    clothing_size: nullableString(formData, "clothing_size"),
    consent_lgpd: checked(formData, "consent_lgpd"),
    display_name: displayName,
    email: nullableString(formData, "email"),
    eye_color: nullableString(formData, "eye_color"),
    gender: nullableString(formData, "gender"),
    hair_color: nullableString(formData, "hair_color"),
    height_cm: nullableNumber(formData, "height_cm"),
    hips_cm: nullableNumber(formData, "hips_cm"),
    is_published: status === "approved" ? isPublished : false,
    legal_name: nullableString(formData, "legal_name"),
    location: nullableString(formData, "location"),
    nationality: nullableString(formData, "nationality"),
    notes: nullableString(formData, "notes"),
    phone: nullableString(formData, "phone"),
    shoe_size: nullableString(formData, "shoe_size"),
    stage_name: displayName,
    status,
    tags: stringList(formData, "tags"),
    waist_cm: nullableNumber(formData, "waist_cm")
  };
}

function basicInputFromFormData(formData: FormData): ModelBasicInput {
  const status = statusFromFormData(formData);
  const stageName = requiredString(formData, "stage_name");
  const currentCity = nullableString(formData, "current_city");
  const currentCountry = nullableString(formData, "current_country");
  const fallbackLocation = [currentCity, currentCountry]
    .filter(Boolean)
    .join(", ");
  const location = nullableString(formData, "location") ?? fallbackLocation;

  return {
    base_city: nullableString(formData, "base_city"),
    base_country: nullableString(formData, "base_country"),
    bio: nullableString(formData, "bio"),
    birth_date: nullableString(formData, "birth_date"),
    categories: stringListValues(formData, "categories"),
    current_city: currentCity,
    current_country: currentCountry,
    display_name: stageName,
    gender: nullableString(formData, "gender"),
    is_minor: checked(formData, "is_minor"),
    is_published: status === "approved" && checked(formData, "is_published"),
    legal_name: nullableString(formData, "legal_name"),
    location: location || null,
    model_type: nullableString(formData, "model_type"),
    nationality: nullableString(formData, "nationality"),
    pronouns: nullableString(formData, "pronouns"),
    stage_name: stageName,
    status
  };
}

function measurementsInputFromFormData(
  formData: FormData
): ModelMeasurementsInput {
  const shoeSizeBr = nullableString(formData, "shoe_size_br");
  const dressSizeBr = nullableString(formData, "dress_size_br");

  return {
    braces: nullableString(formData, "braces"),
    bust_cm: nullableNumber(formData, "bust_cm"),
    clothing_size: dressSizeBr,
    dress_size_br: dressSizeBr,
    dress_size_eu: nullableString(formData, "dress_size_eu"),
    dress_size_us: nullableString(formData, "dress_size_us"),
    eye_color: nullableString(formData, "eye_color"),
    hair_color: nullableString(formData, "hair_color"),
    hair_length: nullableString(formData, "hair_length"),
    hair_type: nullableString(formData, "hair_type"),
    height_cm: nullableNumber(formData, "height_cm"),
    hips_cm: nullableNumber(formData, "hips_cm"),
    pants_size: nullableString(formData, "pants_size"),
    piercings: nullableString(formData, "piercings"),
    shirt_size: nullableString(formData, "shirt_size"),
    shoe_size: shoeSizeBr,
    shoe_size_br: shoeSizeBr,
    shoe_size_eu: nullableString(formData, "shoe_size_eu"),
    shoe_size_us: nullableString(formData, "shoe_size_us"),
    skin_tone: nullableString(formData, "skin_tone"),
    suit_size: nullableString(formData, "suit_size"),
    tattoos: nullableString(formData, "tattoos"),
    visible_scars: nullableString(formData, "visible_scars"),
    waist_cm: nullableNumber(formData, "waist_cm")
  };
}

function contactInputFromFormData(formData: FormData): ModelContactInput {
  return {
    address_line: nullableString(formData, "address_line"),
    city: nullableString(formData, "city"),
    country: nullableString(formData, "country"),
    email: nullableString(formData, "email"),
    emergency_contact_name: nullableString(
      formData,
      "emergency_contact_name"
    ),
    emergency_contact_phone: nullableString(
      formData,
      "emergency_contact_phone"
    ),
    emergency_contact_relationship: nullableString(
      formData,
      "emergency_contact_relationship"
    ),
    phone: nullableString(formData, "phone"),
    postal_code: nullableString(formData, "postal_code"),
    state: nullableString(formData, "state"),
    whatsapp: nullableString(formData, "whatsapp"),
    wechat: nullableString(formData, "wechat")
  };
}

function socialLinksInputFromFormData(
  formData: FormData
): ModelSocialLinksInput {
  return {
    composite_url: nullableString(formData, "composite_url"),
    external_portfolio_url: nullableString(
      formData,
      "external_portfolio_url"
    ),
    instagram: nullableString(formData, "instagram"),
    tiktok: nullableString(formData, "tiktok"),
    website: nullableString(formData, "website"),
    wechat_id: nullableString(formData, "wechat_id"),
    weibo: nullableString(formData, "weibo"),
    xiaohongshu: nullableString(formData, "xiaohongshu"),
    youtube: nullableString(formData, "youtube")
  };
}

function documentsInputFromFormData(formData: FormData): ModelDocumentsInput {
  return {
    agency_contract_file: nullableString(formData, "agency_contract_file"),
    banking_info_private: nullableString(formData, "banking_info_private"),
    cpf: nullableString(formData, "cpf"),
    legal_guardian_document: nullableString(
      formData,
      "legal_guardian_document"
    ),
    legal_guardian_email: nullableString(formData, "legal_guardian_email"),
    legal_guardian_name: nullableString(formData, "legal_guardian_name"),
    legal_guardian_phone: nullableString(formData, "legal_guardian_phone"),
    other_visas: nullableString(formData, "other_visas"),
    passport_expiration: nullableString(formData, "passport_expiration"),
    passport_number: nullableString(formData, "passport_number"),
    proof_of_address_file: nullableString(formData, "proof_of_address_file"),
    rg: nullableString(formData, "rg"),
    travel_authorization_file: nullableString(
      formData,
      "travel_authorization_file"
    ),
    visa_china: nullableString(formData, "visa_china"),
    visa_eu: nullableString(formData, "visa_eu"),
    visa_us: nullableString(formData, "visa_us")
  };
}

function skillsInputFromFormData(formData: FormData): ModelSkillsInput {
  const languages = stringValues(formData, "languages");
  const languageLevels = Object.fromEntries(
    languages.map((language) => [
      language,
      nullableString(formData, `language_level:${language}`) ?? ""
    ])
  );

  return {
    acting: checked(formData, "acting"),
    approved_for_client_view: checked(formData, "approved_for_client_view"),
    beauty_experience: checked(formData, "beauty_experience"),
    cycling: checked(formData, "cycling"),
    dancing: checked(formData, "dancing"),
    drives_car: checked(formData, "drives_car"),
    drives_motorcycle: checked(formData, "drives_motorcycle"),
    ecommerce_experience: checked(formData, "ecommerce_experience"),
    gym: checked(formData, "gym"),
    has_drivers_license: checked(formData, "has_drivers_license"),
    horseback_riding: checked(formData, "horseback_riding"),
    hobby_options: stringValues(formData, "hobby_options"),
    instruments: stringValues(formData, "instruments"),
    languages,
    language_levels: languageLevels,
    martial_arts: checked(formData, "martial_arts"),
    pilates: checked(formData, "pilates"),
    running: checked(formData, "running"),
    runway_experience: checked(formData, "runway_experience"),
    singing: checked(formData, "singing"),
    skating: checked(formData, "skating"),
    skiing: checked(formData, "skiing"),
    skill_options: stringValues(formData, "skill_options"),
    sport_options: stringValues(formData, "sport_options"),
    surfing: checked(formData, "surfing"),
    swimming: checked(formData, "swimming"),
    tv_commercial_experience: checked(formData, "tv_commercial_experience"),
    yoga: checked(formData, "yoga")
  };
}

function workHistoryInputFromFormData(
  formData: FormData
): ModelWorkHistoryInput {
  return {
    agency: nullableString(formData, "agency"),
    approved_for_client_view: checked(formData, "approved_for_client_view"),
    brand: requiredString(formData, "brand"),
    category: nullableString(formData, "category"),
    client: nullableString(formData, "client"),
    link: nullableString(formData, "link"),
    market: nullableString(formData, "market"),
    notes: nullableString(formData, "notes"),
    photographer: nullableString(formData, "photographer"),
    year: nullableNumber(formData, "year")
  };
}

function healthLogisticsInputFromFormData(
  formData: FormData
): ModelHealthLogisticsInput {
  return {
    accepts_artistic_nudity: checked(formData, "accepts_artistic_nudity"),
    accepts_hair_change: checked(formData, "accepts_hair_change"),
    accepts_lingerie: checked(formData, "accepts_lingerie"),
    accepts_out_of_city_jobs: checked(formData, "accepts_out_of_city_jobs"),
    accepts_swimwear: checked(formData, "accepts_swimwear"),
    allergies: nullableString(formData, "allergies"),
    can_travel_internationally: checked(
      formData,
      "can_travel_internationally"
    ),
    commercial_restrictions: nullableString(
      formData,
      "commercial_restrictions"
    ),
    drivers_license_category: nullableString(formData, "drivers_license_category"),
    drivers_license_country: nullableString(formData, "drivers_license_country"),
    drivers_license_notes: nullableString(formData, "drivers_license_notes"),
    drivers_license_number: nullableString(formData, "drivers_license_number"),
    food_restrictions: nullableString(formData, "food_restrictions"),
    has_drivers_license: checked(formData, "has_drivers_license"),
    medications_notes: nullableString(formData, "medications_notes"),
    passport_valid: checked(formData, "passport_valid"),
    travel_availability: nullableString(formData, "travel_availability")
  };
}

function representationInputFromFormData(
  formData: FormData
): ModelRepresentationInput {
  const structuredAgencyNames = stringValues(formData, "agency_name");

  return {
    agency_commission: nullableNumber(formData, "agency_commission"),
    available_markets: stringList(formData, "available_markets"),
    commercial_status: nullableString(formData, "commercial_status"),
    contract_end_date: nullableString(formData, "contract_end_date"),
    contract_start_date: nullableString(formData, "contract_start_date"),
    exclusive_contract: checked(formData, "exclusive_contract"),
    international_agencies: structuredAgencyNames.length
      ? structuredAgencyNames
      : stringListValues(formData, "international_agencies"),
    model_commission: nullableNumber(formData, "model_commission"),
    mother_agency: nullableString(formData, "mother_agency"),
    previous_markets: stringList(formData, "previous_markets"),
    responsible_booker: nullableString(formData, "responsible_booker"),
    strategic_notes: nullableString(formData, "strategic_notes")
  };
}

function internationalAgenciesInputFromFormData(
  formData: FormData
): ModelInternationalAgencyInput[] {
  const names = formData.getAll("agency_name");
  const countries = formData.getAll("agency_country");
  const cities = formData.getAll("agency_city");
  const starts = formData.getAll("agency_contract_start_date");
  const ends = formData.getAll("agency_contract_end_date");

  return names
    .map((name, index) => ({
      agency_name: String(name ?? "").trim(),
      city: nullableValue(cities[index]),
      contract_end_date: nullableValue(ends[index]),
      contract_start_date: nullableValue(starts[index]),
      country: nullableValue(countries[index])
    }))
    .filter((agency) => agency.agency_name.length > 0);
}

export async function createModelAction(formData: FormData) {
  await requireRole(["admin"]);
  const model = await createModel(modelInputFromFormData(formData));
  revalidatePath("/admin");
  revalidatePath("/admin/models");
  redirect(`/admin/models/${model.id}/edit?saved=created`);
}

export async function updateModelAction(id: string, formData: FormData) {
  await requireRole(["admin"]);
  await updateModel(id, modelInputFromFormData(formData));
  revalidateModelPaths(id);
  redirect(`/admin/models/${id}/edit?saved=1`);
}

export async function updateModelBasicAction(id: string, formData: FormData) {
  await requireRole(["admin"]);
  await updateModel(id, {
    ...basicInputFromFormData(formData),
    ...measurementsInputFromFormData(formData),
    ...contactInputFromFormData(formData),
    last_measurements_update_at: new Date().toISOString(),
    last_profile_update_at: new Date().toISOString()
  });
  await updateModelSocialLinks(id, socialLinksInputFromFormData(formData));
  revalidateModelPaths(id);
  redirectToTab(id, "basic");
}

export async function updateModelMeasurementsAction(
  id: string,
  formData: FormData
) {
  await requireRole(["admin"]);
  await updateModel(id, {
    ...measurementsInputFromFormData(formData),
    last_measurements_update_at: new Date().toISOString()
  });
  revalidateModelPaths(id);
  redirectToTab(id, "measurements");
}

export async function updateModelContactAction(id: string, formData: FormData) {
  await requireRole(["admin"]);
  await updateModel(id, contactInputFromFormData(formData));
  revalidateModelPaths(id);
  redirectToTab(id, "contact");
}

export async function updateModelSocialLinksAction(
  id: string,
  formData: FormData
) {
  await requireRole(["admin"]);
  await updateModelSocialLinks(id, socialLinksInputFromFormData(formData));
  revalidateModelPaths(id);
  redirectToTab(id, "social");
}

export async function updateModelDocumentsAction(
  id: string,
  formData: FormData
) {
  await requireRole(["admin"]);
  await updateModelDocuments(id, documentsInputFromFormData(formData));
  revalidateModelPaths(id);
  redirectToTab(id, "documents");
}

export async function updateModelSkillsAction(id: string, formData: FormData) {
  await requireRole(["admin"]);
  await updateModelSkills(id, skillsInputFromFormData(formData));
  revalidateModelPaths(id);
  redirectToTab(id, "skills");
}

export async function createModelOptionAction(id: string, formData: FormData) {
  await requireRole(["admin"]);
  await createModelOption(modelOptionInputFromFormData(formData));
  revalidateModelPaths(id);
  redirectToTab(id, "skills");
}

export async function createModelWorkHistoryAction(
  id: string,
  formData: FormData
) {
  await requireRole(["admin"]);
  await createModelWorkHistory(id, workHistoryInputFromFormData(formData));
  revalidateModelPaths(id);
  redirectToTab(id, "work");
}

export async function deleteModelWorkHistoryAction(id: string, workId: string) {
  await requireRole(["admin"]);
  await deleteModelWorkHistory(id, workId);
  revalidateModelPaths(id);
  redirectToTab(id, "work");
}

export async function updateModelHealthLogisticsAction(
  id: string,
  formData: FormData
) {
  await requireRole(["admin"]);
  await updateModelHealthLogistics(
    id,
    healthLogisticsInputFromFormData(formData)
  );
  revalidateModelPaths(id);
  redirectToTab(id, "health");
}

export async function updateModelRepresentationAction(
  id: string,
  formData: FormData
) {
  await requireRole(["admin"]);
  await updateModelRepresentation(
    id,
    representationInputFromFormData(formData)
  );
  await updateModelInternationalAgencies(
    id,
    internationalAgenciesInputFromFormData(formData)
  );
  revalidateModelPaths(id);
  redirectToTab(id, "representation");
}

export async function updateModelInternalNotesAction(
  id: string,
  formData: FormData
) {
  await requireRole(["admin"]);
  await updateModel(id, {
    notes: nullableString(formData, "notes"),
    tags: stringList(formData, "tags")
  });
  revalidateModelPaths(id);
  redirectToTab(id, "internal");
}

export async function updateModelMediaStatusAction(
  id: string,
  mediaId: string,
  status: MediaStatus
) {
  await requireRole(["admin"]);

  if (!allowedMediaStatuses.includes(status)) {
    throw new Error("Status de mídia inválido.");
  }

  await updateModelMediaStatus(id, mediaId, status);
  revalidateModelPaths(id);
  redirectToTab(id, "media");
}

export async function updateModelMediaBatchStatusAction(
  id: string,
  status: MediaStatus,
  formData: FormData
) {
  await requireRole(["admin"]);

  if (!allowedMediaStatuses.includes(status)) {
    throw new Error("Status de mídia inválido.");
  }

  for (const mediaId of mediaIdsFromFormData(formData)) {
    await updateModelMediaStatus(id, mediaId, status);
  }

  revalidateModelPaths(id);
  redirectToTab(id, "media");
}

export async function updateModelMediaTitleAction(
  id: string,
  mediaId: string,
  formData: FormData
) {
  await requireRole(["admin"]);
  const title = nullableString(formData, "title");

  if (title && title.length > 120) {
    throw new Error("Título de mídia muito longo.");
  }

  await updateModelMediaTitle(id, mediaId, title);
  revalidateModelPaths(id);
  redirectToTab(id, "media");
}

function contractValidUntilFromFormData(formData: FormData) {
  const validUntil = nullableString(formData, "valid_until");

  if (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) {
    throw new Error("Data de validade inválida.");
  }

  return validUntil;
}

export async function updateModelMediaContractDetailsAction(
  id: string,
  mediaId: string,
  formData: FormData
) {
  await requireRole(["admin"]);
  const notes = nullableString(formData, "notes");

  if (notes && notes.length > 600) {
    throw new Error("Observação muito longa.");
  }

  await updateModelMediaContractDetails(id, mediaId, {
    notes,
    valid_until: contractValidUntilFromFormData(formData)
  });
  revalidateModelPaths(id);
  redirectToTab(id, "media");
}

export async function updateModelMediaVisibilityAction(
  id: string,
  mediaId: string,
  formData: FormData
) {
  await requireRole(["admin"]);
  await updateModelMediaVisibility(
    id,
    mediaId,
    mediaVisibilityFromFormData(formData)
  );
  revalidateModelPaths(id);
  redirectToTab(id, "media");
}

export async function updateModelMediaBatchVisibilityAction(
  id: string,
  formData: FormData
) {
  await requireRole(["admin"]);
  const visibility = mediaVisibilityFromFormData(formData);

  for (const mediaId of mediaIdsFromFormData(formData)) {
    await updateModelMediaVisibility(id, mediaId, visibility);
  }

  revalidateModelPaths(id);
  redirectToTab(id, "media");
}

export async function getModelMediaPreviewUrlsAction(id: string) {
  await requireRole(["admin"]);
  return createModelMediaPreviewUrls(id);
}

export async function getModelMediaOriginalUrlAction(
  id: string,
  mediaId: string
) {
  await requireRole(["admin"]);
  return createModelMediaDownloadUrl(id, mediaId);
}

export async function createModelMediaAction(id: string, formData: FormData) {
  await requireRole(["admin"]);
  for (const input of mediaInputsFromFormData(formData)) {
    await createModelMedia(id, input);
  }
  revalidateModelPaths(id);
  redirectToTab(id, "media");
}

export async function downloadModelMediaAction(id: string, mediaId: string) {
  await requireRole(["admin"]);
  const signedUrl = await createModelMediaDownloadUrl(id, mediaId);
  redirect(signedUrl);
}

export async function deleteModelMediaAction(id: string, mediaId: string) {
  await requireRole(["admin"]);
  await deleteModelMedia(id, mediaId);
  revalidateModelPaths(id);
  redirectToTab(id, "media");
}

export async function deleteModelMediaBatchAction(id: string, formData: FormData) {
  await requireRole(["admin"]);

  for (const mediaId of mediaIdsFromFormData(formData)) {
    await deleteModelMedia(id, mediaId);
  }

  revalidateModelPaths(id);
  redirectToTab(id, "media");
}

export async function updateModelMainImageAction(id: string, mediaId: string) {
  await requireRole(["admin"]);
  await updateModelMainImageFromMedia(id, mediaId);
  revalidateModelPaths(id);
  redirectToTab(id, "media");
}

export async function sendModelUpdateRequestAction(id: string) {
  await requireRole(["admin"]);
  await createModelUpdateRequest(id);
  revalidateModelPaths(id);
  redirectToTab(id, "history");
}

async function requestModelUpdateByKind(
  id: string,
  kind: ModelUpdateRequestKind
) {
  await requireRole(["admin"]);
  const model = await getModel(id);

  if (!model) {
    throw new Error("Modelo não encontrado.");
  }

  const config = modelUpdateRequestConfig[kind];
  const modelName = displayNameFromModel(model);
  let queuedSomething = false;

  if (model.user_id) {
    if (kind === "profile") {
      await createProfileUpdateRequestNotification({
        actionUrl: config.actionUrl,
        modelId: id,
        modelName,
        recipientProfileId: model.user_id
      });
    }

    if (kind === "measurements") {
      await createMeasurementsUpdateRequestNotification({
        actionUrl: config.actionUrl,
        modelId: id,
        modelName,
        recipientProfileId: model.user_id
      });
    }

    if (kind === "media") {
      await createMediaUpdateRequestNotification({
        actionUrl: config.actionUrl,
        modelId: id,
        modelName,
        recipientProfileId: model.user_id
      });
    }

    queuedSomething = true;
  }

  if (model.email) {
    await sendModelProfileUpdateRequestEmail({
      actionUrl: config.actionUrl,
      modelId: id,
      modelName,
      recipientEmail: model.email,
      recipientProfileId: model.user_id,
      templateKey: config.templateKey
    });
    queuedSomething = true;
  }

  if (!queuedSomething) {
    redirect(`/admin/models/${id}/edit?notice=missing_model_contact`);
  }

  await updateModel(id, {
    last_update_request_sent_at: new Date().toISOString()
  });
  revalidateModelPaths(id);
  revalidatePath("/admin/notifications");
  redirect(`/admin/models/${id}/edit?notice=${config.notice}`);
}

export async function requestModelProfileUpdateAction(id: string) {
  await requestModelUpdateByKind(id, "profile");
}

export async function requestModelMeasurementsUpdateAction(id: string) {
  await requestModelUpdateByKind(id, "measurements");
}

export async function requestModelMediaUpdateAction(id: string) {
  await requestModelUpdateByKind(id, "media");
}

export async function markProfileReviewedAction(id: string) {
  await requireRole(["admin"]);
  await touchModelProfileReviewed(id);
  revalidateModelPaths(id);
  redirectToTab(id, "history");
}

export async function markMeasurementsUpdatedAction(id: string) {
  await requireRole(["admin"]);
  await touchModelMeasurementsUpdated(id);
  revalidateModelPaths(id);
  redirectToTab(id, "history");
}

export async function markMediaUpdatedAction(id: string) {
  await requireRole(["admin"]);
  await touchModelMediaUpdated(id);
  revalidateModelPaths(id);
  redirectToTab(id, "history");
}

export async function updateModelStatusAction(id: string, status: ModelStatus) {
  await requireRole(["admin"]);

  if (!allowedStatuses.includes(status)) {
    throw new Error("Status inválido.");
  }

  await updateModel(id, {
    is_published: status === "approved",
    status
  });
  revalidateModelPaths(id);
}

export async function archiveModelAction(id: string) {
  await requireRole(["admin"]);
  await updateModel(id, {
    is_published: false,
    status: "archived"
  });
  revalidatePath("/admin");
  revalidatePath("/admin/models");
  redirect("/admin/models");
}

export async function deleteModelAction(id: string) {
  await requireRole(["admin"]);
  await deleteModel(id);
  revalidatePath("/admin");
  revalidatePath("/admin/models");
  redirect("/admin/models");
}

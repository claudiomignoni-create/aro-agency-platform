export type UserRole = "admin" | "model" | "client";

export type ClientType =
  | "international_agency"
  | "brand"
  | "production"
  | "photographer"
  | "casting_director"
  | "partner"
  | "other";

export type ClientStatus =
  | "lead"
  | "active"
  | "partner"
  | "inactive"
  | "do_not_contact";

export type ClientChannelType =
  | "instagram"
  | "personal_instagram"
  | "tiktok"
  | "wechat"
  | "rednote"
  | "linkedin"
  | "facebook"
  | "telegram"
  | "line"
  | "kakao_talk"
  | "whatsapp"
  | "website"
  | "email"
  | "phone"
  | "other";

export type ModelStatus = "draft" | "pending_review" | "approved" | "archived";

export type MediaStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "archived";

export type MediaType = "portfolio" | "polaroid" | "video" | "document";

export type MediaVisibility = "public" | "client_only" | "private";

export type RequestStatus =
  | "new"
  | "reviewing"
  | "proposed"
  | "confirmed"
  | "declined"
  | "archived";

export type AvailabilityStatus = "available" | "unavailable" | "tentative";

export type BookingStatus =
  | "tentative"
  | "confirmed"
  | "completed"
  | "canceled";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string | null;
  created_at: string;
  updated_at: string;
};

export type Model = {
  id: string;
  user_id: string | null;
  display_name: string;
  stage_name: string | null;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  wechat: string | null;
  status: ModelStatus;
  is_published: boolean;
  categories: string[];
  gender: string | null;
  pronouns: string | null;
  nationality: string | null;
  birth_date: string | null;
  is_minor: boolean;
  location: string | null;
  current_city: string | null;
  current_country: string | null;
  base_city: string | null;
  base_country: string | null;
  model_type: string | null;
  bio: string | null;
  main_image_path: string | null;
  height_cm: number | null;
  bust_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  shoe_size: string | null;
  shoe_size_br: string | null;
  shoe_size_eu: string | null;
  shoe_size_us: string | null;
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
  clothing_size: string | null;
  skin_tone: string | null;
  tattoos: string | null;
  piercings: string | null;
  visible_scars: string | null;
  braces: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  tags: string[];
  notes: string | null;
  consent_lgpd: boolean;
  last_profile_update_at: string | null;
  last_media_update_at: string | null;
  last_measurements_update_at: string | null;
  last_update_request_sent_at: string | null;
  profile_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ModelSocialLinks = {
  id: string;
  model_id: string;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  xiaohongshu: string | null;
  weibo: string | null;
  wechat_id: string | null;
  website: string | null;
  external_portfolio_url: string | null;
  composite_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ModelDocuments = {
  id: string;
  model_id: string;
  cpf: string | null;
  rg: string | null;
  passport_number: string | null;
  passport_expiration: string | null;
  visa_us: string | null;
  visa_eu: string | null;
  visa_china: string | null;
  other_visas: string | null;
  legal_guardian_name: string | null;
  legal_guardian_document: string | null;
  legal_guardian_phone: string | null;
  legal_guardian_email: string | null;
  travel_authorization_file: string | null;
  agency_contract_file: string | null;
  proof_of_address_file: string | null;
  banking_info_private: string | null;
  created_at: string;
  updated_at: string;
};

export type ModelSkills = {
  id: string;
  model_id: string;
  acting: boolean;
  dancing: boolean;
  singing: boolean;
  swimming: boolean;
  surfing: boolean;
  skating: boolean;
  skiing: boolean;
  yoga: boolean;
  pilates: boolean;
  running: boolean;
  gym: boolean;
  martial_arts: boolean;
  cycling: boolean;
  horseback_riding: boolean;
  drives_car: boolean;
  drives_motorcycle: boolean;
  has_drivers_license: boolean;
  languages: string[];
  instruments: string[];
  runway_experience: boolean;
  ecommerce_experience: boolean;
  beauty_experience: boolean;
  tv_commercial_experience: boolean;
  approved_for_client_view: boolean;
  created_at: string;
  updated_at: string;
};

export type ModelWorkHistory = {
  id: string;
  model_id: string;
  brand: string;
  year: number | null;
  market: string | null;
  category: string | null;
  photographer: string | null;
  client: string | null;
  agency: string | null;
  link: string | null;
  notes: string | null;
  approved_for_client_view: boolean;
  created_at: string;
  updated_at: string;
};

export type ModelHealthLogistics = {
  id: string;
  model_id: string;
  food_restrictions: string | null;
  allergies: string | null;
  medications_notes: string | null;
  travel_availability: string | null;
  passport_valid: boolean;
  can_travel_internationally: boolean;
  accepts_out_of_city_jobs: boolean;
  accepts_hair_change: boolean;
  accepts_lingerie: boolean;
  accepts_swimwear: boolean;
  accepts_artistic_nudity: boolean;
  commercial_restrictions: string | null;
  created_at: string;
  updated_at: string;
};

export type ModelRepresentation = {
  id: string;
  model_id: string;
  mother_agency: string | null;
  international_agencies: string[];
  available_markets: string[];
  previous_markets: string[];
  exclusive_contract: boolean;
  contract_start_date: string | null;
  contract_end_date: string | null;
  agency_commission: number | null;
  model_commission: number | null;
  responsible_booker: string | null;
  commercial_status: string | null;
  strategic_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ModelUpdateRequest = {
  id: string;
  model_id: string;
  requested_by: string | null;
  email_to: string | null;
  requested_sections: string[];
  message: string | null;
  status: string;
  sent_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ModelProfile = {
  model: Model;
  socialLinks: ModelSocialLinks | null;
  documents: ModelDocuments | null;
  skills: ModelSkills | null;
  workHistory: ModelWorkHistory[];
  healthLogistics: ModelHealthLogistics | null;
  representation: ModelRepresentation | null;
  media: ModelMedia[];
  updateRequests: ModelUpdateRequest[];
};

export type ModelClientProfile = {
  id: string;
  stage_name: string;
  display_name: string;
  categories: string[];
  model_type: string | null;
  current_city: string | null;
  current_country: string | null;
  base_city: string | null;
  base_country: string | null;
  height_cm: number | null;
  bust_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  shoe_size_br: string | null;
  shoe_size_eu: string | null;
  shoe_size_us: string | null;
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
  updated_at: string;
};

export type Client = {
  id: string;
  user_id: string | null;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  company_type: string | null;
  client_type: ClientType;
  status: ClientStatus;
  country: string | null;
  city: string | null;
  general_email: string | null;
  general_phone: string | null;
  general_whatsapp: string | null;
  general_wechat: string | null;
  website: string | null;
  tags: string[];
  market_notes: string | null;
  preferred_model_profile: string | null;
  internal_notes: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientContact = {
  id: string;
  client_id: string;
  contact_name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  wechat: string | null;
  is_primary: boolean;
  can_receive_emails: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientChannel = {
  id: string;
  client_id: string;
  contact_id: string | null;
  channel_type: ClientChannelType;
  value: string | null;
  url: string | null;
  label: string | null;
  notes: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type ModelMedia = {
  id: string;
  model_id: string;
  media_type: MediaType;
  storage_bucket: string;
  storage_path: string;
  title: string | null;
  thumbnail_path: string | null;
  status: MediaStatus;
  visibility: MediaVisibility;
  sort_order: number | null;
  uploaded_by: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientRequest = {
  id: string;
  client_id: string;
  shortlist_id: string | null;
  model_id: string | null;
  request_type: string;
  title: string;
  brief: string | null;
  requested_at: string | null;
  location: string | null;
  status: RequestStatus;
  assigned_admin_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ModelFormState = {
  error?: string;
  success?: string;
};

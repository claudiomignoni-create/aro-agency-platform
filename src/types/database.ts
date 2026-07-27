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

export type JobType =
  | "job"
  | "casting"
  | "shoot"
  | "option"
  | "fitting"
  | "travel"
  | "meeting"
  | "agency_event"
  | "manual_block"
  | "other";

export type JobStatus =
  | "draft"
  | "client_requested"
  | "booker_review"
  | "quote_requested"
  | "agency_approved"
  | "waiting_model"
  | "model_accepted"
  | "confirmed"
  | "declined"
  | "canceled"
  | "completed";

export type JobModelStatus =
  | "booker_review"
  | "option"
  | "agency_approved"
  | "waiting_model"
  | "accepted"
  | "declined"
  | "confirmed"
  | "canceled"
  | "completed";

export type ModelResponseStatus =
  | "not_released"
  | "waiting"
  | "accepted"
  | "declined";

export type CalendarBlockStatus =
  | "booker_review"
  | "option"
  | "agency_approved"
  | "waiting_model"
  | "accepted"
  | "confirmed"
  | "declined"
  | "canceled"
  | "completed";

export type CalendarBlockVisibility =
  | "admin_only"
  | "model_private"
  | "client_limited";

export type TripReason =
  | "international_season"
  | "job"
  | "casting"
  | "test_shoot"
  | "return"
  | "meeting"
  | "other";

export type TripStatus =
  | "planned"
  | "booked"
  | "in_transit"
  | "arrived"
  | "hosted"
  | "completed"
  | "canceled";

export type FlightSegmentStatus =
  | "planned"
  | "booked"
  | "check_in_open"
  | "boarding"
  | "departed"
  | "in_flight"
  | "landed"
  | "delayed"
  | "canceled";

export type TravelDocumentType =
  | "ticket"
  | "e_ticket"
  | "booking_confirmation"
  | "visa"
  | "insurance"
  | "hotel"
  | "related_document";

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
  skill_options: string[];
  sport_options: string[];
  hobby_options: string[];
  languages: string[];
  language_levels: Record<string, string>;
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
  has_drivers_license: boolean;
  drivers_license_category: string | null;
  drivers_license_number: string | null;
  drivers_license_country: string | null;
  drivers_license_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ModelOptionType =
  | "skill"
  | "sport"
  | "hobby"
  | "language"
  | "instrument";

export type ModelOption = {
  id: string;
  option_type: ModelOptionType;
  label: string;
  sort_order: number;
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

export type ModelInternationalAgency = {
  id: string;
  model_id: string;
  agency_name: string;
  country: string | null;
  city: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
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
  modelOptions: ModelOption[];
  workHistory: ModelWorkHistory[];
  healthLogistics: ModelHealthLogistics | null;
  representation: ModelRepresentation | null;
  internationalAgencies: ModelInternationalAgency[];
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
  billing_person_type: string | null;
  billing_trade_name: string | null;
  billing_legal_name: string | null;
  billing_cnpj: string | null;
  billing_cpf: string | null;
  billing_state_registration: string | null;
  billing_municipal_registration: string | null;
  billing_tax_regime: string | null;
  billing_postal_code: string | null;
  billing_address_line: string | null;
  billing_address_number: string | null;
  billing_address_complement: string | null;
  billing_neighborhood: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_country: string | null;
  billing_contact_name: string | null;
  billing_email: string | null;
  billing_phone: string | null;
  payment_terms: string | null;
  default_currency: string | null;
  invoice_notes: string | null;
  tax_notes: string | null;
  intl_trading_name: string | null;
  intl_legal_company_name: string | null;
  intl_country: string | null;
  intl_tax_id: string | null;
  intl_vat_number: string | null;
  intl_company_registration_number: string | null;
  intl_billing_address: string | null;
  intl_billing_city: string | null;
  intl_billing_state: string | null;
  intl_billing_postal_code: string | null;
  intl_billing_country: string | null;
  intl_billing_contact: string | null;
  intl_billing_email: string | null;
  intl_payment_terms: string | null;
  intl_invoice_notes: string | null;
  intl_tax_notes: string | null;
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

export type Job = {
  id: string;
  client_id: string | null;
  created_by: string | null;
  type: JobType;
  status: JobStatus;
  project_name: string | null;
  brand_name: string | null;
  brief: string | null;
  start_at: string;
  end_at: string | null;
  call_time: string | null;
  location_name: string | null;
  address_line: string | null;
  city: string | null;
  country: string | null;
  usage_term_months: number | null;
  usage_description: string | null;
  usage_scope: string | null;
  usage_countries: string[];
  client_budget: number | null;
  agency_fee_percent: number;
  final_amount: number | null;
  quote_requested: boolean;
  transport_notes: string | null;
  food_notes: string | null;
  model_recommendations: string | null;
  model_must_bring: string | null;
  styling_notes: string | null;
  beauty_notes: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type JobModel = {
  id: string;
  job_id: string;
  model_id: string;
  status: JobModelStatus;
  model_response_status: ModelResponseStatus;
  agency_approved_at: string | null;
  model_responded_at: string | null;
  fee_amount: number | null;
  final_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ModelCalendarBlock = {
  id: string;
  model_id: string;
  job_id: string | null;
  type: JobType;
  status: CalendarBlockStatus;
  start_at: string;
  end_at: string | null;
  title: string;
  visibility: CalendarBlockVisibility;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ModelTrip = {
  id: string;
  model_id: string;
  title: string;
  reason: TripReason;
  status: TripStatus;
  starts_on: string | null;
  ends_on: string | null;
  origin_city: string | null;
  origin_country: string | null;
  destination_city: string | null;
  destination_country: string | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  agency_name: string | null;
  internal_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TravelFlightSegment = {
  id: string;
  trip_id: string;
  airline_name: string | null;
  airline_code: string | null;
  flight_number: string | null;
  pnr: string | null;
  ticket_number: string | null;
  departure_airport: string | null;
  departure_iata: string | null;
  departure_city: string | null;
  departure_country: string | null;
  departure_at: string | null;
  departure_timezone: string | null;
  departure_terminal: string | null;
  departure_gate: string | null;
  arrival_airport: string | null;
  arrival_iata: string | null;
  arrival_city: string | null;
  arrival_country: string | null;
  arrival_at: string | null;
  arrival_timezone: string | null;
  arrival_terminal: string | null;
  seat: string | null;
  baggage: string | null;
  cabin_class: string | null;
  status: FlightSegmentStatus;
  check_in_url: string | null;
  cost_amount: number | null;
  currency: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TravelDocument = {
  id: string;
  trip_id: string;
  document_type: TravelDocumentType;
  title: string;
  storage_bucket: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PartnerAgencyType =
  | "mother_agency"
  | "placement_agency"
  | "receiving_agency"
  | "partner_agency"
  | "scouting_partner"
  | "direct_booking_partner"
  | "other";

export type PartnerAgencyStatus =
  | "active"
  | "inactive"
  | "prospect"
  | "suspended"
  | "archived";

export type PartnerAgency = {
  id: string;
  display_name: string;
  legal_name: string | null;
  agency_type: PartnerAgencyType;
  status: PartnerAgencyStatus;
  country: string | null;
  country_code: string | null;
  city: string | null;
  state_region: string | null;
  timezone: string | null;
  address: string | null;
  website_url: string | null;
  instagram_url: string | null;
  primary_email: string | null;
  secondary_email: string | null;
  phone: string | null;
  whatsapp: string | null;
  contact_name: string | null;
  contact_role: string | null;
  notes: string | null;
  logo_storage_path: string | null;
  default_currency: string | null;
  default_payment_terms_days: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PartnerAgencyContact = {
  id: string;
  agency_id: string;
  full_name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  wechat: string | null;
  line_id: string | null;
  instagram: string | null;
  contact_type: string;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InternationalSeasonStatus =
  | "planned"
  | "preparing"
  | "visa_pending"
  | "booked"
  | "traveling"
  | "active"
  | "ending_soon"
  | "completed"
  | "settlement_pending"
  | "settled"
  | "canceled";

export type ModelInternationalSeason = {
  id: string;
  model_id: string;
  receiving_agency_id: string;
  mother_agency_id: string | null;
  trip_id: string | null;
  title: string;
  country: string;
  country_code: string | null;
  city: string;
  timezone: string | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  contract_start_date: string;
  contract_end_date: string;
  duration_months: number | null;
  arrival_date: string | null;
  departure_date: string | null;
  status: InternationalSeasonStatus;
  contract_status: string;
  visa_status: string;
  accommodation_status: string;
  payment_status: string;
  settlement_status: string;
  contract_currency: string | null;
  pocket_money_amount: number | null;
  pocket_money_currency: string | null;
  pocket_money_frequency: string | null;
  gross_earnings: number | null;
  gross_earnings_currency: string | null;
  model_share_percentage: number | null;
  receiving_agency_share_percentage: number | null;
  mother_agency_share_percentage: number | null;
  model_amount_due: number | null;
  receiving_agency_amount_due: number | null;
  mother_agency_amount_due: number | null;
  model_amount_paid: number | null;
  mother_agency_amount_received: number | null;
  receiving_agency_amount_settled: number | null;
  final_payment_terms_days: number | null;
  final_payment_due_date: string | null;
  contract_reminder_date: string | null;
  outbound_ticket_status: string;
  return_ticket_status: string;
  contract_document_status: string;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InternationalSeasonRevenueShare = {
  id: string;
  season_id: string;
  participant_type: string;
  agency_id: string | null;
  model_id: string | null;
  percentage: number;
  calculated_amount: number | null;
  amount_paid: number | null;
  currency: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type InternationalSeasonAlert = {
  id: string;
  season_id: string;
  alert_type: string;
  due_on: string;
  priority: "low" | "medium" | "high";
  title: string;
  description: string | null;
  link_path: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type InternationalSeasonFinancialMovement = {
  id: string;
  season_id: string;
  movement_type: string;
  participant_type: string | null;
  agency_id: string | null;
  model_id: string | null;
  amount: number;
  currency: string;
  occurred_on: string;
  expected_on: string | null;
  status: string;
  reference: string | null;
  proof_document_id: string | null;
  notes: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InternationalSeasonDocument = {
  id: string;
  season_id: string;
  document_type: string;
  title: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  version_number: number;
  replaced_by_id: string | null;
  uploaded_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InternationalSeasonVisa = {
  id: string;
  season_id: string;
  country: string;
  visa_type: string | null;
  masked_number: string | null;
  issued_on: string | null;
  valid_from: string | null;
  valid_until: string | null;
  entries_count: number | null;
  status: string;
  document_id: string | null;
  photo_document_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InternationalSeasonPocketMoneyPayment = {
  id: string;
  season_id: string;
  amount: number;
  currency: string;
  expected_on: string | null;
  received_on: string | null;
  status: string;
  proof_document_id: string | null;
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
  valid_until: string | null;
  notes: string | null;
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

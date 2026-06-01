export type UserRole = "admin" | "model" | "client";

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
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  status: ModelStatus;
  is_published: boolean;
  categories: string[];
  gender: string | null;
  nationality: string | null;
  birth_date: string | null;
  location: string | null;
  bio: string | null;
  main_image_path: string | null;
  height_cm: number | null;
  bust_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  shoe_size: string | null;
  hair_color: string | null;
  eye_color: string | null;
  clothing_size: string | null;
  tags: string[];
  notes: string | null;
  consent_lgpd: boolean;
  created_at: string;
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
  status: string;
  notes: string | null;
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

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export type AdminUserProfile = Profile & {
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  preferred_language: string | null;
  title: string | null;
};

function isMissingProfilePreferencesError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message ?? "";

  return (
    maybeError.code === "42703" ||
    /profiles\.(avatar_url|phone|preferred_language|title)|column .* does not exist|schema cache/i.test(
      message
    )
  );
}

function profileWithDefaults(profile: Profile, email: string | null): AdminUserProfile {
  return {
    ...profile,
    avatar_url: null,
    email,
    phone: null,
    preferred_language: null,
    title: null
  };
}

export async function getAdminUserProfile() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, title, avatar_url, phone, preferred_language, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    if (isMissingProfilePreferencesError(error)) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("profiles")
        .select("id, role, full_name, created_at, updated_at")
        .eq("id", user.id)
        .maybeSingle();

      if (fallbackError) throw fallbackError;
      return fallbackData
        ? profileWithDefaults(fallbackData as Profile, user.email ?? null)
        : null;
    }

    throw error;
  }

  return {
    ...(data as Profile),
    avatar_url: (data as AdminUserProfile).avatar_url ?? null,
    email: user.email ?? null,
    phone: (data as AdminUserProfile).phone ?? null,
    preferred_language: (data as AdminUserProfile).preferred_language ?? null,
    title: (data as AdminUserProfile).title ?? null
  } satisfies AdminUserProfile;
}

export async function getProfilePreferencesStatus() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .select("id, title, avatar_url, phone, preferred_language")
    .limit(1);

  return { ready: !isMissingProfilePreferencesError(error) };
}

export { isMissingProfilePreferencesError };

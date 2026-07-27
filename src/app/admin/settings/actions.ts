"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getProfilePreferencesStatus,
  isMissingProfilePreferencesError
} from "@/lib/admin-profile";
import { isMissingSchemaError } from "@/lib/accounting-schema";
import { requireRole } from "@/lib/auth";
import { nullableString } from "@/lib/form-data";
import { createClient } from "@/lib/supabase/server";

function safeTheme(value: string | null) {
  return value === "system" || value === "light" || value === "dark"
    ? value
    : "system";
}

export async function updateAdminProfileAction(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const preferencesStatus = await getProfilePreferencesStatus();
  const basePayload = {
    full_name: nullableString(formData, "full_name")
  };
  const fullPayload = {
    ...basePayload,
    avatar_url: nullableString(formData, "avatar_url"),
    phone: nullableString(formData, "phone"),
    preferred_language: nullableString(formData, "preferred_language"),
    title: nullableString(formData, "title")
  };
  const { error } = await supabase
    .from("profiles")
    .update(preferencesStatus.ready ? fullPayload : basePayload)
    .eq("id", profile.id);

  if (error) {
    if (isMissingProfilePreferencesError(error)) {
      const { error: fallbackError } = await supabase
        .from("profiles")
        .update(basePayload)
        .eq("id", profile.id);
      if (fallbackError) throw fallbackError;
    } else {
      throw error;
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=profile");
}

export async function updateAdminEmailAction(formData: FormData) {
  await requireRole(["admin"]);
  const email = nullableString(formData, "email");

  if (!email) {
    redirect("/admin/settings?error=email");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email });

  if (error) throw error;
  redirect("/admin/settings?saved=email");
}

export async function updateAppearanceAction(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const theme = safeTheme(nullableString(formData, "theme"));

  const { error } = await supabase.from("user_preferences").upsert({
    theme,
    user_id: profile.id
  });

  if (error && !isMissingSchemaError(error)) {
    throw error;
  }

  revalidatePath("/admin/settings");
  redirect(`/admin/settings?tab=appearance&saved=appearance&theme=${theme}`);
}

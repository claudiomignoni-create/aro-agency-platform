"use server";

import { redirect } from "next/navigation";
import { getDefaultRouteForRole } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const next = String(formData.get("next") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    redirect("/login?error=invalid_credentials");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=no_session");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.role) {
    redirect("/login?error=missing_profile");
  }

  if (next.startsWith("/") && !next.startsWith("//")) {
    redirect(next);
  }

  redirect(getDefaultRouteForRole(profile.role as UserRole));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

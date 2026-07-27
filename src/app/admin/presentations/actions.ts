"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/accounting-schema";
import { createPublicToken } from "@/lib/communications/data";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createPresentationAction(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { hash, token } = createPublicToken();
  const title = textValue(formData, "title");

  if (!title) redirect("/admin/presentations/new?error=missing-title");

  const { data, error } = await supabase
    .from("presentations")
    .insert({
      allow_downloads: formData.get("allow_downloads") === "on",
      created_by: profile.id,
      description: textValue(formData, "description") || null,
      language: textValue(formData, "language") || "pt-BR",
      public_token_hash: hash,
      purpose: textValue(formData, "purpose") || null,
      snapshot: {
        createdFrom: "admin",
        note: "Draft snapshot. Published versions are immutable."
      },
      status: "draft",
      title
    })
    .select("id")
    .single();

  if (error && isMissingSchemaError(error)) redirect("/admin/presentations?schema=pending");
  if (error) throw error;

  revalidatePath("/admin/presentations");
  redirect(`/admin/presentations/${data.id}?token=${encodeURIComponent(token)}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/accounting-schema";
import { createPublicToken } from "@/lib/communications/data";

const sensitiveFields = new Set([
  "address",
  "banking",
  "cpf",
  "documents",
  "health",
  "passport",
  "pix",
  "rg",
  "visa"
]);

const defaultFields = [
  { field_group: "profile", field_key: "measurements", is_required: true },
  { field_group: "profile", field_key: "location", is_required: false },
  { field_group: "media", field_key: "portfolio", is_required: false },
  { field_group: "media", field_key: "polaroids", is_required: false },
  { field_group: "social", field_key: "instagram", is_required: false }
];

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createModelUpdateRequestAction(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const modelId = textValue(formData, "model_id");
  const selectedFields = formData.getAll("fields").map(String);
  const fields = selectedFields.length
    ? selectedFields.map((field_key) => ({
        field_group: sensitiveFields.has(field_key) ? "sensitive" : "profile",
        field_key,
        is_required: true
      }))
    : defaultFields;
  const { hash, token } = createPublicToken();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const verificationRequired = fields.some((field) => sensitiveFields.has(field.field_key));

  if (!modelId) redirect("/admin/model-updates/new?error=missing-model");

  const { data, error } = await supabase
    .from("model_update_requests")
    .insert({
      auto_apply_safe_fields: formData.get("auto_apply_safe_fields") !== "off",
      created_by: profile.id,
      due_at: textValue(formData, "due_at") || null,
      expires_at: expiresAt,
      language: textValue(formData, "language") || "pt-BR",
      message: textValue(formData, "message") || null,
      model_id: modelId,
      public_token_hash: hash,
      status: "ready",
      title: textValue(formData, "title") || "Atualização do perfil ARO",
      verification_required: verificationRequired
    })
    .select("id")
    .single();

  if (error && isMissingSchemaError(error)) redirect("/admin/model-updates/new?schema=pending");
  if (error) throw error;

  const fieldRows = fields.map((field, index) => ({
    ...field,
    allow_auto_apply: !sensitiveFields.has(field.field_key),
    is_sensitive: sensitiveFields.has(field.field_key),
    position: index,
    request_id: data.id
  }));
  const { error: fieldsError } = await supabase.from("model_update_request_fields").insert(fieldRows);
  if (fieldsError) throw fieldsError;

  await supabase.from("model_update_audit_events").insert({
    created_by: profile.id,
    event_type: "request_created",
    metadata: { fields: fieldRows.map((field) => field.field_key) },
    model_id: modelId,
    request_id: data.id
  });

  revalidatePath("/admin/model-updates/new");
  redirect(`/admin/model-updates/${data.id}?token=${encodeURIComponent(token)}`);
}

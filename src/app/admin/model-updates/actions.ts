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
  { field_group: "measurements", field_key: "height_cm", is_required: true },
  { field_group: "measurements", field_key: "bust_cm", is_required: true },
  { field_group: "measurements", field_key: "waist_cm", is_required: true },
  { field_group: "measurements", field_key: "hips_cm", is_required: true },
  { field_group: "measurements", field_key: "shoe_size_br", is_required: false },
  { field_group: "profile", field_key: "location", is_required: false },
  { field_group: "media", field_key: "portfolio", is_required: false },
  { field_group: "media", field_key: "polaroids", is_required: false },
  { field_group: "social", field_key: "instagram", is_required: false }
];

const groupedFieldKeys: Record<string, string[]> = {
  measurements: ["height_cm", "bust_cm", "waist_cm", "hips_cm", "shoe_size_br", "dress_size_br"]
};

const fieldGroups: Record<string, string> = {
  bust_cm: "measurements",
  contact: "profile",
  dress_size_br: "measurements",
  height_cm: "measurements",
  hips_cm: "measurements",
  instagram: "social",
  location: "profile",
  shoe_size_br: "measurements",
  waist_cm: "measurements"
};

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function formValues(formData: FormData, key: string) {
  return formData.getAll(key).map(String).filter(Boolean);
}

export async function createModelUpdateRequestAction(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const modelId = textValue(formData, "model_id");
  const selectedFields = Array.from(
    new Set(
      formData
        .getAll("fields")
        .map(String)
        .flatMap((field) => groupedFieldKeys[field] ?? [field])
    )
  );
  const fields = selectedFields.length
    ? selectedFields.map((field_key) => ({
        field_group: sensitiveFields.has(field_key) ? "sensitive" : fieldGroups[field_key] ?? "profile",
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
      auto_apply_safe_fields: formData.get("auto_apply_safe_fields") === "on",
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

export async function approveModelUpdateFileAction(requestId: string, fileId: string) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: file, error } = await supabase
    .from("model_update_files")
    .select("id, submission_id, media_type, bucket, object_path, original_name, mime_type, size_bytes, sha256, status, submission:model_update_submissions(model_id, request_id)")
    .eq("id", fileId)
    .maybeSingle();

  if (error) throw error;
  if (!file) redirect(`/admin/model-updates/${requestId}?error=file-not-found`);

  const submission = Array.isArray(file.submission) ? file.submission[0] : file.submission;
  if (!submission || submission.request_id !== requestId) redirect(`/admin/model-updates/${requestId}?error=file-not-found`);

  const visibility = file.media_type === "document" ? "private" : "client_only";
  const { error: mediaError } = await supabase.from("model_media").insert({
    media_type: file.media_type,
    model_id: submission.model_id,
    review_notes: file.sha256 ? `Recebido via Model Portal. SHA-256: ${file.sha256}` : "Recebido via Model Portal.",
    status: "approved",
    storage_bucket: file.bucket,
    storage_path: file.object_path,
    title: file.original_name,
    uploaded_by: profile.id,
    visibility
  });
  if (mediaError) throw mediaError;

  const { error: fileError } = await supabase.from("model_update_files").update({ status: "approved" }).eq("id", fileId);
  if (fileError) throw fileError;

  await supabase.from("model_update_audit_events").insert({
    created_by: profile.id,
    event_type: "file_approved",
    metadata: { file_id: fileId, media_type: file.media_type },
    model_id: submission.model_id,
    request_id: requestId
  });

  revalidatePath(`/admin/model-updates/${requestId}`);
}

export async function rejectModelUpdateFileAction(requestId: string, fileId: string) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: file, error } = await supabase
    .from("model_update_files")
    .select("id, media_type, submission:model_update_submissions(model_id, request_id)")
    .eq("id", fileId)
    .maybeSingle();

  if (error) throw error;
  const submission = Array.isArray(file?.submission) ? file?.submission[0] : file?.submission;
  if (!file || !submission || submission.request_id !== requestId) redirect(`/admin/model-updates/${requestId}?error=file-not-found`);

  const { error: fileError } = await supabase.from("model_update_files").update({ status: "rejected" }).eq("id", fileId);
  if (fileError) throw fileError;

  await supabase.from("model_update_audit_events").insert({
    created_by: profile.id,
    event_type: "file_rejected",
    metadata: { file_id: fileId, media_type: file.media_type },
    model_id: submission.model_id,
    request_id: requestId
  });

  revalidatePath(`/admin/model-updates/${requestId}`);
}

export async function applyModelUpdateSubmissionAction(requestId: string, formData: FormData) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const selectedFields = formValues(formData, "selected_fields");
  const approvedFileIds = formValues(formData, "approved_file_ids");

  const { error } = await supabase.rpc("apply_model_update_submission", {
    p_approved_file_ids: approvedFileIds,
    p_request_id: requestId,
    p_selected_fields: selectedFields
  });

  if (error && isMissingSchemaError(error)) redirect("/admin/model-updates?schema=pending");
  if (error) throw error;

  revalidatePath(`/admin/model-updates/${requestId}`);
  redirect(`/admin/model-updates/${requestId}`);
}

export async function rejectModelUpdateSubmissionAction(requestId: string) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("model_update_requests")
    .select("id, model_id, submission:model_update_submissions(id)")
    .eq("id", requestId)
    .maybeSingle();

  if (error) throw error;
  const submission = Array.isArray(request?.submission) ? request?.submission[0] : request?.submission;
  if (!request || !submission) redirect(`/admin/model-updates/${requestId}?error=no-submission`);

  const { error: submissionError } = await supabase
    .from("model_update_submissions")
    .update({ reviewed_by: profile.id, status: "rejected" })
    .eq("id", submission.id);
  if (submissionError) throw submissionError;

  const { error: requestError } = await supabase
    .from("model_update_requests")
    .update({ status: "review_required", updated_by: profile.id })
    .eq("id", requestId);
  if (requestError) throw requestError;

  await supabase.from("model_update_audit_events").insert({
    created_by: profile.id,
    event_type: "rejected",
    model_id: request.model_id,
    request_id: requestId
  });

  revalidatePath(`/admin/model-updates/${requestId}`);
}

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

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstEmail(value: string) {
  return value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() ?? null;
}

function firstPhone(value: string) {
  return value.match(/\+?[\d\s().-]{8,}/)?.[0]?.replace(/\s+/g, " ").trim() ?? null;
}

function cityCountry(value: string) {
  const [city, ...countryParts] = value.split(",").map((part) => part.trim()).filter(Boolean);
  const country = countryParts.join(", ") || null;
  return { city: city || null, country };
}

function labeledNumber(value: string, labels: string[]) {
  for (const label of labels) {
    const match = value.match(new RegExp(`${label}\\D{0,12}(\\d{2,3})`, "i"));
    if (match?.[1]) return Number(match[1]);
  }
  return null;
}

function measurementsUpdate(value: string) {
  return {
    bust_cm: labeledNumber(value, ["busto", "torax", "tórax", "chest", "bust"]),
    height_cm: labeledNumber(value, ["altura", "height"]),
    hips_cm: labeledNumber(value, ["quadril", "hips"]),
    waist_cm: labeledNumber(value, ["cintura", "waist"])
  };
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

export async function applyModelUpdateSubmissionAction(requestId: string) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("model_update_requests")
    .select("id, model_id, auto_apply_safe_fields, submission:model_update_submissions(id, submitted_payload, status)")
    .eq("id", requestId)
    .maybeSingle();

  if (error && isMissingSchemaError(error)) redirect("/admin/model-updates?schema=pending");
  if (error) throw error;
  const submission = Array.isArray(request?.submission) ? request?.submission[0] : request?.submission;
  if (!request || !submission?.submitted_payload) redirect(`/admin/model-updates/${requestId}?error=no-submission`);

  const payload = submission.submitted_payload as Record<string, unknown>;
  const modelUpdate: Record<string, unknown> = {
    last_profile_update_at: new Date().toISOString(),
    profile_reviewed_at: new Date().toISOString()
  };

  const contact = optionalText(payload.contact);
  if (contact) {
    modelUpdate.email = firstEmail(contact);
    modelUpdate.whatsapp = firstPhone(contact);
    modelUpdate.phone = firstPhone(contact);
  }

  const location = optionalText(payload.location);
  if (location) {
    const parsed = cityCountry(location);
    modelUpdate.location = location;
    modelUpdate.current_city = parsed.city;
    modelUpdate.current_country = parsed.country;
    modelUpdate.base_city = parsed.city;
    modelUpdate.base_country = parsed.country;
  }

  const measurements = optionalText(payload.measurements);
  if (measurements) {
    Object.assign(modelUpdate, measurementsUpdate(measurements), {
      last_measurements_update_at: new Date().toISOString()
    });
  }

  Object.keys(modelUpdate).forEach((key) => {
    if (modelUpdate[key] === null || modelUpdate[key] === undefined || modelUpdate[key] === "") delete modelUpdate[key];
  });

  if (request.auto_apply_safe_fields && Object.keys(modelUpdate).length) {
    const { error: modelError } = await supabase.from("models").update(modelUpdate).eq("id", request.model_id);
    if (modelError) throw modelError;
  }

  const instagram = optionalText(payload.instagram);
  if (request.auto_apply_safe_fields && instagram) {
    const { error: socialError } = await supabase
      .from("model_social_links")
      .upsert({ instagram, model_id: request.model_id }, { onConflict: "model_id" });
    if (socialError) throw socialError;
  }

  const appliedAt = new Date().toISOString();
  const { error: submissionError } = await supabase
    .from("model_update_submissions")
    .update({
      applied_at: appliedAt,
      applied_snapshot: {
        applied_fields: Object.keys(modelUpdate),
        sensitive_fields: Object.keys(payload).filter((key) => sensitiveFields.has(key))
      },
      reviewed_by: profile.id,
      status: "applied"
    })
    .eq("id", submission.id);
  if (submissionError) throw submissionError;

  const { error: requestError } = await supabase
    .from("model_update_requests")
    .update({ applied_at: appliedAt, status: "applied", updated_by: profile.id })
    .eq("id", requestId);
  if (requestError) throw requestError;

  await supabase.from("model_update_audit_events").insert({
    created_by: profile.id,
    event_type: "applied",
    metadata: {
      applied_fields: Object.keys(modelUpdate),
      sensitive_fields_reviewed_only: Object.keys(payload).filter((key) => sensitiveFields.has(key))
    },
    model_id: request.model_id,
    new_snapshot: payload,
    request_id: requestId
  });

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

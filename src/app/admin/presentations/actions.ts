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

function nullableUuid(value: string) {
  return value && value !== "none" ? value : null;
}

function values(formData: FormData, key: string) {
  return formData.getAll(key).map(String).filter(Boolean);
}

function numberValue(formData: FormData, key: string, fallback = 0) {
  const value = Number.parseInt(textValue(formData, key), 10);
  return Number.isFinite(value) ? value : fallback;
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
      client_id: nullableUuid(textValue(formData, "client_id")),
      description: textValue(formData, "description") || null,
      expires_at: textValue(formData, "expires_at") || null,
      agency_id: nullableUuid(textValue(formData, "agency_id")),
      job_id: nullableUuid(textValue(formData, "job_id")),
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

export async function updatePresentationAction(id: string, formData: FormData) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const title = textValue(formData, "title");

  if (!title) redirect(`/admin/presentations/${id}/edit?error=missing-title`);

  const { error } = await supabase
    .from("presentations")
    .update({
      allow_downloads: formData.get("allow_downloads") === "on",
      client_id: nullableUuid(textValue(formData, "client_id")),
      description: textValue(formData, "description") || null,
      expires_at: textValue(formData, "expires_at") || null,
      agency_id: nullableUuid(textValue(formData, "agency_id")),
      job_id: nullableUuid(textValue(formData, "job_id")),
      language: textValue(formData, "language") || "pt-BR",
      purpose: textValue(formData, "purpose") || null,
      title,
      updated_by: profile.id
    })
    .eq("id", id)
    .in("status", ["draft", "published"]);

  if (error && isMissingSchemaError(error)) redirect("/admin/presentations?schema=pending");
  if (error) throw error;

  const selectedModelIds = values(formData, "model_id");
  const highlightedModelId = textValue(formData, "highlighted_model_id");

  await supabase.from("presentation_models").delete().eq("presentation_id", id);

  for (const [index, modelId] of selectedModelIds.entries()) {
    const { data: inserted, error: modelError } = await supabase
      .from("presentation_models")
      .insert({
        include_location: formData.get(`include_location_${modelId}`) === "on",
        include_measurements: formData.get(`include_measurements_${modelId}`) === "on",
        include_social_links: formData.get(`include_social_links_${modelId}`) === "on",
        model_id: modelId,
        model_snapshot: {
          highlighted: highlightedModelId === modelId,
          note: "Draft selection. Publication creates immutable sanitized snapshot."
        },
        position: numberValue(formData, `position_${modelId}`, index),
        presentation_id: id
      })
      .select("id")
      .single();

    if (modelError) throw modelError;

    const mediaIds = values(formData, `media_${modelId}`);
    for (const [mediaIndex, mediaId] of mediaIds.entries()) {
      const { error: mediaError } = await supabase.from("presentation_model_media").insert({
        media_snapshot: { note: "Draft media selection. Publication snapshots safe media fields." },
        media_type: textValue(formData, `media_type_${mediaId}`) || "portfolio",
        model_media_id: mediaId,
        position: mediaIndex,
        presentation_model_id: inserted.id
      });
      if (mediaError) throw mediaError;
    }
  }

  revalidatePath(`/admin/presentations/${id}`);
  revalidatePath(`/admin/presentations/${id}/edit`);
  redirect(`/admin/presentations/${id}`);
}

async function buildPresentationSnapshot(id: string) {
  const supabase = await createClient();
  const { data: presentation, error: presentationError } = await supabase
    .from("presentations")
    .select("id, title, description, language, allow_downloads, purpose")
    .eq("id", id)
    .maybeSingle();

  if (presentationError) throw presentationError;
  if (!presentation) throw new Error("Apresentação não encontrada.");

  const { data: selectedModels, error: selectedError } = await supabase
    .from("presentation_models")
    .select(`
      id,
      position,
      include_measurements,
      include_location,
      include_social_links,
      model_snapshot,
      model:models(
        id,
        display_name,
        stage_name,
        current_city,
        current_country,
        base_city,
        base_country,
        categories,
        main_image_path,
        height_cm,
        bust_cm,
        waist_cm,
        hips_cm,
        shoe_size,
        hair_color,
        eye_color
      )
    `)
    .eq("presentation_id", id)
    .order("position", { ascending: true });

  if (selectedError) throw selectedError;

  const presentationModelIds = (selectedModels ?? []).map((item) => item.id);
  const { data: mediaRows, error: mediaError } = presentationModelIds.length
    ? await supabase
        .from("presentation_model_media")
        .select(`
          presentation_model_id,
          position,
          media_type,
          media:model_media(
            id,
            media_type,
            storage_bucket,
            storage_path,
            thumbnail_path,
            title,
            visibility,
            status
          )
        `)
        .in("presentation_model_id", presentationModelIds)
        .order("position", { ascending: true })
    : { data: [], error: null };

  if (mediaError) throw mediaError;

  const mediaByPresentationModel = new Map<string, typeof mediaRows>();
  for (const row of mediaRows ?? []) {
    const group = mediaByPresentationModel.get(row.presentation_model_id) ?? [];
    group.push(row);
    mediaByPresentationModel.set(row.presentation_model_id, group);
  }

  const models = (selectedModels ?? []).map((row) => {
    const model = Array.isArray(row.model) ? row.model[0] : row.model;
    const snapshot = (row.model_snapshot ?? {}) as { highlighted?: boolean };
    const media = (mediaByPresentationModel.get(row.id) ?? [])
      .map((mediaRow) => {
        const item = Array.isArray(mediaRow.media) ? mediaRow.media[0] : mediaRow.media;
        if (!item || item.status !== "approved" || item.visibility === "private") return null;

        return {
          media_type: mediaRow.media_type || item.media_type,
          storage_bucket: item.storage_bucket,
          storage_path: item.storage_path,
          thumbnail_path: item.thumbnail_path,
          title: item.title
        };
      })
      .filter(Boolean);

    return {
      board: model?.categories?.[0] ?? null,
      city: row.include_location ? model?.current_city ?? model?.base_city ?? null : null,
      country: row.include_location ? model?.current_country ?? model?.base_country ?? null : null,
      display_name: model?.stage_name || model?.display_name || "Modelo ARO",
      highlighted: Boolean(snapshot.highlighted),
      id: model?.id,
      main_image_path: model?.main_image_path ?? null,
      measurements: row.include_measurements
        ? {
            bust_cm: model?.bust_cm ?? null,
            height_cm: model?.height_cm ?? null,
            hips_cm: model?.hips_cm ?? null,
            shoe_size: model?.shoe_size ?? null,
            waist_cm: model?.waist_cm ?? null
          }
        : {},
      media
    };
  });

  return {
    contact: {
      email: "claudio@arolab.co",
      name: "Claudio Mignoni",
      website: "www.arolab.co"
    },
    description: presentation.description,
    language: presentation.language,
    models,
    purpose: presentation.purpose,
    title: presentation.title
  };
}

export async function publishPresentationAction(id: string) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const snapshot = await buildPresentationSnapshot(id);

  if (!snapshot.models.length) redirect(`/admin/presentations/${id}/edit?error=no-models`);

  const { data: presentation, error: currentError } = await supabase
    .from("presentations")
    .select("version_number")
    .eq("id", id)
    .maybeSingle();

  if (currentError) throw currentError;
  const nextVersion = (presentation?.version_number ?? 0) + 1;

  const { error: updateError } = await supabase
    .from("presentations")
    .update({
      published_at: new Date().toISOString(),
      revoked_at: null,
      snapshot,
      status: "published",
      updated_by: profile.id,
      version_number: nextVersion
    })
    .eq("id", id);

  if (updateError) throw updateError;

  const { error: versionError } = await supabase.from("presentation_versions").insert({
    created_by: profile.id,
    presentation_id: id,
    snapshot,
    version_number: nextVersion
  });

  if (versionError) throw versionError;

  revalidatePath(`/admin/presentations/${id}`);
  revalidatePath(`/admin/presentations/${id}/preview`);
  redirect(`/admin/presentations/${id}`);
}

export async function revokePresentationAction(id: string) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("presentations")
    .update({
      revoked_at: new Date().toISOString(),
      status: "revoked",
      updated_by: profile.id
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`/admin/presentations/${id}`);
  redirect(`/admin/presentations/${id}`);
}

export async function archivePresentationAction(id: string) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("presentations")
    .update({
      archived_at: new Date().toISOString(),
      status: "archived",
      updated_by: profile.id
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/presentations");
  redirect("/admin/presentations");
}

export async function regeneratePresentationTokenAction(id: string) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { hash, token } = createPublicToken();
  const { error } = await supabase
    .from("presentations")
    .update({
      public_token_hash: hash,
      revoked_at: null,
      status: "draft",
      updated_by: profile.id
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`/admin/presentations/${id}`);
  redirect(`/admin/presentations/${id}?token=${encodeURIComponent(token)}`);
}

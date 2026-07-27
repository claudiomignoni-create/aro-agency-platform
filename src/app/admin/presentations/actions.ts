"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/accounting-schema";
import { createPublicToken } from "@/lib/communications/data";
import { assertSafeRecipientForRealSend, getUsableGoogleAccessToken } from "@/lib/communications/google-server";
import { randomToken } from "@/lib/communications/security";

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

function emailValues(formData: FormData) {
  const manual = textValue(formData, "manual_email");
  return Array.from(
    new Set(
      [...values(formData, "recipient"), manual]
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.includes("@"))
    )
  );
}

function bodyFromPresentation({
  link,
  modelCount,
  recipientName,
  title
}: {
  link: string;
  modelCount: number;
  recipientName: string;
  title: string;
}) {
  return [
    `Olá, ${recipientName || "tudo bem?"}.`,
    `Compartilho a apresentação "${title}" com ${modelCount} modelo(s) selecionado(s) pela ARO.`,
    `Ver apresentação: ${link}`,
    "Claudio Mignoni\nDirector / Model Manager\nARO\nclaudio@arolab.co\nwww.arolab.co"
  ].join("\n\n");
}

function htmlFromText(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function zonedDateTimeToUtc(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(utcGuess);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const zonedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return new Date(utcGuess.getTime() - (zonedAsUtc - utcGuess.getTime()));
}

function scheduledDateTime(id: string, formData: FormData) {
  const date = textValue(formData, "scheduled_date");
  const time = textValue(formData, "scheduled_time");
  const timezone = textValue(formData, "scheduled_timezone") || "America/Sao_Paulo";

  if (!date || !time) redirect(`/admin/presentations/${id}/email?error=missing-schedule`);

  const scheduledAt = zonedDateTimeToUtc(date, time, timezone);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    redirect(`/admin/presentations/${id}/email?error=invalid-schedule`);
  }

  return {
    scheduled_at: scheduledAt.toISOString(),
    scheduled_timezone: timezone
  };
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

  const selectedModelIds = values(formData, "model_id");
  const highlightedModelId = textValue(formData, "highlighted_model_id");
  const models = selectedModelIds.map((modelId, index) => ({
    highlighted: highlightedModelId === modelId,
    include_location: formData.get(`include_location_${modelId}`) === "on",
    include_measurements: formData.get(`include_measurements_${modelId}`) === "on",
    include_social_links: formData.get(`include_social_links_${modelId}`) === "on",
    media: values(formData, `media_${modelId}`).map((mediaId, mediaIndex) => ({
      media_id: mediaId,
      media_type: textValue(formData, `media_type_${mediaId}`) || "portfolio",
      position: mediaIndex
    })),
    model_id: modelId,
    position: numberValue(formData, `position_${modelId}`, index)
  }));

  const { error } = await supabase.rpc("update_presentation_draft", {
    p_admin_id: profile.id,
    p_payload: {
      agency_id: nullableUuid(textValue(formData, "agency_id")),
      allow_downloads: formData.get("allow_downloads") === "on",
      client_id: nullableUuid(textValue(formData, "client_id")),
      description: textValue(formData, "description") || null,
      expires_at: textValue(formData, "expires_at") || null,
      job_id: nullableUuid(textValue(formData, "job_id")),
      language: textValue(formData, "language") || "pt-BR",
      models,
      purpose: textValue(formData, "purpose") || null,
      title
    },
    p_presentation_id: id
  });

  if (error && isMissingSchemaError(error)) redirect("/admin/presentations?schema=pending");
  if (error) throw error;

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

  const { error } = await supabase.rpc("publish_presentation_snapshot", {
    p_admin_id: profile.id,
    p_presentation_id: id,
    p_snapshot: snapshot
  });

  if (error) throw error;

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

export async function createPresentationEmailsAction(id: string, formData: FormData) {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const recipients = emailValues(formData);
  if (!recipients.length) redirect(`/admin/presentations/${id}/email?error=missing-recipient`);

  const { data: presentation, error } = await supabase
    .from("presentations")
    .select("id, title, language, status, snapshot")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!presentation) redirect("/admin/presentations");
  if (!["published", "sent"].includes(presentation.status)) {
    redirect(`/admin/presentations/${id}/email?error=not-published`);
  }

  const mode = textValue(formData, "mode") || "system_draft";
  if (mode === "send_now" || mode === "scheduled") {
    for (const recipient of recipients) assertSafeRecipientForRealSend(recipient);
  }

  const connection =
    mode === "gmail_draft" || mode === "send_now" || mode === "scheduled"
      ? await getUsableGoogleAccessToken(profile.id)
      : null;
  const { hash, token } = createPublicToken();
  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://aro-agency-platform.vercel.app"}/p/${token}`;
  const snapshot = (presentation.snapshot ?? {}) as { models?: unknown[] };
  const subject = textValue(formData, "subject") || `ARO — ${presentation.title}`;

  await supabase
    .from("presentations")
    .update({ public_token_hash: hash, updated_by: profile.id })
    .eq("id", id);

  for (const recipientEmail of recipients) {
    const recipientName = recipientEmail.split("@")[0] ?? "contato";
    const bodyText = bodyFromPresentation({
      link: publicUrl,
      modelCount: snapshot.models?.length ?? 0,
      recipientName,
      title: presentation.title
    });
    const schedule = mode === "scheduled" ? scheduledDateTime(id, formData) : {};
    const status =
      mode === "scheduled" ? "scheduled" : mode === "send_now" || mode === "gmail_draft" ? "queued" : "draft";
    const { data: email, error: emailError } = await supabase
      .from("outbound_emails")
      .insert({
        body_html: htmlFromText(bodyText),
        body_text: bodyText,
        created_by: profile.id,
        idempotency_key: randomToken(24),
        mode,
        presentation_id: id,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        ...schedule,
        sender_connection_id: connection?.connectionId ?? null,
        status,
        subject
      })
      .select("id")
      .single();
    if (emailError) throw emailError;

    const { error: recipientError } = await supabase.from("presentation_recipients").insert({
      outbound_email_id: email.id,
      presentation_id: id,
      recipient_email: recipientEmail,
      recipient_name: recipientName
    });
    if (recipientError) throw recipientError;
  }

  revalidatePath(`/admin/presentations/${id}`);
  revalidatePath(`/admin/presentations/${id}/email`);
  redirect(`/admin/presentations/${id}?token=${encodeURIComponent(token)}`);
}

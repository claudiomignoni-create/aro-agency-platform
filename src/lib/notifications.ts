import { getCurrentProfile, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  Notification,
  NotificationType,
  UserRole
} from "@/types/database";

type SupabaseMaybeError = {
  code?: string;
  message?: string;
};

export type CreateNotificationInput = {
  actionUrl?: string | null;
  entityId?: string | null;
  entityType?: string | null;
  message: string;
  recipientProfileId: string;
  recipientRole: UserRole;
  title: string;
  type: NotificationType;
};

type ModelUpdateNotificationInput = {
  actionUrl?: string;
  modelId: string;
  modelName: string;
  recipientProfileId: string;
};

type JobNotificationInput = {
  actionUrl?: string;
  jobId: string;
  jobTitle: string;
  modelName: string;
  recipientProfileId: string;
};

export function isMissingNotificationsSchemaError(
  error: SupabaseMaybeError | null
) {
  return (
    error?.code === "42703" ||
    error?.code === "42P01" ||
    error?.code === "42704" ||
    Boolean(error?.message && /does not exist|schema cache/i.test(error.message))
  );
}

function notificationSelect() {
  return `
    id,
    recipient_profile_id,
    recipient_role,
    type,
    title,
    message,
    action_url,
    entity_type,
    entity_id,
    read_at,
    created_at
  `;
}

export async function createNotification(input: CreateNotificationInput) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      action_url: input.actionUrl ?? null,
      entity_id: input.entityId ?? null,
      entity_type: input.entityType ?? null,
      message: input.message,
      recipient_profile_id: input.recipientProfileId,
      recipient_role: input.recipientRole,
      title: input.title,
      type: input.type
    })
    .select(notificationSelect())
    .single();

  if (error) {
    throw error;
  }

  return data as Notification;
}

export async function listCurrentUserNotifications(limit = 20) {
  const profile = await getCurrentProfile();

  if (!profile) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(notificationSelect())
    .eq("recipient_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (isMissingNotificationsSchemaError(error)) {
    return [];
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as Notification[];
}

export async function listAdminNotifications(limit = 40) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(notificationSelect())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (isMissingNotificationsSchemaError(error)) {
    return [];
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as Notification[];
}

export async function markNotificationAsRead(id: string) {
  const profile = await getCurrentProfile();

  if (!profile) {
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_profile_id", profile.id);

  if (isMissingNotificationsSchemaError(error)) {
    return;
  }

  if (error) {
    throw error;
  }
}

export async function createJobNotificationForModel(
  input: JobNotificationInput
) {
  return createNotification({
    actionUrl: input.actionUrl ?? `/model/availability`,
    entityId: input.jobId,
    entityType: "job",
    message: `${input.modelName}, você tem um trabalho aguardando resposta: ${input.jobTitle}.`,
    recipientProfileId: input.recipientProfileId,
    recipientRole: "model",
    title: "Trabalho aguardando resposta",
    type: "job_waiting_model"
  });
}

export async function createProfileUpdateRequestNotification(
  input: ModelUpdateNotificationInput
) {
  return createNotification({
    actionUrl: input.actionUrl ?? "/model/profile",
    entityId: input.modelId,
    entityType: "model",
    message: `${input.modelName}, revise e atualize suas informações de perfil.`,
    recipientProfileId: input.recipientProfileId,
    recipientRole: "model",
    title: "Atualização de perfil solicitada",
    type: "model_profile_update_request"
  });
}

export async function createMeasurementsUpdateRequestNotification(
  input: ModelUpdateNotificationInput
) {
  return createNotification({
    actionUrl: input.actionUrl ?? "/model/profile",
    entityId: input.modelId,
    entityType: "model",
    message: `${input.modelName}, revise suas medidas para manter o cadastro atualizado.`,
    recipientProfileId: input.recipientProfileId,
    recipientRole: "model",
    title: "Atualização de medidas solicitada",
    type: "model_measurements_update_request"
  });
}

export async function createMediaUpdateRequestNotification(
  input: ModelUpdateNotificationInput
) {
  return createNotification({
    actionUrl: input.actionUrl ?? "/model/media",
    entityId: input.modelId,
    entityType: "model",
    message: `${input.modelName}, envie novas polaroids ou materiais recentes.`,
    recipientProfileId: input.recipientProfileId,
    recipientRole: "model",
    title: "Novas polaroids solicitadas",
    type: "model_media_update_request"
  });
}

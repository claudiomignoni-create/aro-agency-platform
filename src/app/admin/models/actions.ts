"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  nullableNumber,
  nullableString,
  requiredString,
  stringList
} from "@/lib/form-data";
import { requireRole } from "@/lib/auth";
import {
  createModel,
  deleteModel,
  updateModel,
  type ModelInput
} from "@/lib/models";
import type { ModelStatus } from "@/types/database";

const allowedStatuses: ModelStatus[] = [
  "draft",
  "pending_review",
  "approved",
  "archived"
];

function modelInputFromFormData(formData: FormData): ModelInput {
  const status = requiredString(formData, "status") as ModelStatus;

  if (!allowedStatuses.includes(status)) {
    throw new Error("Status inválido.");
  }

  const isPublished = formData.get("is_published") === "on";

  return {
    bio: nullableString(formData, "bio"),
    birth_date: nullableString(formData, "birth_date"),
    bust_cm: nullableNumber(formData, "bust_cm"),
    categories: stringList(formData, "categories"),
    clothing_size: nullableString(formData, "clothing_size"),
    consent_lgpd: formData.get("consent_lgpd") === "on",
    display_name: requiredString(formData, "display_name"),
    email: nullableString(formData, "email"),
    eye_color: nullableString(formData, "eye_color"),
    gender: nullableString(formData, "gender"),
    hair_color: nullableString(formData, "hair_color"),
    height_cm: nullableNumber(formData, "height_cm"),
    hips_cm: nullableNumber(formData, "hips_cm"),
    is_published: status === "approved" ? isPublished : false,
    legal_name: nullableString(formData, "legal_name"),
    location: nullableString(formData, "location"),
    nationality: nullableString(formData, "nationality"),
    notes: nullableString(formData, "notes"),
    phone: nullableString(formData, "phone"),
    shoe_size: nullableString(formData, "shoe_size"),
    status,
    tags: stringList(formData, "tags"),
    waist_cm: nullableNumber(formData, "waist_cm")
  };
}

export async function createModelAction(formData: FormData) {
  await requireRole(["admin"]);
  const model = await createModel(modelInputFromFormData(formData));
  revalidatePath("/admin");
  revalidatePath("/admin/models");
  redirect(`/admin/models/${model.id}/edit`);
}

export async function updateModelAction(id: string, formData: FormData) {
  await requireRole(["admin"]);
  await updateModel(id, modelInputFromFormData(formData));
  revalidatePath("/admin");
  revalidatePath("/admin/models");
  revalidatePath(`/admin/models/${id}`);
  revalidatePath(`/admin/models/${id}/edit`);
  redirect(`/admin/models/${id}/edit`);
}

export async function updateModelStatusAction(id: string, status: ModelStatus) {
  await requireRole(["admin"]);

  if (!allowedStatuses.includes(status)) {
    throw new Error("Status inválido.");
  }

  await updateModel(id, {
    is_published: status === "approved",
    status
  });
  revalidatePath("/admin");
  revalidatePath("/admin/models");
  revalidatePath(`/admin/models/${id}`);
  revalidatePath(`/admin/models/${id}/edit`);
}

export async function archiveModelAction(id: string) {
  await requireRole(["admin"]);
  await updateModel(id, {
    is_published: false,
    status: "archived"
  });
  revalidatePath("/admin");
  revalidatePath("/admin/models");
  redirect("/admin/models");
}

export async function deleteModelAction(id: string) {
  await requireRole(["admin"]);
  await deleteModel(id);
  revalidatePath("/admin");
  revalidatePath("/admin/models");
  redirect("/admin/models");
}

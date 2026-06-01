import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Model, ModelStatus } from "@/types/database";

const modelSelect = `
  id,
  user_id,
  display_name,
  legal_name,
  email,
  phone,
  status,
  is_published,
  categories,
  gender,
  nationality,
  birth_date,
  location,
  bio,
  main_image_path,
  height_cm,
  bust_cm,
  waist_cm,
  hips_cm,
  shoe_size,
  hair_color,
  eye_color,
  clothing_size,
  tags,
  notes,
  consent_lgpd,
  created_at,
  updated_at
`;

export type ModelInput = {
  bio: string | null;
  birth_date: string | null;
  bust_cm: number | null;
  categories: string[];
  clothing_size: string | null;
  consent_lgpd: boolean;
  display_name: string;
  email: string | null;
  eye_color: string | null;
  gender: string | null;
  nationality: string | null;
  hair_color: string | null;
  height_cm: number | null;
  hips_cm: number | null;
  is_published: boolean;
  legal_name: string | null;
  location: string | null;
  notes: string | null;
  phone: string | null;
  shoe_size: string | null;
  status: ModelStatus;
  tags: string[];
  waist_cm: number | null;
};

export async function listModels() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .select(modelSelect)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Model[];
}

export async function getModel(id: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .select(modelSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Model | null;
}

export async function createModel(input: ModelInput) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .insert(input)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data as { id: string };
}

export async function updateModel(id: string, input: Partial<ModelInput>) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("models").update(input).eq("id", id);

  if (error) {
    throw error;
  }
}

export async function deleteModel(id: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("models").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

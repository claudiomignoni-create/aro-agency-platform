import "server-only";

import { requireRole } from "@/lib/auth";
import { createModelMainImageUrls } from "@/lib/models";
import { createClient } from "@/lib/supabase/server";

export type EmailPresentationPreviewModel = {
  board: string | null;
  city: string | null;
  country: string | null;
  displayName: string;
  imageUrl: string | null;
  measurements: {
    bust: string | null;
    height: string | null;
    hips: string | null;
    waist: string | null;
  };
};

export type EmailPresentationPreview = {
  contact: {
    email: string;
    name: string;
    website: string;
  };
  description: string | null;
  id: string;
  models: EmailPresentationPreviewModel[];
  status: string;
  title: string;
};

type PresentationSnapshot = {
  contact?: {
    email?: string;
    name?: string;
    website?: string;
  };
  description?: string | null;
  models?: Array<{
    board?: string | null;
    city?: string | null;
    country?: string | null;
    display_name?: string;
    id?: string;
    main_image_path?: string | null;
    measurements?: Record<string, number | string | null>;
  }>;
};

function measurement(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  return `${value} cm`;
}

export async function getEmailPresentationPreview(
  presentationId: string
): Promise<EmailPresentationPreview | null> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("presentations")
    .select("id, title, description, status, snapshot")
    .eq("id", presentationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const snapshot = (data.snapshot ?? {}) as PresentationSnapshot;
  const imageSources = (snapshot.models ?? [])
    .filter((model): model is typeof model & { id: string } => Boolean(model.id))
    .map((model) => ({
      id: model.id,
      main_image_path: model.main_image_path ?? null
    }));
  const imageUrls = await createModelMainImageUrls(imageSources);

  return {
    contact: {
      email: snapshot.contact?.email || "claudio@arolab.co",
      name: snapshot.contact?.name || "ARO",
      website: snapshot.contact?.website || "www.arolab.co"
    },
    description: snapshot.description ?? data.description,
    id: data.id,
    models: (snapshot.models ?? []).slice(0, 12).map((model) => ({
      board: model.board ?? null,
      city: model.city ?? null,
      country: model.country ?? null,
      displayName: model.display_name || "Modelo ARO",
      imageUrl: model.id ? imageUrls[model.id] ?? null : null,
      measurements: {
        bust: measurement(model.measurements?.bust_cm),
        height: measurement(model.measurements?.height_cm),
        hips: measurement(model.measurements?.hips_cm),
        waist: measurement(model.measurements?.waist_cm)
      }
    })),
    status: data.status,
    title: data.title
  };
}

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createModelMedia, type ModelMediaInput } from "@/lib/models";
import type { MediaStatus, MediaType, MediaVisibility } from "@/types/database";

export const runtime = "nodejs";

const mediaCategoryTypes: Record<string, MediaType> = {
  book: "portfolio",
  documents: "document",
  polaroids: "polaroid",
  videos: "video"
};

const mediaCategoryAccepts: Record<string, RegExp> = {
  book: /^image\//,
  documents: /^(application\/pdf|image\/)/,
  polaroids: /^image\//,
  videos: /^video\//
};

const allowedUploadMediaStatuses: MediaStatus[] = [
  "pending_review",
  "approved"
];

const allowedMediaVisibilities: MediaVisibility[] = [
  "private",
  "client_only",
  "public"
];

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length ? value : null;
}

function requiredString(formData: FormData, key: string) {
  const value = optionalString(formData, key);

  if (!value) {
    throw new Error(`Campo obrigatório: ${key}`);
  }

  return value;
}

function mediaInputFromFormData(formData: FormData): ModelMediaInput {
  const file = formData.get("files");
  const mediaCategory = requiredString(formData, "media_category");
  const mediaType = requiredString(formData, "media_type") as MediaType;
  const status = (formData.get("media_status") ||
    "pending_review") as MediaStatus;
  const visibility = (formData.get("media_visibility") ||
    "private") as MediaVisibility;
  const expectedMediaType = mediaCategoryTypes[mediaCategory];
  const acceptPattern = mediaCategoryAccepts[mediaCategory];

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecione um arquivo para upload.");
  }

  if (!expectedMediaType || !acceptPattern) {
    throw new Error("Categoria de mídia ainda não disponível para upload.");
  }

  if (expectedMediaType !== mediaType) {
    throw new Error("Categoria e tipo de mídia não correspondem.");
  }

  if (!allowedUploadMediaStatuses.includes(status)) {
    throw new Error("Status de mídia inválido para upload.");
  }

  if (!allowedMediaVisibilities.includes(visibility)) {
    throw new Error("Visibilidade de mídia inválida.");
  }

  if (!acceptPattern.test(file.type || "application/octet-stream")) {
    throw new Error("O arquivo não corresponde à categoria escolhida.");
  }

  return {
    file,
    media_type: mediaType,
    review_notes: optionalString(formData, "review_notes"),
    sort_order: null,
    status,
    title: optionalString(formData, "title") || file.name,
    visibility: mediaType === "document" ? "private" : visibility
  };
}

function revalidateModelPaths(id: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/models");
  revalidatePath(`/admin/models/${id}`);
  revalidatePath(`/admin/models/${id}/edit`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const formData = await request.formData();
    const media = await createModelMedia(id, mediaInputFromFormData(formData));

    revalidateModelPaths(id);

    return NextResponse.json({
      mediaId: media.id,
      success: true
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar este arquivo.",
        success: false
      },
      { status: 400 }
    );
  }
}

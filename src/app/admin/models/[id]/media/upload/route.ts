import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  MediaStatus,
  MediaType,
  MediaVisibility
} from "@/types/database";

export const runtime = "nodejs";

type UploadAction = "complete" | "prepare";
type UploadErrorCode =
  | "DATABASE_INSERT_FAILED"
  | "FILE_TOO_LARGE"
  | "INVALID_CATEGORY"
  | "STORAGE_UPLOAD_FAILED"
  | "TIMEOUT"
  | "UNAUTHORIZED"
  | "UNKNOWN_ERROR"
  | "UNSUPPORTED_FILE_TYPE";

type UploadErrorResponse = {
  code: UploadErrorCode;
  details?: string;
  fileName?: string;
  message: string;
  success: false;
};

const bytesInMb = 1024 * 1024;
const mediaBuckets: Record<MediaType, string> = {
  document: "model-documents",
  polaroid: "model-polaroids",
  portfolio: "model-portfolio",
  video: "model-videos"
};

type MediaCategoryRule = {
  acceptedTypes: Partial<Record<MediaType, RegExp>>;
  friendlyLabel: string;
  storageFolder: string;
};

const mediaCategoryRules: Record<string, MediaCategoryRule> = {
  book: {
    acceptedTypes: {
      portfolio: /^image\/(jpeg|jpg|png|webp)$/
    },
    friendlyLabel: "JPG, PNG ou WebP",
    storageFolder: "portfolio"
  },
  composite: {
    acceptedTypes: {
      portfolio: /^image\/(jpeg|jpg|png)$/
    },
    friendlyLabel: "JPG ou PNG",
    storageFolder: "composite"
  },
  documents: {
    acceptedTypes: {
      document: /^application\/pdf$/
    },
    friendlyLabel: "PDF",
    storageFolder: "document"
  },
  polaroids: {
    acceptedTypes: {
      polaroid: /^image\/(jpeg|jpg|png|webp)$/
    },
    friendlyLabel: "JPG, PNG ou WebP",
    storageFolder: "polaroid"
  },
  videos: {
    acceptedTypes: {
      video: /^video\/(mp4|quicktime|webm)$/
    },
    friendlyLabel: "MP4, MOV ou WebM",
    storageFolder: "video"
  }
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

const uploadLimits: Record<MediaType, number> = {
  document: 30 * bytesInMb,
  polaroid: 30 * bytesInMb,
  portfolio: 30 * bytesInMb,
  video: 200 * bytesInMb
};

class UploadRequestError extends Error {
  code: UploadErrorCode;
  details?: string;
  fileName?: string;
  status: number;

  constructor({
    code,
    details,
    fileName,
    message,
    status = 400
  }: Omit<UploadErrorResponse, "success"> & { status?: number }) {
    super(message);
    this.code = code;
    this.details = details;
    this.fileName = fileName;
    this.status = status;
  }
}

function formatMb(bytes: number) {
  return `${(bytes / bytesInMb).toFixed(1)} MB`;
}

function jsonError(error: UploadRequestError) {
  return NextResponse.json(
    {
      code: error.code,
      details: error.details,
      fileName: error.fileName,
      message: error.message,
      success: false
    } satisfies UploadErrorResponse,
    { status: error.status }
  );
}

function unknownError() {
  return NextResponse.json(
    {
      code: "UNKNOWN_ERROR",
      message: "Não foi possível concluir o upload. Tente novamente.",
      success: false
    } satisfies UploadErrorResponse,
    { status: 500 }
  );
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length
    ? value.trim()
    : null;
}

function requiredString(body: Record<string, unknown>, key: string) {
  const value = optionalString(body[key]);

  if (!value) {
    throw new UploadRequestError({
      code: "INVALID_CATEGORY",
      message: `Campo obrigatório: ${key}`
    });
  }

  return value;
}

function sanitizeStorageFileName(fileName: string) {
  const safeName = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return safeName || "arquivo";
}

function normalizedFileType(fileType: string, fileName: string) {
  if (fileType && fileType !== "application/octet-stream") {
    return fileType.toLowerCase();
  }

  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName.endsWith(".jpg") || lowerFileName.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lowerFileName.endsWith(".png")) {
    return "image/png";
  }

  if (lowerFileName.endsWith(".webp")) {
    return "image/webp";
  }

  if (lowerFileName.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (lowerFileName.endsWith(".mp4")) {
    return "video/mp4";
  }

  if (lowerFileName.endsWith(".mov")) {
    return "video/quicktime";
  }

  if (lowerFileName.endsWith(".webm")) {
    return "video/webm";
  }

  return fileType.toLowerCase();
}

function validateUploadRequest(body: Record<string, unknown>) {
  const fileName = requiredString(body, "fileName");
  const fileSize = Number(body.fileSize);
  const fileType = normalizedFileType(requiredString(body, "fileType"), fileName);
  const mediaCategory = requiredString(body, "media_category");
  const mediaType = requiredString(body, "media_type") as MediaType;
  const status = (optionalString(body.media_status) ||
    "pending_review") as MediaStatus;
  const visibility = (optionalString(body.media_visibility) ||
    "private") as MediaVisibility;
  const categoryRule = mediaCategoryRules[mediaCategory];
  const acceptedType = categoryRule?.acceptedTypes[mediaType];

  if (!categoryRule || !acceptedType) {
    throw new UploadRequestError({
      code: "INVALID_CATEGORY",
      fileName,
      message: "Categoria de mídia inválida para este arquivo."
    });
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new UploadRequestError({
      code: "UNKNOWN_ERROR",
      fileName,
      message: "Não foi possível ler o tamanho do arquivo."
    });
  }

  if (fileSize > uploadLimits[mediaType]) {
    throw new UploadRequestError({
      code: "FILE_TOO_LARGE",
      details: `Tamanho: ${formatMb(fileSize)}. Limite: ${formatMb(uploadLimits[mediaType])}.`,
      fileName,
      message: "Arquivo muito grande. Reduza o tamanho ou envie uma versão menor."
    });
  }

  if (!acceptedType.test(fileType)) {
    throw new UploadRequestError({
      code: "UNSUPPORTED_FILE_TYPE",
      details: `Tipo recebido: ${fileType || "desconhecido"}. Aceito: ${categoryRule.friendlyLabel}.`,
      fileName,
      message: `Tipo de arquivo não suportado para esta categoria. Envie ${categoryRule.friendlyLabel}.`
    });
  }

  if (!allowedUploadMediaStatuses.includes(status)) {
    throw new UploadRequestError({
      code: "INVALID_CATEGORY",
      fileName,
      message: "Status de mídia inválido para upload."
    });
  }

  if (!allowedMediaVisibilities.includes(visibility)) {
    throw new UploadRequestError({
      code: "INVALID_CATEGORY",
      fileName,
      message: "Visibilidade de mídia inválida."
    });
  }

  return {
    fileName,
    fileSize,
    fileType,
    mediaType,
    reviewNotes: optionalString(body.review_notes),
    status,
    storageFolder: categoryRule.storageFolder,
    title: optionalString(body.title) || fileName,
    visibility: mediaType === "document" ? "private" : visibility
  };
}

function revalidateModelPaths(id: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/models");
  revalidatePath(`/admin/models/${id}`);
  revalidatePath(`/admin/models/${id}/edit`);
}

async function ensureModelExists(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("models")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new UploadRequestError({
      code: "UNKNOWN_ERROR",
      message: "Não foi possível validar o modelo."
    });
  }

  if (!data) {
    throw new UploadRequestError({
      code: "INVALID_CATEGORY",
      message: "Modelo não encontrado."
    });
  }
}

async function storageObjectExists(bucket: string, storagePath: string) {
  const admin = createAdminClient();
  const lastSlash = storagePath.lastIndexOf("/");
  const folder = storagePath.slice(0, lastSlash);
  const fileName = storagePath.slice(lastSlash + 1);
  const { data, error } = await admin.storage
    .from(bucket)
    .list(folder, { limit: 1, search: fileName });

  if (error) {
    return false;
  }

  return Boolean(data?.some((item) => item.name === fileName));
}

async function prepareUpload(id: string, body: Record<string, unknown>) {
  const input = validateUploadRequest(body);
  await ensureModelExists(id);

  const admin = createAdminClient();
  const bucket = mediaBuckets[input.mediaType];
  const safeFileName = sanitizeStorageFileName(input.fileName);
  const storagePath = `models/${id}/${input.storageFolder}/${Date.now()}-${crypto.randomUUID()}-${safeFileName}`;
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUploadUrl(storagePath, { upsert: false });

  if (error) {
    throw new UploadRequestError({
      code: "STORAGE_UPLOAD_FAILED",
      fileName: input.fileName,
      message: "Falha ao preparar o envio para o storage. Tente novamente."
    });
  }

  return NextResponse.json({
    bucket,
    fileName: input.fileName,
    path: data.path,
    success: true,
    token: data.token
  });
}

async function completeUpload(
  id: string,
  body: Record<string, unknown>,
  uploadedBy: string
) {
  const input = validateUploadRequest(body);
  const bucket = requiredString(body, "bucket");
  const storagePath = requiredString(body, "path");
  const expectedBucket = mediaBuckets[input.mediaType];

  if (
    bucket !== expectedBucket ||
    !storagePath.startsWith(`models/${id}/${input.storageFolder}/`)
  ) {
    throw new UploadRequestError({
      code: "STORAGE_UPLOAD_FAILED",
      fileName: input.fileName,
      message: "O arquivo enviado não corresponde ao modelo ou categoria."
    });
  }

  if (!(await storageObjectExists(bucket, storagePath))) {
    throw new UploadRequestError({
      code: "STORAGE_UPLOAD_FAILED",
      fileName: input.fileName,
      message: "Falha ao salvar no storage. Tente novamente."
    });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("model_media")
    .insert({
      media_type: input.mediaType,
      model_id: id,
      review_notes: input.reviewNotes,
      sort_order: null,
      status: input.status,
      storage_bucket: bucket,
      storage_path: storagePath,
      title: input.title,
      uploaded_by: uploadedBy,
      visibility: input.visibility
    })
    .select("id")
    .single();

  if (error) {
    await admin.storage.from(bucket).remove([storagePath]);
    throw new UploadRequestError({
      code: "DATABASE_INSERT_FAILED",
      fileName: input.fileName,
      message: "Falha ao registrar a mídia. O arquivo não foi adicionado."
    });
  }

  await admin
    .from("models")
    .update({ last_media_update_at: new Date().toISOString() })
    .eq("id", id);

  revalidateModelPaths(id);

  return NextResponse.json({
    mediaId: data.id,
    success: true
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole(["admin"]);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = requiredString(body, "action") as UploadAction;

    if (action === "prepare") {
      return prepareUpload(id, body);
    }

    if (action === "complete") {
      return completeUpload(id, body, profile.id);
    }

    throw new UploadRequestError({
      code: "UNKNOWN_ERROR",
      message: "Ação de upload inválida."
    });
  } catch (error) {
    if (error instanceof UploadRequestError) {
      return jsonError(error);
    }

    if (error instanceof Error && /auth|role|permission|unauthorized/i.test(error.message)) {
      return jsonError(
        new UploadRequestError({
          code: "UNAUTHORIZED",
          message: "Sua sessão expirou. Faça login novamente.",
          status: 401
        })
      );
    }

    return unknownError();
  }
}

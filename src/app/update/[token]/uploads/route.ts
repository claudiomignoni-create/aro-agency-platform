import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestIpHash } from "@/lib/communications/rate-limit";
import { checkCommunicationRateLimit } from "@/lib/communications/rate-limit";
import { sanitizeError, sha256 } from "@/lib/communications/security";

export const runtime = "nodejs";
export const maxDuration = 60;

const bytesInMb = 1024 * 1024;
const maxSynchronousVideoBytes = 25 * bytesInMb;
const fieldRules: Record<
  string,
  {
    bucket: string;
    folder: string;
    maxBytes: number;
    mediaType: string;
    mime: RegExp;
    extensions: string[];
    sensitive?: boolean;
  }
> = {
  composite: {
    bucket: "model-portfolio",
    folder: "composite",
    extensions: [".jpeg", ".jpg", ".png", ".webp"],
    maxBytes: 30 * bytesInMb,
    mediaType: "portfolio",
    mime: /^image\/(jpeg|jpg|png|webp)$/
  },
  documents: {
    bucket: "model-documents",
    folder: "documents",
    extensions: [".jpeg", ".jpg", ".pdf", ".png"],
    maxBytes: 30 * bytesInMb,
    mediaType: "document",
    mime: /^(application\/pdf|image\/(jpeg|jpg|png))$/,
    sensitive: true
  },
  polaroids: {
    bucket: "model-polaroids",
    folder: "polaroids",
    extensions: [".jpeg", ".jpg", ".png", ".webp"],
    maxBytes: 30 * bytesInMb,
    mediaType: "polaroid",
    mime: /^image\/(jpeg|jpg|png|webp)$/
  },
  portfolio: {
    bucket: "model-portfolio",
    folder: "portfolio",
    extensions: [".jpeg", ".jpg", ".png", ".webp"],
    maxBytes: 30 * bytesInMb,
    mediaType: "portfolio",
    mime: /^image\/(jpeg|jpg|png|webp)$/
  },
  videos: {
    bucket: "model-videos",
    folder: "videos",
    extensions: [".mov", ".mp4", ".webm"],
    maxBytes: maxSynchronousVideoBytes,
    mediaType: "video",
    mime: /^video\/(mp4|quicktime|webm)$/
  }
};

function cleanFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "arquivo";
}

async function getRequest(token: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("model_update_requests")
    .select("id, model_id, status, expires_at, model:models(id, email)")
    .eq("public_token_hash", sha256(token))
    .not("status", "in", "(expired,canceled,applied,submitted,review_required)")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function ensureSubmission(requestId: string, modelId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("model_update_submissions")
    .upsert(
      {
        model_id: modelId,
        request_id: requestId,
        status: "draft"
      },
      { onConflict: "request_id" }
    )
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function fieldAllowed(requestId: string, fieldKey: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("model_update_request_fields")
    .select("field_key, is_sensitive")
    .eq("request_id", requestId)
    .eq("field_key", fieldKey)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function sensitiveVerified(requestId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("model_update_verification_codes")
    .select("id")
    .eq("request_id", requestId)
    .not("verified_at", "is", null)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("verified_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return Boolean(data?.length);
}

async function objectExists(bucket: string, objectPath: string) {
  const admin = createAdminClient();
  const slash = objectPath.lastIndexOf("/");
  const folder = objectPath.slice(0, slash);
  const name = objectPath.slice(slash + 1);
  const { data, error } = await admin.storage.from(bucket).list(folder, {
    limit: 1,
    search: name
  });

  if (error) return false;
  return Boolean(data?.some((item) => item.name === name));
}

function normalizeMimeType(value: string) {
  return value === "image/jpg" ? "image/jpeg" : value;
}

function detectFileSignature(bytes: Buffer) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp") {
    return bytes.subarray(8, 12).toString("ascii") === "qt  " ? "video/quicktime" : "video/mp4";
  }
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return "video/webm";
  }
  return null;
}

async function validateStoredObject({
  bucket,
  expectedMimeType,
  expectedSha256,
  expectedSizeBytes,
  objectPath,
  rule
}: {
  bucket: string;
  expectedMimeType: string;
  expectedSha256: string;
  expectedSizeBytes: number;
  objectPath: string;
  rule: (typeof fieldRules)[string];
}) {
  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage.from(bucket).createSignedUrl(objectPath, 60);
  if (error || !signed?.signedUrl) throw error ?? new Error("Arquivo não encontrado no Storage.");

  const response = await fetch(signed.signedUrl, { cache: "no-store" });
  if (!response.ok || !response.body) throw new Error("Arquivo não encontrado no Storage.");

  const actualMimeType = normalizeMimeType(
    (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
  );
  const normalizedExpectedMimeType = normalizeMimeType(expectedMimeType);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (!actualMimeType || !rule.mime.test(actualMimeType)) throw new Error("Tipo real do arquivo não permitido.");
  if (actualMimeType !== normalizedExpectedMimeType) throw new Error("Tipo real do arquivo difere do envio autorizado.");
  if (contentLength && contentLength !== expectedSizeBytes) throw new Error("Tamanho real do arquivo difere do envio autorizado.");

  const hash = crypto.createHash("sha256");
  let actualSizeBytes = 0;
  let signatureBytes = Buffer.alloc(0);
  const reader = response.body.getReader();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (signatureBytes.length < 32) {
      signatureBytes = Buffer.concat([
        signatureBytes,
        Buffer.from(value.subarray(0, 32 - signatureBytes.length))
      ]);
    }
    actualSizeBytes += value.byteLength;
    if (actualSizeBytes > rule.maxBytes) throw new Error("Arquivo maior que o limite permitido.");
    hash.update(value);
  }

  const signatureMimeType = detectFileSignature(signatureBytes);
  if (!signatureMimeType || !rule.mime.test(signatureMimeType)) {
    throw new Error("Assinatura real do arquivo não permitida.");
  }
  if (signatureMimeType !== normalizedExpectedMimeType || signatureMimeType !== actualMimeType) {
    throw new Error("Assinatura real do arquivo difere do tipo autorizado.");
  }

  const actualSha256 = hash.digest("hex");
  if (actualSizeBytes !== expectedSizeBytes) throw new Error("Tamanho real do arquivo difere do envio autorizado.");
  if (actualSha256 !== expectedSha256) throw new Error("SHA-256 real do arquivo difere do envio autorizado.");

  return { actualMimeType, actualSha256, actualSizeBytes };
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const ipHash = await requestIpHash();
    const tokenHash = sha256(token);
    const allowed = await checkCommunicationRateLimit({
      ipHash,
      operation: "update_upload",
      tokenHash
    });
    if (!allowed) throw new Error("Rate limit exceeded");

    const body = (await request.json()) as {
      action?: "complete" | "prepare" | "remove";
      bucket?: string;
      fieldKey?: string;
      fileName?: string;
      mimeType?: string;
      objectPath?: string;
      sha256?: string;
      sizeBytes?: number;
    };
    const action = body.action ?? "prepare";
    const fieldKey = String(body.fieldKey ?? "");
    const rule = fieldRules[fieldKey];
    if (!rule) throw new Error("Tipo de material inválido.");

    const updateRequest = await getRequest(token);
    if (!updateRequest) throw new Error("Solicitação inválida ou expirada.");

    const requestedField = await fieldAllowed(updateRequest.id, fieldKey);
    if (!requestedField) throw new Error("Campo não solicitado.");
    if ((requestedField.is_sensitive || rule.sensitive) && !(await sensitiveVerified(updateRequest.id))) {
      throw new Error("Verificação necessária para este material.");
    }

    const admin = createAdminClient();
    const submissionId = await ensureSubmission(updateRequest.id, updateRequest.model_id);

    if (action === "remove") {
      const objectPath = String(body.objectPath ?? "");
      if (!objectPath.startsWith(`models/${updateRequest.model_id}/updates/${updateRequest.id}/`)) {
        throw new Error("Arquivo inválido.");
      }
      await admin.storage.from(rule.bucket).remove([objectPath]);
      await admin
        .from("model_update_files")
        .update({ status: "archived" })
        .eq("submission_id", submissionId)
        .eq("object_path", objectPath);
      return NextResponse.json({ ok: true });
    }

    const fileName = cleanFileName(String(body.fileName ?? ""));
    const extension = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
    const mimeType = String(body.mimeType ?? "").toLowerCase();
    const sizeBytes = Number(body.sizeBytes ?? 0);
    const expectedSha256 = String(body.sha256 ?? "").toLowerCase();
    if (!rule.extensions.includes(extension)) throw new Error("Extensão de arquivo não permitida.");
    if (!rule.mime.test(mimeType)) throw new Error("Tipo de arquivo não permitido.");
    if (!sizeBytes || sizeBytes > rule.maxBytes) throw new Error("Arquivo maior que o limite permitido.");
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) throw new Error("Checksum SHA-256 inválido.");

    if (action === "prepare") {
      const objectPath = `models/${updateRequest.model_id}/updates/${updateRequest.id}/${rule.folder}/${Date.now()}-${crypto.randomUUID()}-${fileName}`;
      const { data, error } = await admin.storage.from(rule.bucket).createSignedUploadUrl(objectPath, {
        upsert: false
      });
      if (error) throw error;
      return NextResponse.json({
        bucket: rule.bucket,
        objectPath: data.path,
        ok: true,
        token: data.token
      });
    }

    const objectPath = String(body.objectPath ?? "");
    if (body.bucket !== rule.bucket || !objectPath.startsWith(`models/${updateRequest.model_id}/updates/${updateRequest.id}/${rule.folder}/`)) {
      throw new Error("Arquivo enviado não corresponde à autorização.");
    }
    if (!(await objectExists(rule.bucket, objectPath))) throw new Error("Arquivo não encontrado no Storage.");

    const { data: existing } = await admin
      .from("model_update_files")
      .select("id")
      .eq("submission_id", submissionId)
      .eq("object_path", objectPath)
      .maybeSingle();

    let fileId = existing?.id as string | undefined;
    if (!existing) {
      const { data: inserted, error } = await admin.from("model_update_files").insert({
        bucket: rule.bucket,
        media_type: rule.mediaType,
        mime_type: mimeType,
        object_path: objectPath,
        original_name: fileName,
        sha256: expectedSha256,
        size_bytes: sizeBytes,
        status: "validating",
        submission_id: submissionId
      }).select("id").single();
      if (error) throw error;
      fileId = inserted.id;
    } else {
      await admin
        .from("model_update_files")
        .update({ status: "validating" })
        .eq("id", existing.id);
    }

    try {
      const validated = await validateStoredObject({
        bucket: rule.bucket,
        expectedMimeType: mimeType,
        expectedSha256,
        expectedSizeBytes: sizeBytes,
        objectPath,
        rule
      });

      if (fileId) {
        await admin
          .from("model_update_files")
          .update({
            mime_type: validated.actualMimeType,
            sha256: validated.actualSha256,
            size_bytes: validated.actualSizeBytes,
            status: "pending_review",
            validation_error_sanitized: null
          })
          .eq("id", fileId);
      }
    } catch (validationError) {
      await admin.storage.from(rule.bucket).remove([objectPath]);
      if (fileId) {
        await admin
          .from("model_update_files")
          .update({
            status: "rejected",
            validation_error_sanitized: sanitizeError(validationError)
          })
          .eq("id", fileId);
      }
      throw validationError;
    }

    return NextResponse.json({ ok: true, objectPath });
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error), ok: false }, { status: 400 });
  }
}

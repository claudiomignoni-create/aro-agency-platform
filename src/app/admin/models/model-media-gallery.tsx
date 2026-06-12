"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { MediaStatus, ModelMedia } from "@/types/database";
import {
  deleteModelMediaBatchAction,
  downloadModelMediaAction,
  getModelMediaOriginalUrlAction,
  getModelMediaPreviewUrlsAction,
  updateModelMainImageAction,
  updateModelMediaBatchStatusAction,
  updateModelMediaBatchVisibilityAction
} from "./actions";

type MediaCategory = {
  accept?: string;
  description: string;
  emptyLabel: string;
  id: string;
  mediaType?: ModelMedia["media_type"];
  placeholder: string;
  title: string;
  uploadLabel?: string;
};

type ModelMediaGalleryProps = {
  media: ModelMedia[];
  modelId: string;
};

type UploadErrorCode =
  | "CANCELLED"
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

type PrepareUploadResponse = {
  bucket: string;
  fileName: string;
  path: string;
  success: true;
  token: string;
};

type CompleteUploadResponse = {
  mediaId: string;
  success: true;
};

type UploadResponse =
  | CompleteUploadResponse
  | PrepareUploadResponse
  | UploadErrorResponse;

type UploadQueueItem = {
  code?: UploadErrorCode;
  details?: string;
  error?: string;
  file: File;
  id: string;
  mediaId?: string;
  status: "failed" | "pending" | "uploaded" | "uploading";
};

type ActiveUploadControllers = {
  current: Set<AbortController>;
};

const mediaCategories: MediaCategory[] = [
  {
    accept: "image/jpeg,image/png,image/webp",
    description: "Fotos profissionais do book do modelo.",
    emptyLabel: "Ainda sem materiais cadastrados",
    id: "book",
    mediaType: "portfolio",
    placeholder: "Imagem",
    title: "Book",
    uploadLabel: "Adicionar ao Book"
  },
  {
    accept: "image/jpeg,image/png,image/webp",
    description: "Digitals e polaroids para avaliacao rapida.",
    emptyLabel: "Ainda sem materiais cadastrados",
    id: "polaroids",
    mediaType: "polaroid",
    placeholder: "Imagem",
    title: "Polaroids",
    uploadLabel: "Adicionar Polaroids"
  },
  {
    accept: "image/jpeg,image/png,.jpg,.jpeg,.png",
    description: "Cartao visual do modelo em imagem.",
    emptyLabel: "Ainda sem materiais cadastrados",
    id: "composite",
    mediaType: "portfolio",
    placeholder: "Imagem",
    title: "Composite",
    uploadLabel: "Adicionar Composite"
  },
  {
    accept: "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm",
    description: "Videos gerais do modelo.",
    emptyLabel: "Ainda sem materiais cadastrados",
    id: "videos",
    mediaType: "video",
    placeholder: "Video",
    title: "Videos",
    uploadLabel: "Adicionar Videos"
  },
  {
    accept: "application/pdf,.pdf",
    description: "PDFs e documentos administrativos privados.",
    emptyLabel: "Ainda sem materiais cadastrados",
    id: "documents",
    mediaType: "document",
    placeholder: "PDF",
    title: "PDFs / Documents",
    uploadLabel: "Adicionar PDF"
  }
];

const initialVisibleMediaCount = 30;
const visibleMediaIncrement = 30;
const imageMediaTypes: ModelMedia["media_type"][] = ["portfolio", "polaroid"];

function isImageMedia(item: ModelMedia) {
  return imageMediaTypes.includes(item.media_type);
}

function isVideoMedia(item: ModelMedia) {
  return item.media_type === "video";
}

function isDocumentMedia(item: ModelMedia) {
  return item.media_type === "document";
}

function shouldShowMediaLabel(item: ModelMedia) {
  return !isImageMedia(item);
}

function storageCategorySegment(item: ModelMedia) {
  const prefix = `models/${item.model_id}/`;
  const path = item.storage_path.startsWith(prefix)
    ? item.storage_path.slice(prefix.length)
    : item.storage_path;

  return path.split("/")[0] || item.media_type;
}

function mediaCategoryIdFromItem(item: ModelMedia) {
  const segment = storageCategorySegment(item);

  if (segment === "portfolio" || segment === "book") {
    return "book";
  }

  if (segment === "polaroid" || segment === "polaroids") {
    return "polaroids";
  }

  if (segment === "document" || segment === "documents") {
    return "documents";
  }

  if (segment === "video" || segment === "videos") {
    return "videos";
  }

  return segment;
}

function mediaPlaceholder(category: MediaCategory, item?: ModelMedia) {
  if (item?.media_type === "document") {
    return item.storage_path?.toLowerCase().endsWith(".pdf")
      ? "PDF"
      : "Documento";
  }

  return category.placeholder;
}

function mediaCardLabel(category: MediaCategory, item: ModelMedia) {
  if (isDocumentMedia(item)) {
    return item.storage_path.toLowerCase().endsWith(".pdf")
      ? "Documento PDF"
      : "Documento";
  }

  if (isVideoMedia(item)) {
    return "Video";
  }

  return category.placeholder;
}

function canOpenInViewer(item: ModelMedia, previewUrls: Record<string, string>) {
  return Boolean(previewUrls[item.id]) || isVideoMedia(item) || isDocumentMedia(item);
}

function sortMediaItems(items: ModelMedia[]) {
  return [...items].sort((first, second) => {
    if (first.sort_order !== null && second.sort_order !== null) {
      return first.sort_order - second.sort_order;
    }

    if (first.sort_order !== null) {
      return -1;
    }

    if (second.sort_order !== null) {
      return 1;
    }

    return (
      new Date(second.created_at).getTime() -
      new Date(first.created_at).getTime()
    );
  });
}

function createUploadItem(file: File, index: number): UploadQueueItem {
  return {
    file,
    id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
    status: "pending"
  };
}

function uploadPayload(
  action: "complete" | "prepare",
  category: MediaCategory,
  file: File,
  mediaType: ModelMedia["media_type"],
  storage?: { bucket: string; path: string }
) {
  return {
    action,
    bucket: storage?.bucket,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || "application/octet-stream",
    media_category: category.id,
    media_status: "pending_review",
    media_type: mediaType,
    media_visibility: "private",
    path: storage?.path,
    title: file.name
  };
}

function uploadConcurrency(mediaType: ModelMedia["media_type"]) {
  if (mediaType === "video") {
    return 1;
  }

  if (mediaType === "document") {
    return 2;
  }

  return 3;
}

async function uploadRequest(
  modelId: string,
  body: Record<string, unknown>,
  activeControllers: ActiveUploadControllers
): Promise<UploadResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  activeControllers.current.add(controller);

  try {
    const response = await fetch(`/admin/models/${modelId}/media/upload`, {
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: controller.signal
    });

    if (response.redirected || response.url.includes("/login")) {
      return {
        code: "UNAUTHORIZED",
        message: "Sua sessão expirou. Faça login novamente.",
        success: false
      };
    }

    const result = (await response.json().catch(() => null)) as
      | UploadResponse
      | null;

    if (!response.ok || !result?.success) {
      return {
        code: result && !result.success ? result.code : "UNKNOWN_ERROR",
        details: result && !result.success ? result.details : undefined,
        fileName: result && !result.success ? result.fileName : undefined,
        message:
          result && !result.success
            ? result.message
            : "Não foi possível enviar este arquivo. Tente novamente.",
        success: false
      };
    }

    return result;
  } catch (error) {
    return {
      code:
        error instanceof DOMException && error.name === "AbortError"
          ? "TIMEOUT"
          : "UNKNOWN_ERROR",
      message:
        error instanceof DOMException && error.name === "AbortError"
          ? "Tempo limite atingido ao preparar este arquivo."
          : "Não foi possível enviar este arquivo. Verifique a conexão e tente novamente.",
      success: false
    };
  } finally {
    clearTimeout(timeout);
    activeControllers.current.delete(controller);
  }
}

async function uploadDirectToStorage(
  file: File,
  preparedUpload: PrepareUploadResponse
): Promise<UploadErrorResponse | null> {
  try {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.storage
      .from(preparedUpload.bucket)
      .uploadToSignedUrl(preparedUpload.path, preparedUpload.token, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });

    if (error) {
      return {
        code: "STORAGE_UPLOAD_FAILED",
        details: error.message,
        fileName: file.name,
        message: "Falha ao salvar no storage. Tente novamente.",
        success: false
      };
    }

    return null;
  } catch (error) {
    return {
      code:
        error instanceof DOMException && error.name === "AbortError"
          ? "TIMEOUT"
          : "STORAGE_UPLOAD_FAILED",
      details: error instanceof Error ? error.message : undefined,
      fileName: file.name,
      message:
        error instanceof DOMException && error.name === "AbortError"
          ? "Tempo limite atingido ao enviar este arquivo."
          : "Falha ao salvar no storage. Tente novamente.",
      success: false
    };
  }
}

function UploadArea({
  category,
  modelId
}: {
  category: MediaCategory;
  modelId: string;
}) {
  const router = useRouter();
  const [isRefreshPending, startTransition] = useTransition();
  const activeControllersRef = useRef<Set<AbortController>>(new Set());
  const cancelRequestedRef = useRef(false);
  const isUploadingRef = useRef(false);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [uploadItems, setUploadItems] = useState<UploadQueueItem[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const mediaType = category.mediaType;

  if (!mediaType || !category.accept || !category.uploadLabel) {
    return (
      <p className="media-future-note">Ainda sem suporte de upload nesta fase</p>
    );
  }

  const uploadMediaType: ModelMedia["media_type"] = mediaType;
  const uploadedCount = uploadItems.filter((item) => item.status === "uploaded")
    .length;
  const failedItems = uploadItems.filter((item) => item.status === "failed");
  const failedCount = failedItems.length;
  const pendingCount = uploadItems.filter((item) => item.status === "pending")
    .length;
  const uploadingCount = uploadItems.filter((item) => item.status === "uploading")
    .length;
  const completedCount = uploadedCount + failedCount;
  const totalCount = uploadItems.length;
  const concurrencyLimit = uploadConcurrency(uploadMediaType);
  const currentUploadNumber =
    totalCount > 0
      ? Math.min(completedCount + Math.max(uploadingCount, 1), totalCount)
      : 0;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const canSubmit =
    totalCount > 0 &&
    !uploading &&
    !isRefreshPending &&
    uploadItems.some((item) => item.status === "pending" || item.status === "failed");

  function updateUploadItem(
    itemId: string,
    updates: Partial<Omit<UploadQueueItem, "file" | "id">>
  ) {
    setUploadItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...updates
            }
          : item
      )
    );
  }

  async function uploadQueueItem(item: UploadQueueItem) {
    setCurrentFileName(item.file.name);
    updateUploadItem(item.id, {
      code: undefined,
      details: undefined,
      error: undefined,
      status: "uploading"
    });

    const preparedUpload = await uploadRequest(
      modelId,
      uploadPayload("prepare", category, item.file, uploadMediaType),
      activeControllersRef
    );

    if (!preparedUpload.success) {
      updateUploadItem(item.id, {
        code: cancelRequestedRef.current ? "CANCELLED" : preparedUpload.code,
        details: preparedUpload.details,
        error: cancelRequestedRef.current ? "Upload cancelado." : preparedUpload.message,
        status: "failed"
      });
      return cancelRequestedRef.current
        ? ({
            code: "CANCELLED",
            message: "Upload cancelado.",
            success: false
          } satisfies UploadErrorResponse)
        : preparedUpload;
    }

    if (!("token" in preparedUpload)) {
      const error: UploadErrorResponse = {
        code: "UNKNOWN_ERROR",
        fileName: item.file.name,
        message: "Não foi possível preparar o upload deste arquivo.",
        success: false
      };
      updateUploadItem(item.id, {
        code: error.code,
        error: error.message,
        status: "failed"
      });
      return error;
    }

    const storageError = await uploadDirectToStorage(item.file, preparedUpload);

    if (storageError) {
      updateUploadItem(item.id, {
        code: storageError.code,
        details: storageError.details,
        error: storageError.message,
        status: "failed"
      });
      return storageError;
    }

    const completedUpload = await uploadRequest(
      modelId,
      uploadPayload("complete", category, item.file, uploadMediaType, {
        bucket: preparedUpload.bucket,
        path: preparedUpload.path
      }),
      activeControllersRef
    );

    if (!completedUpload.success) {
      updateUploadItem(item.id, {
        code: completedUpload.code,
        details: completedUpload.details,
        error: completedUpload.message,
        status: "failed"
      });
      return completedUpload;
    }

    if (!("mediaId" in completedUpload)) {
      const error: UploadErrorResponse = {
        code: "DATABASE_INSERT_FAILED",
        fileName: item.file.name,
        message: "Falha ao registrar a mídia. O arquivo não foi adicionado.",
        success: false
      };
      updateUploadItem(item.id, {
        code: error.code,
        error: error.message,
        status: "failed"
      });
      return error;
    }

    updateUploadItem(item.id, {
      mediaId: completedUpload.mediaId,
      status: "uploaded"
    });

    return completedUpload;
  }

  async function uploadItemsById(itemIds: string[]) {
    if (isUploadingRef.current) {
      return;
    }

    const itemsToUpload = uploadItems.filter(
      (item) =>
        itemIds.includes(item.id) &&
        (item.status === "pending" || item.status === "failed")
    );

    if (itemsToUpload.length === 0) {
      return;
    }

    isUploadingRef.current = true;
    cancelRequestedRef.current = false;
    setUploading(true);
    setIsCanceling(false);
    setUploadSuccess(null);

    let uploadedInRun = 0;
    let failedInRun = 0;
    let stoppedForAuth = false;
    let nextIndex = 0;

    try {
      async function worker() {
        while (!cancelRequestedRef.current) {
          const item = itemsToUpload[nextIndex];
          nextIndex += 1;

          if (!item) {
            return;
          }

          const result = await uploadQueueItem(item);

          if (result.success) {
            uploadedInRun += 1;
          } else {
            failedInRun += 1;

            if (result.code === "UNAUTHORIZED") {
              stoppedForAuth = true;
              cancelRequestedRef.current = true;
              activeControllersRef.current.forEach((controller) =>
                controller.abort()
              );
              return;
            }
          }
        }
      }

      await Promise.all(
        Array.from({
          length: Math.min(concurrencyLimit, itemsToUpload.length)
        }).map(() => worker())
      );

      setUploadSuccess(
        stoppedForAuth
          ? "Sua sessão expirou. Faça login novamente."
          : cancelRequestedRef.current
            ? `${uploadedInRun} enviado${uploadedInRun !== 1 ? "s" : ""}. Upload cancelado.`
            : failedInRun > 0
            ? `${uploadedInRun} enviado${uploadedInRun !== 1 ? "s" : ""}, ${failedInRun} com erro.`
            : `${uploadedInRun} arquivo${uploadedInRun !== 1 ? "s" : ""} enviado${uploadedInRun !== 1 ? "s" : ""} com sucesso.`
      );
      if (uploadedInRun > 0) {
        startTransition(() => {
          router.replace(`/admin/models/${modelId}/edit?tab=media&saved=1`);
          router.refresh();
        });
      }
    } finally {
      setCurrentFileName(null);
      setIsCanceling(false);
      setUploading(false);
      isUploadingRef.current = false;
    }
  }

  function cancelUpload() {
    if (!isUploadingRef.current) {
      return;
    }

    cancelRequestedRef.current = true;
    setIsCanceling(true);
    setUploadSuccess("Cancelando upload. Arquivos já enviados serão mantidos.");
    activeControllersRef.current.forEach((controller) => controller.abort());
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await uploadItemsById(
      uploadItems
        .filter((item) => item.status === "pending" || item.status === "failed")
        .map((item) => item.id)
    );
  }

  return (
    <form
      className="media-upload"
      encType="multipart/form-data"
      onSubmit={handleUpload}
    >
      <input name="media_category" type="hidden" value={category.id} />
      <input name="media_type" type="hidden" value={category.mediaType ?? ""} />
      <input name="media_status" type="hidden" value="pending_review" />
      <input name="media_visibility" type="hidden" value="private" />
      <label className="media-upload-tile">
        <input
          accept={category.accept}
          className="media-file-input"
          disabled={uploading || isRefreshPending}
          multiple
          name="files"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            setUploadItems(files.map(createUploadItem));
            setUploadSuccess(null);
          }}
          required
          type="file"
        />
        <span className="media-upload-icon">+</span>
        <span>{category.uploadLabel}</span>
      </label>
      <div className="media-upload-status">
        <span>
          {totalCount > 0
            ? `${totalCount} arquivo${totalCount > 1 ? "s" : ""} selecionado${totalCount > 1 ? "s" : ""}`
            : "Selecione arquivos"}
        </span>
        {uploading ? (
          <span>
            Enviando {currentUploadNumber} de {totalCount} arquivos
            {uploadingCount > 1 ? ` (${uploadingCount} em andamento)` : ""}
          </span>
        ) : null}
        {isCanceling ? <span>Cancelando upload...</span> : null}
        {isRefreshPending ? <span>Atualizando galeria...</span> : null}
        {currentFileName ? <span>{currentFileName}</span> : null}
        {totalCount > 0 ? (
          <span>
            {uploadedCount} enviados / {failedCount} com erro / {pendingCount} pendentes
            {totalCount > 1 ? ` / até ${concurrencyLimit} simultâneos` : ""}
          </span>
        ) : null}
      </div>
      {totalCount > 0 ? (
        <div className="media-upload-progress" aria-hidden="true">
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      ) : null}
      {uploadSuccess ? (
        <p className="media-upload-success">{uploadSuccess}</p>
      ) : null}
      {failedItems.length > 0 ? (
        <div className="media-upload-errors">
          {failedItems.map((item) => (
            <div className="media-upload-error-item" key={item.id}>
              <div>
                <strong>{item.file.name}</strong>
                <span>{item.error ?? "Não foi possível enviar este arquivo."}</span>
                {item.details ? <small>{item.details}</small> : null}
              </div>
              <button
                className="media-retry-button"
                disabled={uploading}
                onClick={() => uploadItemsById([item.id])}
                type="button"
              >
                Tentar novamente
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {failedItems.length > 1 ? (
        <button
          className="media-retry-button"
          disabled={uploading}
          onClick={() => uploadItemsById(failedItems.map((item) => item.id))}
          type="button"
        >
          Tentar novamente todos com erro
        </button>
      ) : null}
      {uploading ? (
        <button
          className="media-retry-button"
          disabled={isCanceling}
          onClick={cancelUpload}
          type="button"
        >
          Cancelar upload
        </button>
      ) : null}
      <button
        className="button secondary"
        disabled={!canSubmit}
        type="submit"
      >
        {uploading ? "Enviando..." : "Enviar pendentes"}
      </button>
    </form>
  );
}

function SelectedInputs({ ids }: { ids: string[] }) {
  return (
    <>
      {ids.map((id) => (
        <input key={id} name="media_ids" type="hidden" value={id} />
      ))}
    </>
  );
}

function BatchActionBar({
  modelId,
  selectedItems,
  totalCount,
  onToggleAll
}: {
  modelId: string;
  onToggleAll: () => void;
  selectedItems: ModelMedia[];
  totalCount: number;
}) {
  const selectedIds = selectedItems.map((item) => item.id);
  const selectedCount = selectedItems.length;
  const singleSelected = selectedItems[0];
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const canSetMainImage =
    selectedCount === 1 &&
    singleSelected?.media_type === "portfolio" &&
    mediaCategoryIdFromItem(singleSelected) === "book";
  const canChangeClientVisibility = selectedItems.every(
    (item) => item.media_type !== "document"
  );

  return (
    <div className="media-batch-bar">
      <strong>
        {selectedCount} selecionado{selectedCount !== 1 ? "s" : ""}
      </strong>
      <div className="media-batch-actions">
        <button className="media-action-button neutral" onClick={onToggleAll} type="button">
          {allSelected ? "Limpar selecao" : "Selecionar todos"}
        </button>
        {selectedCount > 0 ? (
          <>
            {singleSelected && selectedCount === 1 ? (
              <form action={downloadModelMediaAction.bind(null, modelId, singleSelected.id)}>
                <button className="media-action-button neutral" type="submit">
                  Abrir/Baixar
                </button>
              </form>
            ) : null}
            {singleSelected && canSetMainImage ? (
              <form action={updateModelMainImageAction.bind(null, modelId, singleSelected.id)}>
                <button className="media-action-button neutral" type="submit">
                  Definir como foto principal
                </button>
              </form>
            ) : null}
            <form
              action={updateModelMediaBatchStatusAction.bind(
                null,
                modelId,
                "approved" satisfies MediaStatus
              )}
            >
              <SelectedInputs ids={selectedIds} />
              <button className="media-action-button approve" type="submit">
                Aprovar
              </button>
            </form>
            <form
              action={updateModelMediaBatchStatusAction.bind(
                null,
                modelId,
                "rejected" satisfies MediaStatus
              )}
            >
              <SelectedInputs ids={selectedIds} />
              <button className="media-action-button reject" type="submit">
                Rejeitar
              </button>
            </form>
            {canChangeClientVisibility ? (
              <form action={updateModelMediaBatchVisibilityAction.bind(null, modelId)}>
                <SelectedInputs ids={selectedIds} />
                <input name="media_visibility" type="hidden" value="client_only" />
                <button className="media-action-button neutral" type="submit">
                  Visivel para clientes
                </button>
              </form>
            ) : null}
            {canChangeClientVisibility ? (
              <form action={updateModelMediaBatchVisibilityAction.bind(null, modelId)}>
                <SelectedInputs ids={selectedIds} />
                <input name="media_visibility" type="hidden" value="public" />
                <button className="media-action-button neutral" type="submit">
                  Publico
                </button>
              </form>
            ) : null}
            <form action={updateModelMediaBatchVisibilityAction.bind(null, modelId)}>
              <SelectedInputs ids={selectedIds} />
              <input name="media_visibility" type="hidden" value="private" />
              <button className="media-action-button neutral" type="submit">
                Privado interno
              </button>
            </form>
            <form action={deleteModelMediaBatchAction.bind(null, modelId)}>
              <SelectedInputs ids={selectedIds} />
              <button className="media-action-button danger" type="submit">
                Excluir midia
              </button>
            </form>
          </>
        ) : null}
      </div>
      {selectedCount > 0 ? (
        <span>
          {canChangeClientVisibility
            ? "Esta acao removera os arquivos selecionados do perfil do modelo."
            : "Documentos permanecem privados."}
        </span>
      ) : null}
    </div>
  );
}

function MediaCard({
  category,
  isEditing,
  isSelected,
  item,
  onOpen,
  onToggle,
  previewUrl
}: {
  category: MediaCategory;
  isEditing: boolean;
  isSelected: boolean;
  item: ModelMedia;
  onOpen: () => void;
  onToggle: () => void;
  previewUrl?: string;
}) {
  const hasPreview = Boolean(previewUrl);
  const showLabel = shouldShowMediaLabel(item);
  const canOpen = hasPreview || isDocumentMedia(item) || isVideoMedia(item);

  return (
    <article className={`media-card${isSelected ? " is-selected" : ""}`}>
      <button
        className="media-thumb"
        onClick={isEditing ? onToggle : canOpen ? onOpen : undefined}
        type="button"
      >
        {hasPreview ? (
          <img
            alt="Model media image"
            decoding="async"
            fetchPriority="low"
            loading="lazy"
            src={previewUrl}
          />
        ) : (
          <span className={`media-thumb-label ${item.media_type}`}>
            {mediaPlaceholder(category, item)}
          </span>
        )}
        {isEditing ? (
          <span className="media-select-indicator" aria-hidden="true">
            {isSelected ? "✓" : ""}
          </span>
        ) : null}
      </button>
      {showLabel ? (
        <div className="media-card-body">
          <strong>{mediaCardLabel(category, item)}</strong>
        </div>
      ) : null}
    </article>
  );
}

function Lightbox({
  items,
  modelId,
  onClose,
  onNext,
  onPrevious,
  previewUrls,
  selectedId
}: {
  items: ModelMedia[];
  modelId: string;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  previewUrls: Record<string, string>;
  selectedId: string;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const item = items.find((mediaItem) => mediaItem.id === selectedId);

  useEffect(() => {
    setIsMounted(true);
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    setOriginalUrl(null);

    if (!selectedId) {
      return () => {
        isActive = false;
      };
    }

    getModelMediaOriginalUrlAction(modelId, selectedId)
      .then((url) => {
        if (isActive) {
          setOriginalUrl(url);
        }
      })
      .catch(() => {
        if (isActive) {
          setOriginalUrl(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [modelId, selectedId]);

  if (!item) {
    return null;
  }

  const previewUrl = previewUrls[item.id];
  const viewerUrl = originalUrl || previewUrl;

  function handleClose() {
    videoRef.current?.pause();
    onClose();
  }

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div className="media-lightbox" role="dialog" aria-modal="true">
      <button className="media-lightbox-close" onClick={handleClose} type="button">
        X
      </button>
      <button className="media-lightbox-nav previous" onClick={onPrevious} type="button">
        Anterior
      </button>
      <figure>
        {isImageMedia(item) && viewerUrl ? (
          <img
            alt="Model media image"
            decoding="async"
            fetchPriority="high"
            src={viewerUrl}
          />
        ) : null}
        {isDocumentMedia(item) ? (
          <div className="media-lightbox-panel">
            {viewerUrl ? (
              <>
                <iframe
                  className="media-lightbox-frame"
                  src={viewerUrl}
                  title="Model media PDF"
                />
                <a
                  className="media-lightbox-link"
                  href={viewerUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Abrir PDF em nova aba
                </a>
              </>
            ) : (
              <p className="media-lightbox-loading">Preparando PDF...</p>
            )}
          </div>
        ) : null}
        {isVideoMedia(item) ? (
          <div className="media-lightbox-panel">
            {viewerUrl ? (
              <video
                className="media-lightbox-video"
                controls
                preload="metadata"
                ref={videoRef}
                src={viewerUrl}
              />
            ) : (
              <p className="media-lightbox-loading">Preparando video...</p>
            )}
          </div>
        ) : null}
      </figure>
      <button className="media-lightbox-nav next" onClick={onNext} type="button">
        Proxima
      </button>
    </div>,
    document.body
  );
}

function MediaCategorySection({
  category,
  editingCategory,
  items,
  modelId,
  previewUrls,
  selectedIds,
  setEditingCategory,
  setLightbox,
  toggleAllSelection,
  toggleSelection
}: {
  category: MediaCategory;
  editingCategory: string | null;
  items: ModelMedia[];
  modelId: string;
  previewUrls: Record<string, string>;
  selectedIds: string[];
  setEditingCategory: (categoryId: string | null) => void;
  setLightbox: (state: { categoryId: string; mediaId: string } | null) => void;
  toggleAllSelection: (categoryId: string, mediaIds: string[]) => void;
  toggleSelection: (categoryId: string, mediaId: string) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(initialVisibleMediaCount);
  const sortedItems = useMemo(() => sortMediaItems(items), [items]);
  const visibleItems = sortedItems.slice(0, visibleCount);
  const isEditing = editingCategory === category.id;
  const selectedItems = sortedItems.filter((item) => selectedIds.includes(item.id));
  const hiddenCount = Math.max(sortedItems.length - visibleItems.length, 0);

  return (
    <section className={`media-section${isEditing ? " is-editing" : ""}`}>
      <div className="media-section-header">
        <div>
          <div className="media-title-row">
            <h3>{category.title}</h3>
            <span>{sortedItems.length}</span>
          </div>
          <p>{category.description}</p>
        </div>
        <div className="media-section-tools">
          <UploadArea category={category} modelId={modelId} />
          {sortedItems.length > 0 ? (
            <button
              className="button secondary"
              onClick={() => setEditingCategory(isEditing ? null : category.id)}
              type="button"
            >
              {isEditing ? "Concluir" : "Editar"}
            </button>
          ) : null}
        </div>
      </div>
      {isEditing ? (
        <BatchActionBar
          modelId={modelId}
          onToggleAll={() =>
            toggleAllSelection(
              category.id,
              sortedItems.map((item) => item.id)
            )
          }
          selectedItems={selectedItems}
          totalCount={sortedItems.length}
        />
      ) : null}
      {sortedItems.length > 0 ? (
        <>
          <div className="media-gallery-grid">
            {visibleItems.map((item) => (
              <MediaCard
                category={category}
                isEditing={isEditing}
                isSelected={selectedIds.includes(item.id)}
                item={item}
                key={item.id}
                onOpen={() => setLightbox({ categoryId: category.id, mediaId: item.id })}
                onToggle={() => toggleSelection(category.id, item.id)}
                previewUrl={previewUrls[item.id]}
              />
            ))}
          </div>
          {hiddenCount > 0 ? (
            <button
              className="media-load-more"
              onClick={() =>
                setVisibleCount((current) => current + visibleMediaIncrement)
              }
              type="button"
            >
              Carregar mais {Math.min(hiddenCount, visibleMediaIncrement)}
            </button>
          ) : null}
        </>
      ) : (
        <div className="media-empty">
          <span>{mediaPlaceholder(category)}</span>
          <p>{category.emptyLabel}</p>
        </div>
      )}
    </section>
  );
}

export function ModelMediaGallery({ media, modelId }: ModelMediaGalleryProps) {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{
    categoryId: string;
    mediaId: string;
  } | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [selectedByCategory, setSelectedByCategory] = useState<
    Record<string, string[]>
  >({});

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, ModelMedia[]>();

    for (const item of media) {
      const categoryId = mediaCategoryIdFromItem(item);
      const items = map.get(categoryId) ?? [];
      items.push(item);
      map.set(categoryId, items);
    }

    return map;
  }, [media]);

  useEffect(() => {
    let isActive = true;

    getModelMediaPreviewUrlsAction(modelId)
      .then((urls) => {
        if (isActive) {
          setPreviewUrls(urls ?? {});
        }
      })
      .catch(() => {
        if (isActive) {
          setPreviewUrls({});
        }
      });

    return () => {
      isActive = false;
    };
  }, [modelId, media]);

  const lightboxCategory = lightbox
    ? mediaCategories.find((category) => category.id === lightbox.categoryId)
    : null;
  const lightboxItems = lightboxCategory
    ? sortMediaItems(itemsByCategory.get(lightboxCategory.id) ?? []).filter(
        (item) => canOpenInViewer(item, previewUrls)
      )
    : [];

  function moveLightbox(direction: 1 | -1) {
    if (!lightbox || lightboxItems.length === 0) {
      return;
    }

    const currentIndex = lightboxItems.findIndex(
      (item) => item.id === lightbox.mediaId
    );
    const nextIndex =
      (currentIndex + direction + lightboxItems.length) % lightboxItems.length;
    setLightbox({
      categoryId: lightbox.categoryId,
      mediaId: lightboxItems[nextIndex]?.id ?? lightbox.mediaId
    });
  }

  function toggleSelection(categoryId: string, mediaId: string) {
    setSelectedByCategory((current) => {
      const selected = current[categoryId] ?? [];
      const next = selected.includes(mediaId)
        ? selected.filter((id) => id !== mediaId)
        : [...selected, mediaId];

      return {
        ...current,
        [categoryId]: next
      };
    });
  }

  function toggleAllSelection(categoryId: string, mediaIds: string[]) {
    setSelectedByCategory((current) => {
      const selected = current[categoryId] ?? [];
      const allSelected =
        mediaIds.length > 0 && mediaIds.every((id) => selected.includes(id));

      return {
        ...current,
        [categoryId]: allSelected ? [] : mediaIds
      };
    });
  }

  return (
    <>
      <div className="media-hub">
        {mediaCategories.map((category) => (
          <MediaCategorySection
            category={category}
            editingCategory={editingCategory}
            items={itemsByCategory.get(category.id) ?? []}
            key={category.id}
            modelId={modelId}
            previewUrls={previewUrls}
            selectedIds={selectedByCategory[category.id] ?? []}
            setEditingCategory={setEditingCategory}
            setLightbox={setLightbox}
            toggleAllSelection={toggleAllSelection}
            toggleSelection={toggleSelection}
          />
        ))}
      </div>
      {lightbox ? (
        <Lightbox
          items={lightboxItems}
          modelId={modelId}
          onClose={() => setLightbox(null)}
          onNext={() => moveLightbox(1)}
          onPrevious={() => moveLightbox(-1)}
          previewUrls={previewUrls}
          selectedId={lightbox.mediaId}
        />
      ) : null}
      <style>{`
        .media-hub {
          display: grid;
          gap: 1rem;
        }

        .media-section {
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 1rem;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.42)),
            color-mix(in srgb, var(--surface) 94%, white);
        }

        .media-section.is-editing {
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
        }

        .media-section-header {
          align-items: flex-start;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .media-section-header p,
        .media-future-note,
        .media-batch-bar span {
          color: var(--muted);
          font-size: 0.82rem;
          margin: 0;
        }

        .media-title-row {
          align-items: center;
          display: flex;
          gap: 0.5rem;
        }

        .media-title-row h3 {
          font-size: 1rem;
          margin: 0;
        }

        .media-title-row span {
          border: 1px solid var(--line);
          border-radius: 999px;
          color: var(--muted);
          font-size: 0.75rem;
          line-height: 1;
          padding: 0.25rem 0.5rem;
        }

        .media-section-tools {
          align-items: flex-start;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          justify-content: flex-end;
        }

        .media-upload {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          justify-content: flex-end;
        }

        .media-upload-tile {
          align-items: center;
          backdrop-filter: blur(10px);
          border: 1px solid color-mix(in srgb, var(--line) 82%, white);
          border-radius: 8px;
          color: var(--foreground);
          cursor: pointer;
          display: inline-flex;
          font-size: 0.875rem;
          gap: 0.5rem;
          min-height: 40px;
          padding: 0.55rem 0.75rem;
        }

        .media-upload-icon {
          align-items: center;
          border: 1px solid var(--line);
          border-radius: 999px;
          display: inline-flex;
          height: 22px;
          justify-content: center;
          width: 22px;
        }

        .media-file-input {
          height: 1px;
          opacity: 0;
          overflow: hidden;
          position: absolute;
          width: 1px;
        }

        .media-upload-status {
          display: grid;
          gap: 0.1rem;
        }

        .media-upload-status span {
          color: var(--muted);
          font-size: 0.75rem;
        }

        .media-upload-progress {
          background: color-mix(in srgb, var(--line) 74%, transparent);
          border-radius: 999px;
          flex: 1 1 120px;
          height: 4px;
          min-width: 120px;
          overflow: hidden;
        }

        .media-upload-progress span {
          background: linear-gradient(90deg, rgba(79, 156, 255, 0.72), rgba(91, 213, 255, 0.78));
          border-radius: inherit;
          display: block;
          height: 100%;
          transition: width 180ms ease;
        }

        .media-upload-error,
        .media-upload-success {
          color: #b42318;
          flex-basis: 100%;
          font-size: 0.78rem;
          margin: 0;
        }

        .media-upload-success {
          color: #047857;
        }

        .media-upload-errors {
          display: grid;
          flex-basis: 100%;
          gap: 0.45rem;
        }

        .media-upload-error-item {
          align-items: center;
          background: color-mix(in srgb, #fee2e2 55%, transparent);
          border: 1px solid color-mix(in srgb, #ef4444 30%, var(--line));
          border-radius: 8px;
          display: flex;
          gap: 0.75rem;
          justify-content: space-between;
          padding: 0.55rem 0.65rem;
        }

        .media-upload-error-item div {
          display: grid;
          gap: 0.12rem;
          min-width: 0;
        }

        .media-upload-error-item strong,
        .media-upload-error-item span,
        .media-upload-error-item small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-upload-error-item strong {
          font-size: 0.78rem;
        }

        .media-upload-error-item span,
        .media-upload-error-item small {
          color: #991b1b;
          font-size: 0.72rem;
        }

        .media-retry-button {
          background: color-mix(in srgb, var(--surface) 92%, white);
          border: 1px solid var(--line);
          border-radius: 999px;
          color: var(--foreground);
          cursor: pointer;
          flex: 0 0 auto;
          font: inherit;
          font-size: 0.72rem;
          min-height: 30px;
          padding: 0.35rem 0.6rem;
        }

        .media-retry-button:disabled {
          cursor: not-allowed;
          opacity: 0.58;
        }

        .media-gallery-grid {
          display: grid;
          gap: 0.85rem;
          grid-template-columns: repeat(auto-fill, minmax(144px, 1fr));
        }

        .media-card {
          display: grid;
          gap: 0.6rem;
          min-width: 0;
        }

        .media-card.is-selected .media-thumb {
          outline: 2px solid var(--foreground);
          outline-offset: 2px;
        }

        .media-thumb {
          align-items: center;
          aspect-ratio: 2 / 3;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0.44)),
            color-mix(in srgb, var(--surface) 84%, var(--line));
          border: 1px solid var(--line);
          border-radius: 8px;
          color: var(--muted);
          cursor: pointer;
          display: flex;
          font: inherit;
          justify-content: center;
          overflow: hidden;
          padding: 0;
          position: relative;
          text-align: center;
          width: 100%;
        }

        .media-thumb img {
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .media-thumb-label {
          align-items: center;
          color: var(--muted);
          display: inline-flex;
          font-size: 0.78rem;
          justify-content: center;
          padding: 0.8rem;
        }

        .media-thumb-label.video::before {
          border-bottom: 7px solid transparent;
          border-left: 10px solid currentColor;
          border-top: 7px solid transparent;
          content: "";
          height: 0;
          margin-right: 0.45rem;
          width: 0;
        }

        .media-select-indicator {
          align-items: center;
          background: rgba(12, 26, 44, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.42);
          border-radius: 999px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.22);
          color: white;
          display: flex;
          font-size: 0.78rem;
          height: 24px;
          justify-content: center;
          position: absolute;
          right: 0.55rem;
          top: 0.55rem;
          width: 24px;
        }

        .media-card.is-selected .media-select-indicator {
          background: rgba(84, 211, 255, 0.92);
          border-color: rgba(255, 255, 255, 0.72);
          color: rgb(8, 20, 35);
          font-weight: 800;
        }

        .media-card:not(.is-selected) .media-select-indicator::after {
          border: 1px solid rgba(255, 255, 255, 0.7);
          border-radius: 999px;
          content: "";
          height: 8px;
          position: absolute;
          width: 8px;
        }

        .media-card-body {
          min-width: 0;
        }

        .media-card-body strong {
          display: block;
          font-size: 0.9rem;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-load-more {
          background: transparent;
          border: 1px solid var(--line);
          border-radius: 999px;
          color: var(--muted);
          cursor: pointer;
          display: block;
          font: inherit;
          font-size: 0.78rem;
          margin: 1rem auto 0;
          min-height: 34px;
          padding: 0.4rem 0.85rem;
        }

        .media-empty {
          align-items: center;
          border: 1px dashed var(--line);
          border-radius: 8px;
          color: var(--muted);
          display: flex;
          gap: 0.75rem;
          min-height: 86px;
          padding: 1rem;
        }

        .media-empty span {
          align-items: center;
          aspect-ratio: 2 / 3;
          border: 1px solid var(--line);
          border-radius: 6px;
          display: flex;
          font-size: 0.72rem;
          justify-content: center;
          width: 42px;
        }

        .media-empty p {
          margin: 0;
        }

        .media-batch-bar {
          align-items: center;
          backdrop-filter: blur(18px);
          background:
            linear-gradient(135deg, rgba(12, 26, 44, 0.92), rgba(20, 38, 61, 0.78)),
            rgba(16, 32, 52, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 8px;
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.16);
          color: rgba(255, 255, 255, 0.94);
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          justify-content: space-between;
          margin-bottom: 1rem;
          padding: 0.7rem 0.8rem;
        }

        .media-batch-bar strong {
          font-size: 0.82rem;
          font-weight: 650;
        }

        .media-batch-bar span {
          color: rgba(255, 255, 255, 0.58);
        }

        .media-batch-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .media-batch-actions form {
          min-width: 0;
        }

        .media-action-button {
          align-items: center;
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.13);
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 0.72rem;
          font-weight: 650;
          justify-content: center;
          letter-spacing: 0;
          min-height: 34px;
          padding: 0.42rem 0.7rem;
          transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
          white-space: nowrap;
        }

        .media-action-button:hover {
          transform: translateY(-1px);
        }

        .media-action-button.neutral {
          background: rgba(255, 255, 255, 0.09);
          color: rgba(255, 255, 255, 0.84);
        }

        .media-action-button.approve {
          background: rgba(61, 214, 140, 0.14);
          border-color: rgba(61, 214, 140, 0.28);
          color: rgba(205, 255, 231, 0.96);
        }

        .media-action-button.reject {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.68);
        }

        .media-action-button.danger {
          background: rgba(255, 99, 132, 0.12);
          border-color: rgba(255, 99, 132, 0.28);
          color: rgba(255, 220, 226, 0.96);
        }

        .media-lightbox {
          align-items: center;
          background: rgba(12, 14, 18, 0.88);
          display: flex;
          gap: 1rem;
          height: 100dvh;
          inset: 0;
          justify-content: center;
          overflow: hidden;
          padding: 2rem;
          position: fixed;
          width: 100vw;
          z-index: 1000;
        }

        .media-lightbox figure {
          align-items: center;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          justify-content: center;
          margin: 0;
          max-height: calc(100dvh - 4rem);
          max-width: min(82vw, 900px);
          min-width: 0;
        }

        .media-lightbox img {
          border-radius: 8px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
          display: block;
          max-height: calc(100dvh - 7rem);
          max-width: 100%;
          object-fit: contain;
        }

        .media-lightbox-panel {
          align-items: center;
          display: grid;
          gap: 0.75rem;
          justify-items: center;
          max-height: calc(100dvh - 7rem);
          max-width: min(82vw, 960px);
          width: min(82vw, 960px);
        }

        .media-lightbox-frame {
          background: white;
          border: 0;
          border-radius: 8px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
          height: min(78dvh, 760px);
          width: 100%;
        }

        .media-lightbox-video {
          background: black;
          border-radius: 8px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
          display: block;
          max-height: calc(100dvh - 7rem);
          max-width: 100%;
          width: min(82vw, 900px);
        }

        .media-lightbox-link,
        .media-lightbox-loading {
          color: white;
          font-size: 0.86rem;
          margin: 0;
        }

        .media-lightbox-close,
        .media-lightbox-nav {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.28);
          border-radius: 999px;
          color: white;
          cursor: pointer;
          min-height: 40px;
          padding: 0.5rem 0.8rem;
        }

        .media-lightbox-close {
          position: fixed;
          right: 1.2rem;
          top: 1.2rem;
        }

        .media-lightbox-nav {
          flex: 0 0 auto;
        }

        @media (max-width: 720px) {
          .media-section-header {
            display: grid;
          }

          .media-section-tools,
          .media-upload {
            justify-content: flex-start;
          }

          .media-gallery-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .media-lightbox {
            gap: 1rem;
            padding: 1rem;
          }

          .media-lightbox figure {
            max-width: 100%;
          }

          .media-lightbox img {
            max-height: calc(100dvh - 8rem);
          }

          .media-lightbox-nav {
            font-size: 0.78rem;
            min-height: 36px;
            padding: 0.4rem 0.6rem;
          }

        }
      `}</style>
    </>
  );
}

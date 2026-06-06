"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import type { MediaStatus, ModelMedia } from "@/types/database";
import {
  createModelMediaAction,
  deleteModelMediaBatchAction,
  downloadModelMediaAction,
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

const mediaCategories: MediaCategory[] = [
  {
    accept: "image/*",
    description: "Fotos profissionais do book do modelo.",
    emptyLabel: "Ainda sem materiais cadastrados",
    id: "book",
    mediaType: "portfolio",
    placeholder: "Imagem",
    title: "Book",
    uploadLabel: "Adicionar ao Book"
  },
  {
    accept: "image/*",
    description: "Digitals e polaroids para avaliacao rapida.",
    emptyLabel: "Ainda sem materiais cadastrados",
    id: "polaroids",
    mediaType: "polaroid",
    placeholder: "Imagem",
    title: "Polaroids",
    uploadLabel: "Adicionar Polaroids"
  },
  {
    description: "Cartao visual do modelo em imagem ou PDF.",
    emptyLabel: "Categoria preparada para proxima fase",
    id: "composite",
    placeholder: "Arquivo privado",
    title: "Composite"
  },
  {
    accept: "video/*",
    description: "Videos gerais do modelo.",
    emptyLabel: "Ainda sem materiais cadastrados",
    id: "videos",
    mediaType: "video",
    placeholder: "Video",
    title: "Videos",
    uploadLabel: "Adicionar Videos"
  },
  {
    description: "Registros de trabalhos ja realizados.",
    emptyLabel: "Categoria preparada para proxima fase",
    id: "work-videos",
    placeholder: "Video",
    title: "Work videos"
  },
  {
    description: "Apresentacoes em video para casting.",
    emptyLabel: "Categoria preparada para proxima fase",
    id: "video-casting",
    placeholder: "Video",
    title: "Video casting"
  },
  {
    accept: "application/pdf,image/*",
    description: "Documentos administrativos e privados.",
    emptyLabel: "Ainda sem materiais cadastrados",
    id: "documents",
    mediaType: "document",
    placeholder: "Documento",
    title: "Documentos",
    uploadLabel: "Adicionar Documentos"
  },
  {
    description: "Materiais recebidos de agencias parceiras.",
    emptyLabel: "Categoria preparada para proxima fase",
    id: "mother-agency",
    placeholder: "Arquivo privado",
    title: "Materiais de agencia mae"
  },
  {
    description: "Pacotes e selecoes preparados para clientes.",
    emptyLabel: "Categoria preparada para proxima fase",
    id: "client-materials",
    placeholder: "Arquivo privado",
    title: "Materiais para cliente"
  }
];

function mediaTitle(item: ModelMedia) {
  return item.title?.trim() || item.storage_path.split("/").pop() || "-";
}

function mediaPlaceholder(category: MediaCategory, item?: ModelMedia) {
  if (item?.media_type === "document") {
    return item.storage_path.toLowerCase().endsWith(".pdf")
      ? "PDF"
      : "Documento";
  }

  return category.placeholder;
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

function UploadSubmitButton({ hasFiles }: { hasFiles: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button className="button secondary" disabled={!hasFiles || pending} type="submit">
      {pending ? "Enviando..." : "Enviar selecionados"}
    </button>
  );
}

function UploadArea({
  category,
  modelId
}: {
  category: MediaCategory;
  modelId: string;
}) {
  const [fileCount, setFileCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!category.mediaType || !category.accept || !category.uploadLabel) {
    return (
      <p className="media-future-note">Ainda sem suporte de upload nesta fase</p>
    );
  }

  return (
    <form
      action={createModelMediaAction.bind(null, modelId)}
      className="media-upload"
      encType="multipart/form-data"
      onSubmit={() => setIsSubmitting(true)}
    >
      <input name="media_category" type="hidden" value={category.id} />
      <input name="media_type" type="hidden" value={category.mediaType} />
      <input name="media_status" type="hidden" value="pending_review" />
      <input name="media_visibility" type="hidden" value="private" />
      <label className="media-upload-tile">
        <input
          accept={category.accept}
          className="media-file-input"
          multiple
          name="files"
          onChange={(event) => setFileCount(event.currentTarget.files?.length ?? 0)}
          required
          type="file"
        />
        <span className="media-upload-icon">+</span>
        <span>{category.uploadLabel}</span>
      </label>
      <div className="media-upload-status">
        <span>
          {fileCount > 0
            ? `${fileCount} arquivo${fileCount > 1 ? "s" : ""} selecionado${fileCount > 1 ? "s" : ""}`
            : "Selecione arquivos"}
        </span>
        {isSubmitting ? <span>Enviando arquivos...</span> : null}
      </div>
      <UploadSubmitButton hasFiles={fileCount > 0} />
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
    selectedCount === 1 && singleSelected?.media_type === "portfolio";
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

  return (
    <article className={`media-card${isSelected ? " is-selected" : ""}`}>
      <button
        className="media-thumb"
        onClick={isEditing ? onToggle : hasPreview ? onOpen : undefined}
        type="button"
      >
        {hasPreview ? (
          <img alt={mediaTitle(item)} src={previewUrl} />
        ) : (
          <span>{mediaPlaceholder(category, item)}</span>
        )}
        {isEditing ? (
          <span className="media-select-indicator" aria-hidden="true">
            {isSelected ? "✓" : ""}
          </span>
        ) : null}
      </button>
      <div className="media-card-body">
        <strong>{mediaTitle(item)}</strong>
      </div>
    </article>
  );
}

function Lightbox({
  items,
  onClose,
  onNext,
  onPrevious,
  previewUrls,
  selectedId
}: {
  items: ModelMedia[];
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  previewUrls: Record<string, string>;
  selectedId: string;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const item = items.find((mediaItem) => mediaItem.id === selectedId);

  useEffect(() => {
    setIsMounted(true);
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!item) {
    return null;
  }

  const previewUrl = previewUrls[item.id];

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div className="media-lightbox" role="dialog" aria-modal="true">
      <button className="media-lightbox-close" onClick={onClose} type="button">
        X
      </button>
      <button className="media-lightbox-nav previous" onClick={onPrevious} type="button">
        Anterior
      </button>
      <figure>
        {previewUrl ? <img alt={mediaTitle(item)} src={previewUrl} /> : null}
        <figcaption>{mediaTitle(item)}</figcaption>
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
  const sortedItems = sortMediaItems(items);
  const isEditing = editingCategory === category.id;
  const selectedItems = sortedItems.filter((item) => selectedIds.includes(item.id));

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
        <div className="media-gallery-grid">
          {sortedItems.map((item) => (
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

  const itemsByType = useMemo(() => {
    const map = new Map<ModelMedia["media_type"], ModelMedia[]>();

    for (const item of media) {
      const items = map.get(item.media_type) ?? [];
      items.push(item);
      map.set(item.media_type, items);
    }

    return map;
  }, [media]);

  useEffect(() => {
    let isActive = true;

    getModelMediaPreviewUrlsAction(modelId)
      .then((urls) => {
        if (isActive) {
          setPreviewUrls(urls);
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
  const lightboxItems = lightboxCategory?.mediaType
    ? sortMediaItems(itemsByType.get(lightboxCategory.mediaType) ?? []).filter(
        (item) => previewUrls[item.id]
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
            items={category.mediaType ? itemsByType.get(category.mediaType) ?? [] : []}
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

        .media-lightbox figcaption {
          color: white;
          font-size: 0.9rem;
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

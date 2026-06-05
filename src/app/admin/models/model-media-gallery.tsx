"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { MediaStatus, ModelMedia } from "@/types/database";
import {
  createModelMediaAction,
  deleteModelMediaAction,
  downloadModelMediaAction,
  getModelMediaPreviewUrlsAction,
  updateModelMediaBatchStatusAction,
  updateModelMediaBatchVisibilityAction,
  updateModelMediaStatusAction,
  updateModelMediaTitleAction,
  updateModelMediaVisibilityAction
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

function mediaDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  }).format(new Date(value));
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
  selectedItems
}: {
  modelId: string;
  selectedItems: ModelMedia[];
}) {
  const selectedIds = selectedItems.map((item) => item.id);
  const selectedCount = selectedItems.length;
  const singleSelected = selectedItems[0];
  const canChangeClientVisibility = selectedItems.every(
    (item) => item.media_type !== "document"
  );

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="media-batch-bar">
      <strong>
        {selectedCount} selecionado{selectedCount > 1 ? "s" : ""}
      </strong>
      <div className="media-batch-actions">
        {singleSelected && selectedCount === 1 ? (
          <form action={downloadModelMediaAction.bind(null, modelId, singleSelected.id)}>
            <button className="button secondary" type="submit">
              Abrir/Baixar
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
          <button className="button secondary" type="submit">
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
          <button className="button secondary" type="submit">
            Rejeitar
          </button>
        </form>
        {canChangeClientVisibility ? (
          <form action={updateModelMediaBatchVisibilityAction.bind(null, modelId)}>
            <SelectedInputs ids={selectedIds} />
            <input name="media_visibility" type="hidden" value="client_only" />
            <button className="button secondary" type="submit">
              Visivel para cliente
            </button>
          </form>
        ) : null}
        <form action={updateModelMediaBatchVisibilityAction.bind(null, modelId)}>
          <SelectedInputs ids={selectedIds} />
          <input name="media_visibility" type="hidden" value="private" />
          <button className="button secondary" type="submit">
            Tornar privado
          </button>
        </form>
      </div>
      {!canChangeClientVisibility ? (
        <span>Documentos permanecem privados.</span>
      ) : null}
    </div>
  );
}

function MediaCard({
  category,
  isEditing,
  isSelected,
  item,
  modelId,
  onOpen,
  onToggle,
  previewUrl
}: {
  category: MediaCategory;
  isEditing: boolean;
  isSelected: boolean;
  item: ModelMedia;
  modelId: string;
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
          <span className="media-select-indicator">{isSelected ? "Selecionado" : "Selecionar"}</span>
        ) : null}
      </button>
      <div className="media-card-body">
        <strong>{mediaTitle(item)}</strong>
        <div className="media-meta">
          <span>{item.status}</span>
          <span>{item.visibility}</span>
          <span>{mediaDate(item.created_at)}</span>
        </div>
      </div>
      {isEditing ? (
        <div className="media-card-editor">
          <form
            action={updateModelMediaTitleAction.bind(null, modelId, item.id)}
            className="media-inline-form"
          >
            <input
              aria-label="Titulo da midia"
              defaultValue={item.title ?? ""}
              maxLength={120}
              name="title"
              placeholder="Titulo"
            />
            <button className="button secondary" type="submit">
              Salvar
            </button>
          </form>
          {item.media_type === "document" ? (
            <p className="media-private-note">Documento privado</p>
          ) : (
            <form
              action={updateModelMediaVisibilityAction.bind(null, modelId, item.id)}
              className="media-inline-form"
            >
              <select
                aria-label="Visibilidade"
                defaultValue={item.visibility}
                name="media_visibility"
              >
                <option value="private">private</option>
                <option value="client_only">client_only</option>
                <option value="public">public</option>
              </select>
              <button className="button secondary" type="submit">
                Salvar
              </button>
            </form>
          )}
          <div className="media-card-actions">
            <form action={downloadModelMediaAction.bind(null, modelId, item.id)}>
              <button className="button secondary" type="submit">
                Abrir/Baixar
              </button>
            </form>
            <form
              action={updateModelMediaStatusAction.bind(
                null,
                modelId,
                item.id,
                "approved"
              )}
            >
              <button className="button secondary" type="submit">
                Aprovar
              </button>
            </form>
            <form
              action={updateModelMediaStatusAction.bind(
                null,
                modelId,
                item.id,
                "rejected"
              )}
            >
              <button className="button secondary" type="submit">
                Rejeitar
              </button>
            </form>
            <form action={deleteModelMediaAction.bind(null, modelId, item.id)}>
              <button className="button danger" type="submit">
                Excluir permanentemente
              </button>
            </form>
          </div>
        </div>
      ) : null}
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
  const item = items.find((mediaItem) => mediaItem.id === selectedId);

  if (!item) {
    return null;
  }

  const previewUrl = previewUrls[item.id];

  return (
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
    </div>
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
        <BatchActionBar modelId={modelId} selectedItems={selectedItems} />
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
              modelId={modelId}
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
        .media-private-note,
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
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid var(--line);
          border-radius: 999px;
          bottom: 0.5rem;
          color: var(--foreground);
          font-size: 0.72rem;
          left: 50%;
          padding: 0.25rem 0.5rem;
          position: absolute;
          transform: translateX(-50%);
          white-space: nowrap;
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

        .media-meta {
          color: var(--muted);
          display: flex;
          flex-wrap: wrap;
          font-size: 0.7rem;
          gap: 0.3rem;
          margin-top: 0.2rem;
        }

        .media-meta span {
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 0.1rem 0.36rem;
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
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid var(--line);
          border-radius: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          justify-content: space-between;
          margin-bottom: 1rem;
          padding: 0.65rem;
        }

        .media-batch-actions,
        .media-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .media-card-editor {
          display: grid;
          gap: 0.5rem;
        }

        .media-inline-form {
          display: flex;
          gap: 0.35rem;
        }

        .media-inline-form input,
        .media-inline-form select {
          min-height: 34px;
          min-width: 0;
        }

        .media-card-actions .button,
        .media-inline-form .button,
        .media-batch-actions .button {
          font-size: 0.76rem;
          min-height: 34px;
          padding: 0.4rem 0.55rem;
        }

        .media-lightbox {
          align-items: center;
          background: rgba(12, 14, 18, 0.86);
          bottom: 0;
          display: grid;
          grid-template-columns: minmax(90px, 1fr) minmax(240px, 820px) minmax(90px, 1fr);
          inset: 0;
          justify-items: center;
          padding: 2rem;
          position: fixed;
          z-index: 60;
        }

        .media-lightbox figure {
          display: grid;
          gap: 0.75rem;
          margin: 0;
          max-height: 92vh;
          place-items: center;
        }

        .media-lightbox img {
          border-radius: 8px;
          max-height: 86vh;
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
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .media-lightbox-nav.previous,
          .media-lightbox-nav.next {
            position: static;
          }
        }
      `}</style>
    </>
  );
}

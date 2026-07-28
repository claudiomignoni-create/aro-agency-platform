"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicPresentationDecision } from "@/lib/communications/data";
import {
  groupPresentationMedia,
  normalizeInstagramUrl
} from "@/lib/communications/public-presentation";
import { ModelDecisionControl } from "@/components/public-presentation/model-decision-control";
import type {
  PublicPresentationMedia,
  PublicPresentationModel
} from "@/components/public-presentation/types";

export type PublicModelTab = "book" | "digitals" | "downloads" | "overview" | "video";

const tabs: Array<{ id: PublicModelTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "book", label: "Book" },
  { id: "digitals", label: "Digitals" },
  { id: "video", label: "Video" },
  { id: "downloads", label: "PDF & Downloads" }
];

function modelKey(model: PublicPresentationModel, index: number) {
  return model.public_model_key ?? `model-${index}`;
}

function measurementValue(value: number | string | null | undefined, unit = "") {
  if (value === null || value === undefined || value === "") return null;
  return `${value}${unit}`;
}

function measurementRows(model: PublicPresentationModel) {
  const measurements = model.measurements ?? {};
  const gender = String(model.gender ?? "").trim().toLowerCase();
  const isMale = ["male", "masculino", "homem", "man"].includes(gender);
  const shoeVariants = [
    measurements.shoe_size_br ? `${measurements.shoe_size_br} BR` : null,
    measurements.shoe_size_eu ? `${measurements.shoe_size_eu} EU` : null,
    measurements.shoe_size_us ? `${measurements.shoe_size_us} US` : null
  ].filter(Boolean);
  const dressVariants = [
    measurements.dress_size_br ? `${measurements.dress_size_br} BR` : null,
    measurements.dress_size_eu ? `${measurements.dress_size_eu} EU` : null,
    measurements.dress_size_us ? `${measurements.dress_size_us} US` : null
  ].filter(Boolean);

  return [
    { label: "Height", value: measurementValue(measurements.height_cm, " cm") },
    { label: isMale ? "Chest" : "Bust", value: measurementValue(measurements.bust_cm, " cm") },
    { label: "Waist", value: measurementValue(measurements.waist_cm, " cm") },
    { label: "Hips", value: measurementValue(measurements.hips_cm, " cm") },
    {
      label: "Dress",
      value: dressVariants.length ? dressVariants.join(" / ") : null
    },
    {
      label: "Shoes",
      value: shoeVariants.length
        ? shoeVariants.join(" / ")
        : measurementValue(measurements.shoe_size)
    },
    { label: "Hair", value: model.hair_color ?? null },
    { label: "Eyes", value: model.eye_color ?? null }
  ].filter((row) => row.value);
}

function Gallery({
  emptyText,
  media,
  modelName
}: {
  emptyText: string;
  media: PublicPresentationMedia[];
  modelName: string;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lightboxIndex !== null && !dialog.open) dialog.showModal();
    if (lightboxIndex === null && dialog.open) dialog.close();
  }, [lightboxIndex]);

  function move(delta: number) {
    setLightboxIndex((current) => {
      if (current === null || !media.length) return current;
      return (current + delta + media.length) % media.length;
    });
  }

  if (!media.length) return <EmptySection text={emptyText} />;

  const currentMedia = lightboxIndex === null ? null : media[lightboxIndex];

  return (
    <>
      <div className="aro-public-editorial-gallery">
        {media.map((item, index) =>
          item.signed_url ? (
            <button
              aria-label={`Open ${item.title || `${modelName} image ${index + 1}`}`}
              key={item.public_media_key ?? `${item.signed_url}-${index}`}
              onClick={() => setLightboxIndex(index)}
              type="button"
            >
              <img
                alt={item.title || `${modelName}, image ${index + 1}`}
                decoding="async"
                loading="lazy"
                src={item.signed_url}
              />
              {item.title ? <span>{item.title}</span> : null}
            </button>
          ) : null
        )}
      </div>

      <dialog
        aria-label={`${modelName} image viewer`}
        className="aro-public-lightbox"
        onCancel={(event) => {
          event.preventDefault();
          setLightboxIndex(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") move(-1);
          if (event.key === "ArrowRight") move(1);
        }}
        onTouchEnd={(event) => {
          if (touchStart.current === null) return;
          const distance = event.changedTouches[0].clientX - touchStart.current;
          if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1);
          touchStart.current = null;
        }}
        onTouchStart={(event) => {
          touchStart.current = event.touches[0].clientX;
        }}
        ref={dialogRef}
      >
        <button aria-label="Close image viewer" className="aro-public-lightbox-close" onClick={() => setLightboxIndex(null)} type="button">
          ×
        </button>
        {currentMedia?.source_url || currentMedia?.signed_url ? (
          <img
            alt={currentMedia.title || `${modelName}, full image`}
            src={currentMedia.source_url || currentMedia.signed_url || ""}
          />
        ) : null}
        {currentMedia?.title ? <p>{currentMedia.title}</p> : null}
        {media.length > 1 ? (
          <div className="aro-public-lightbox-nav">
            <button onClick={() => move(-1)} type="button">
              Previous
            </button>
            <span>
              {(lightboxIndex ?? 0) + 1} / {media.length}
            </span>
            <button onClick={() => move(1)} type="button">
              Next
            </button>
          </div>
        ) : null}
      </dialog>
    </>
  );
}

function EmptySection({ text }: { text: string }) {
  return (
    <div className="aro-public-empty-section">
      <span aria-hidden="true">ARO</span>
      <p>{text}</p>
    </div>
  );
}

function Overview({
  decision,
  decisionDisabled,
  model,
  onDecision
}: {
  decision?: PublicPresentationDecision;
  decisionDisabled: boolean;
  model: PublicPresentationModel;
  onDecision: (decision: PublicPresentationDecision) => void;
}) {
  const grouped = groupPresentationMedia(model.media);
  const cover =
    grouped.book.find((item) => item.signed_url) ??
    grouped.digitals.find((item) => item.signed_url) ??
    model.media.find((item) => item.signed_url);
  const rows = measurementRows(model);
  const instagramUrl = normalizeInstagramUrl(model.instagram);
  const categories = model.categories?.length ? model.categories : model.board ? [model.board] : [];

  return (
    <section className="aro-public-overview" aria-label={`${model.display_name} overview`}>
      <div className="aro-public-overview-copy">
        <p className="aro-public-eyebrow">{categories.join(" · ") || "ARO model"}</p>
        <h2>{model.display_name}</h2>
        <p className="aro-public-model-location">
          {[model.city, model.country].filter(Boolean).join(", ") || model.nationality || "ARO"}
        </p>

        {rows.length ? (
          <dl className="aro-public-measurements">
            {rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="aro-public-muted">Measurements were not included in this presentation.</p>
        )}

        {model.nationality ? (
          <div className="aro-public-model-meta">
            <span>Nationality</span>
            <strong>{model.nationality}</strong>
          </div>
        ) : null}

        {instagramUrl ? (
          <a className="aro-public-instagram" href={instagramUrl} rel="noreferrer" target="_blank">
            Instagram
            <span>{model.instagram}</span>
          </a>
        ) : null}

        <div className="aro-public-desktop-decision">
          <span className="aro-public-control-label">Your decision</span>
          <ModelDecisionControl decision={decision} disabled={decisionDisabled} onChange={onDecision} />
        </div>
      </div>

      <div className="aro-public-cover">
        {cover?.signed_url ? (
          <img alt={`${model.display_name} cover`} fetchPriority="high" src={cover.signed_url} />
        ) : (
          <div className="aro-public-cover-placeholder">
            <span>{model.display_name.slice(0, 2).toUpperCase()}</span>
            <small>Image not included</small>
          </div>
        )}
        <span className="aro-public-cover-index">ARO / {model.display_name}</span>
      </div>
    </section>
  );
}

function Videos({ media, modelName }: { media: PublicPresentationMedia[]; modelName: string }) {
  if (!media.length) return <EmptySection text="No videos were included for this model." />;

  return (
    <div className="aro-public-video-list">
      {media.map((item, index) => (
        <article key={item.public_media_key ?? `${modelName}-video-${index}`}>
          {item.source_url ? (
            <video
              controls
              playsInline
              poster={item.thumbnail_url || item.signed_url || undefined}
              preload="metadata"
              title={item.title || `${modelName} video ${index + 1}`}
            >
              <source src={item.source_url} />
            </video>
          ) : (
            <div className="aro-public-video-placeholder">Video unavailable</div>
          )}
          <div>
            <span>Video {String(index + 1).padStart(2, "0")}</span>
            <h3>{item.title || `${modelName} video`}</h3>
          </div>
        </article>
      ))}
    </div>
  );
}

function Downloads({
  allowDownloads,
  media
}: {
  allowDownloads: boolean;
  media: PublicPresentationMedia[];
}) {
  if (!allowDownloads) {
    return <EmptySection text="Downloads are not enabled for this presentation." />;
  }
  if (!media.length) return <EmptySection text="No downloadable materials were included for this model." />;

  return (
    <div className="aro-public-download-list">
      {media.map((item, index) => (
        <article key={item.public_media_key ?? `document-${index}`}>
          <div>
            <span>{item.media_type === "document" ? "Document" : "Material"}</span>
            <h3>{item.title || `ARO material ${String(index + 1).padStart(2, "0")}`}</h3>
            <p>Private file · size not provided</p>
          </div>
          {item.download_href ? (
            <div>
              <a href={item.download_href} rel="noreferrer" target="_blank">
                View
              </a>
              <a href={item.download_href}>Download</a>
            </div>
          ) : (
            <span>Unavailable</span>
          )}
        </article>
      ))}
    </div>
  );
}

export function PublicModelContent({
  activeIndex,
  activeTab,
  allowDownloads,
  decisionDisabled,
  decisions,
  models,
  onDecision,
  onModelChange,
  onTabChange
}: {
  activeIndex: number;
  activeTab: PublicModelTab;
  allowDownloads: boolean;
  decisionDisabled: boolean;
  decisions: Record<string, PublicPresentationDecision>;
  models: PublicPresentationModel[];
  onDecision: (decision: PublicPresentationDecision) => void;
  onModelChange: (index: number) => void;
  onTabChange: (tab: PublicModelTab) => void;
}) {
  const model = models[activeIndex];
  const grouped = useMemo(() => groupPresentationMedia(model?.media ?? []), [model]);

  if (!model) return <EmptySection text="No models were included in this presentation." />;

  const key = model.public_model_key;
  const decision = key ? decisions[key] : undefined;

  return (
    <div className="aro-public-model-area">
      <nav aria-label="Models in this presentation" className="aro-public-model-navigator">
        <div className="aro-public-model-navigator-track">
          {models.map((item, index) => {
            const itemKey = modelKey(item, index);
            const itemDecision = item.public_model_key ? decisions[item.public_model_key] : undefined;
            const thumbnail = item.media.find((mediaItem) => mediaItem.thumbnail_url || mediaItem.signed_url);
            return (
              <button
                aria-current={index === activeIndex ? "true" : undefined}
                className={index === activeIndex ? "active" : ""}
                key={itemKey}
                onClick={() => onModelChange(index)}
                type="button"
              >
                {thumbnail?.thumbnail_url || thumbnail?.signed_url ? (
                  <img
                    alt=""
                    loading="lazy"
                    src={thumbnail.thumbnail_url || thumbnail.signed_url || ""}
                  />
                ) : (
                  <span className="aro-public-navigator-initials">
                    {item.display_name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span>
                  <small>{String(index + 1).padStart(2, "0")}</small>
                  <strong>{item.display_name}</strong>
                </span>
                {itemDecision ? <em className={itemDecision}>{itemDecision}</em> : null}
              </button>
            );
          })}
        </div>
        <div className="aro-public-model-arrows">
          <button
            aria-label="Previous model"
            disabled={activeIndex === 0}
            onClick={() => onModelChange(Math.max(0, activeIndex - 1))}
            type="button"
          >
            Previous
          </button>
          <span>
            {activeIndex + 1} / {models.length}
          </span>
          <button
            aria-label="Next model"
            disabled={activeIndex === models.length - 1}
            onClick={() => onModelChange(Math.min(models.length - 1, activeIndex + 1))}
            type="button"
          >
            Next
          </button>
        </div>
      </nav>

      <nav aria-label={`${model.display_name} sections`} className="aro-public-tabs">
        {tabs.map((tab) => (
          <button
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={activeTab === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="aro-public-tab-content">
        {activeTab === "overview" ? (
          <Overview
            decision={decision}
            decisionDisabled={decisionDisabled || !key}
            model={model}
            onDecision={onDecision}
          />
        ) : null}
        {activeTab === "book" ? (
          <Gallery emptyText="No Book images were included for this model." media={grouped.book} modelName={model.display_name} />
        ) : null}
        {activeTab === "digitals" ? (
          <Gallery
            emptyText="No Digitals were included for this model."
            media={grouped.digitals}
            modelName={model.display_name}
          />
        ) : null}
        {activeTab === "video" ? <Videos media={grouped.videos} modelName={model.display_name} /> : null}
        {activeTab === "downloads" ? (
          <Downloads allowDownloads={allowDownloads} media={grouped.documents} />
        ) : null}
      </div>

      <div className="aro-public-mobile-decision">
        <span>
          <small>Your decision</small>
          <strong>{model.display_name}</strong>
        </span>
        <ModelDecisionControl
          decision={decision}
          disabled={decisionDisabled || !key}
          onChange={onDecision}
        />
      </div>
    </div>
  );
}

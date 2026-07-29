"use client";

import Image from "next/image";
import { useState } from "react";
import type { PublicPresentationDecision, PublicPresentationPayload } from "@/lib/communications/data";
import { presentationSelectionCounts } from "@/lib/communications/public-presentation";

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo"
  }).format(date);
}

export function PresentationSidebar({
  decisions,
  note,
  onNoteChange,
  onSubmit,
  presentation,
  recipientName,
  schemaReady,
  submittedAt,
  submitting
}: {
  decisions: Record<string, PublicPresentationDecision>;
  note: string;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
  presentation: PublicPresentationPayload;
  recipientName: string | null;
  schemaReady: boolean;
  submittedAt: string | null;
  submitting: boolean;
}) {
  const modelKeys = (presentation.snapshot.models ?? []).map((model) => model.public_model_key);
  const counts = presentationSelectionCounts(decisions, modelKeys);
  const sender = presentation.snapshot.contact;
  const expiresAt = formatDate(presentation.link?.expires_at);
  const publishedAt = formatDate(presentation.published_at);
  const hasDecision = counts.yes + counts.maybe + counts.no > 0;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <aside className="aro-public-sidebar">
      <div className="aro-public-sidebar-details">
        <button
          aria-controls="aro-public-sidebar-body"
          aria-expanded={mobileOpen}
          className="aro-public-sidebar-toggle"
          onClick={() => setMobileOpen((current) => !current)}
          type="button"
        >
          <span>Presentation details</span>
          <span aria-hidden="true">+</span>
        </button>
        <div
          className={`aro-public-sidebar-body${mobileOpen ? " mobile-open" : ""}`}
          id="aro-public-sidebar-body"
        >
          <header className="aro-public-brand">
            <Image alt="ARO" height={54} priority src="/brand/aro-mark.png" width={54} />
            <div>
              <strong>ARO</strong>
              <span>Private presentation</span>
            </div>
          </header>

          <section className="aro-public-sidebar-intro">
            <p className="aro-public-eyebrow">{publishedAt ?? "Private selection"}</p>
            <h1>{presentation.title}</h1>
            {recipientName ? <p className="aro-public-recipient">Prepared for {recipientName}</p> : null}
          </section>

          {presentation.description ? (
            <section className="aro-public-message" aria-label="Message from ARO">
              <h2>Message from ARO</h2>
              <p>{presentation.description}</p>
            </section>
          ) : null}

          <section className="aro-public-selection-summary" aria-live="polite">
            <div className="aro-public-sidebar-section-heading">
              <h2>Your selection</h2>
              <span>{modelKeys.length} models</span>
            </div>
            <dl>
              <div className="yes">
                <dt>Yes</dt>
                <dd>{counts.yes}</dd>
              </div>
              <div className="maybe">
                <dt>Maybe</dt>
                <dd>{counts.maybe}</dd>
              </div>
              <div className="no">
                <dt>No</dt>
                <dd>{counts.no}</dd>
              </div>
              <div>
                <dt>Open</dt>
                <dd>{counts.undecided}</dd>
              </div>
            </dl>
          </section>

          <label className="aro-public-note">
            <span>Add a note for ARO</span>
            <textarea
              disabled={!schemaReady}
              maxLength={2000}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Optional"
              rows={3}
              value={note}
            />
            <small>{note.length}/2000</small>
          </label>

          {!schemaReady ? (
            <p className="aro-public-schema-note" role="status">
              Selection tools will be available after the presentation database update.
            </p>
          ) : null}

          {submittedAt ? (
            <p className="aro-public-submitted-note">
              Selection sent {formatDate(submittedAt)}. You can revise it while this link remains active.
            </p>
          ) : null}

          <button
            className="aro-public-submit-button"
            disabled={!schemaReady || !hasDecision || submitting}
            onClick={onSubmit}
            type="button"
          >
            {submitting ? "Sending..." : submittedAt ? "Review updated selection" : "Send my selection"}
          </button>

          <footer className="aro-public-sidebar-footer">
            <div>
              <span>Link status</span>
              <strong>Active</strong>
            </div>
            {expiresAt ? (
              <div>
                <span>Valid until</span>
                <strong>{expiresAt}</strong>
              </div>
            ) : null}
            {sender?.name ? (
              <div>
                <span>Sent by</span>
                <strong>{sender.name}</strong>
              </div>
            ) : null}
            {sender?.website ? (
              <a href={sender.website.startsWith("http") ? sender.website : `https://${sender.website}`}>
                {sender.website}
              </a>
            ) : null}
          </footer>
        </div>
      </div>
    </aside>
  );
}

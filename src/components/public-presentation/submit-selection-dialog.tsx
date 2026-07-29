"use client";

import { useEffect, useRef } from "react";
import type { PublicPresentationDecision } from "@/lib/communications/data";
import { presentationSelectionCounts } from "@/lib/communications/public-presentation";
import type { PublicPresentationModel } from "@/components/public-presentation/types";

export function SubmitSelectionDialog({
  decisions,
  error,
  models,
  note,
  onClose,
  onConfirm,
  open,
  submittedAt,
  submitting
}: {
  decisions: Record<string, PublicPresentationDecision>;
  error: string | null;
  models: PublicPresentationModel[];
  note: string;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
  submittedAt: string | null;
  submitting: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const counts = presentationSelectionCounts(
    decisions,
    models.map((model) => model.public_model_key)
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      aria-labelledby="selection-dialog-title"
      className="aro-public-submit-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting) onClose();
      }}
      ref={dialogRef}
    >
      <button aria-label="Close selection review" className="aro-public-dialog-close" onClick={onClose} type="button">
        ×
      </button>

      {submittedAt ? (
        <div className="aro-public-confirmation" role="status">
          <span aria-hidden="true">✓</span>
          <p>Selection received</p>
          <h2 id="selection-dialog-title">Thank you.</h2>
          <p>Your choices are now available to the ARO team.</p>
          <button className="aro-public-submit-button" onClick={onClose} type="button">
            Return to presentation
          </button>
        </div>
      ) : (
        <>
          <p className="aro-public-eyebrow">Final review</p>
          <h2 id="selection-dialog-title">Send your selection?</h2>
          <p className="aro-public-dialog-copy">
            Review the decisions below. You can still update them later while this private link is active.
          </p>

          <dl className="aro-public-review-counts">
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

          <div className="aro-public-review-list">
            {models.map((model, index) => {
              const decision = model.public_model_key ? decisions[model.public_model_key] : undefined;
              return (
                <div key={model.public_model_key ?? `${model.display_name}-${index}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{model.display_name}</strong>
                  <em className={decision ?? "undecided"}>{decision ?? "Open"}</em>
                </div>
              );
            })}
          </div>

          {note ? (
            <div className="aro-public-review-note">
              <span>Note for ARO</span>
              <p>{note}</p>
            </div>
          ) : null}

          {error ? (
            <p className="aro-public-form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="aro-public-dialog-actions">
            <button className="aro-public-secondary-button" disabled={submitting} onClick={onClose} type="button">
              Continue reviewing
            </button>
            <button className="aro-public-submit-button" disabled={submitting} onClick={onConfirm} type="button">
              {submitting ? "Sending..." : "Confirm and send"}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}

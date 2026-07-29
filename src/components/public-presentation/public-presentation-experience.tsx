"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PublicPresentationDecision,
  PublicPresentationLinkStatus
} from "@/lib/communications/data";
import { withPresentationDecision } from "@/lib/communications/public-presentation";
import { PresentationSidebar } from "@/components/public-presentation/presentation-sidebar";
import {
  PublicModelContent,
  type PublicModelTab
} from "@/components/public-presentation/public-model-content";
import { SubmitSelectionDialog } from "@/components/public-presentation/submit-selection-dialog";
import type { PublicPresentationExperienceProps } from "@/components/public-presentation/types";

function publicApiPath(segment: string) {
  return `${window.location.pathname.replace(/\/$/, "")}/${segment}`;
}

async function postJson<T>(segment: string, body: Record<string, unknown>) {
  const response = await fetch(publicApiPath(segment), {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string; result?: T };
  if (!response.ok || !payload.result) throw new Error(payload.error || "The request could not be completed.");
  return payload.result;
}

export function PublicPresentationExperience({
  initialDecisions,
  initialNote,
  linkState,
  models,
  presentation
}: PublicPresentationExperienceProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<PublicModelTab>("overview");
  const [decisions, setDecisions] = useState(initialDecisions);
  const [note, setNote] = useState(initialNote);
  const [pendingModelKey, setPendingModelKey] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmittedAt, setLastSubmittedAt] = useState(linkState.selection.submitted_at);
  const [confirmationAt, setConfirmationAt] = useState<string | null>(null);
  const activeModel = models[activeIndex];

  const selectModel = useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, Math.min(models.length - 1, index));
      setActiveIndex(nextIndex);
      setActiveTab("overview");
      const key = models[nextIndex]?.public_model_key;
      if (key) window.history.replaceState(null, "", `${window.location.pathname}#model=${key}`);
    },
    [models]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        document.querySelector("dialog[open]") ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (event.key === "ArrowLeft" && activeIndex > 0) selectModel(activeIndex - 1);
      if (event.key === "ArrowRight" && activeIndex < models.length - 1) selectModel(activeIndex + 1);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, models.length, selectModel]);

  useEffect(() => {
    if (!activeModel?.public_model_key) return;
    const body =
      activeTab === "overview"
        ? {
            eventType: "model_viewed",
            publicModelKey: activeModel.public_model_key,
            section: "overview"
          }
        : {
            eventType: "section_viewed",
            publicModelKey: activeModel.public_model_key,
            section: activeTab
          };

    void fetch(publicApiPath("activity"), {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      keepalive: true,
      method: "POST"
    }).catch(() => undefined);
  }, [activeModel?.public_model_key, activeTab]);

  const onDecision = useCallback(
    async (decision: PublicPresentationDecision) => {
      const publicModelKey = activeModel?.public_model_key;
      if (!publicModelKey || pendingModelKey || !linkState.schema_ready) return;

      const previous = decisions[publicModelKey];
      const previousSubmittedAt = lastSubmittedAt;
      setSelectionError(null);
      setPendingModelKey(publicModelKey);
      setDecisions((current) => withPresentationDecision(current, publicModelKey, decision));
      setLastSubmittedAt(null);
      setStatusMessage(`${activeModel.display_name}: ${decision} selected.`);

      try {
        await postJson("selection", {
          action: "decision",
          decision,
          publicModelKey
        });
      } catch (error) {
        setDecisions((current) => {
          const next = { ...current };
          if (previous) next[publicModelKey] = previous;
          else delete next[publicModelKey];
          return next;
        });
        setLastSubmittedAt(previousSubmittedAt);
        setSelectionError(error instanceof Error ? error.message : "The decision could not be saved.");
        setStatusMessage("The decision was not saved.");
      } finally {
        setPendingModelKey(null);
      }
    },
    [activeModel, decisions, lastSubmittedAt, linkState.schema_ready, pendingModelKey]
  );

  async function confirmSubmission() {
    setSubmitting(true);
    setSelectionError(null);
    try {
      const result = await postJson<{ decision_count: number; submitted_at: string }>("selection", {
        action: "submit",
        note
      });
      setLastSubmittedAt(result.submitted_at);
      setConfirmationAt(result.submitted_at);
      setStatusMessage(`Selection sent with ${result.decision_count} decisions.`);
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : "The selection could not be sent.");
      setStatusMessage("The selection was not sent.");
    } finally {
      setSubmitting(false);
    }
  }

  const recipientName = presentation.link?.recipient_name ?? linkState.recipient_name;
  const canDecide = linkState.state === "active" && linkState.schema_ready;
  const mainClass = useMemo(
    () => `aro-public-experience${models.length === 0 ? " empty" : ""}`,
    [models.length]
  );

  return (
    <main className={mainClass}>
      <a className="aro-public-skip-link" href="#presentation-model-content">
        Skip to models
      </a>

      <PresentationSidebar
        decisions={decisions}
        note={note}
        onNoteChange={(value) => {
          setNote(value);
          setLastSubmittedAt(null);
        }}
        onSubmit={() => {
          setConfirmationAt(null);
          setSelectionError(null);
          setSubmitDialogOpen(true);
        }}
        presentation={{
          ...presentation,
          link: {
            ...presentation.link,
            expires_at: presentation.link?.expires_at ?? linkState.expires_at
          }
        }}
        recipientName={recipientName ?? null}
        schemaReady={canDecide}
        submittedAt={lastSubmittedAt}
        submitting={submitting}
      />

      <section className="aro-public-content" id="presentation-model-content">
        {selectionError ? (
          <div className="aro-public-inline-error" role="alert">
            {selectionError}
          </div>
        ) : null}
        <PublicModelContent
          activeIndex={activeIndex}
          activeTab={activeTab}
          allowDownloads={presentation.allow_downloads}
          decisionDisabled={!canDecide || Boolean(pendingModelKey)}
          decisions={decisions}
          models={models}
          onDecision={onDecision}
          onModelChange={selectModel}
          onTabChange={(tab) => {
            setActiveTab(tab);
            const key = activeModel?.public_model_key;
            if (key) {
              window.history.replaceState(
                null,
                "",
                `${window.location.pathname}#model=${key}&section=${tab}`
              );
            }
          }}
        />
      </section>

      <p aria-live="polite" className="aro-public-sr-only">
        {statusMessage}
      </p>

      <SubmitSelectionDialog
        decisions={decisions}
        error={selectionError}
        models={models}
        note={note}
        onClose={() => {
          if (!submitting) setSubmitDialogOpen(false);
        }}
        onConfirm={confirmSubmission}
        open={submitDialogOpen}
        submittedAt={confirmationAt}
        submitting={submitting}
      />
    </main>
  );
}

export function PresentationUnavailableState({
  status
}: {
  status: Exclude<PublicPresentationLinkStatus, "active">;
}) {
  const copy = {
    expired: {
      description: "This private presentation has reached its expiration date.",
      title: "This link has expired"
    },
    invalid: {
      description: "Check the address you received or ask ARO for a new private link.",
      title: "Presentation unavailable"
    },
    not_published: {
      description: "This presentation is not currently available to view.",
      title: "Presentation not published"
    },
    revoked: {
      description: "ARO has closed access to this private presentation.",
      title: "This link is no longer active"
    }
  }[status];

  return (
    <main className="aro-public-unavailable">
      <div>
        <Image alt="ARO" height={72} priority src="/brand/aro-mark.png" width={72} />
        <p className="aro-public-eyebrow">Private presentation</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
        <a href="https://www.arolab.co">Visit ARO</a>
      </div>
    </main>
  );
}

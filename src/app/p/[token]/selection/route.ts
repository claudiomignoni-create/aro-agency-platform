import { NextResponse } from "next/server";
import {
  savePresentationModelDecision,
  submitPresentationSelection,
  type PublicPresentationDecision
} from "@/lib/communications/data";
import {
  checkPresentationRateLimitWithLegacyFallback,
  requestIpHash
} from "@/lib/communications/rate-limit";
import { sha256 } from "@/lib/communications/security";

const modelKeyPattern = /^[A-Za-z0-9_-]{8,128}$/;
const decisions = new Set<PublicPresentationDecision>(["yes", "maybe", "no"]);

function isSelectionSchemaPending(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === "PGRST202" ||
    /save_public_presentation_model_decision|submit_public_presentation_selection|presentation_model_selections/i.test(
      maybeError.message ?? ""
    )
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let body: {
    action?: string;
    decision?: PublicPresentationDecision;
    note?: string | null;
    publicModelKey?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const operation =
    body.action === "decision" ? "presentation_selection_change" : "presentation_selection_submit";
  const allowed = await checkPresentationRateLimitWithLegacyFallback({
    ipHash: await requestIpHash(),
    operation,
    tokenHash: sha256(token)
  });

  if (!allowed) {
    return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
  }

  try {
    if (body.action === "decision") {
      if (
        !body.publicModelKey ||
        !modelKeyPattern.test(body.publicModelKey) ||
        !body.decision ||
        !decisions.has(body.decision)
      ) {
        return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
      }

      const result = await savePresentationModelDecision({
        decision: body.decision,
        publicModelKey: body.publicModelKey,
        token
      });
      return NextResponse.json({ result });
    }

    if (body.action === "submit") {
      const note = typeof body.note === "string" ? body.note.trim() : null;
      if (note && note.length > 2000) {
        return NextResponse.json({ error: "The note is too long." }, { status: 400 });
      }

      const result = await submitPresentationSelection({ note: note || null, token });
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    if (isSelectionSchemaPending(error)) {
      return NextResponse.json(
        { error: "Selections will be available after the presentation database update." },
        { status: 503 }
      );
    }

    const message = error instanceof Error ? error.message : "";
    if (/presentation_link_inactive/i.test(message)) {
      return NextResponse.json({ error: "This presentation link is no longer active." }, { status: 410 });
    }
    if (/model_not_in_presentation_snapshot|invalid_selection_input/i.test(message)) {
      return NextResponse.json({ error: "This model is not available in the presentation." }, { status: 400 });
    }
    if (/selection_has_no_decisions/i.test(message)) {
      return NextResponse.json({ error: "Select at least one model before sending." }, { status: 400 });
    }

    console.error("[public-presentation:selection]", {
      code: error && typeof error === "object" && "code" in error ? String(error.code) : "unknown"
    });
    return NextResponse.json({ error: "The selection could not be saved." }, { status: 500 });
  }
}

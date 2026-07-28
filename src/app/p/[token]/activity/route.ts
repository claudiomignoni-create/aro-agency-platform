import { NextResponse } from "next/server";
import { recordPresentationEvent } from "@/lib/communications/data";
import {
  checkPresentationRateLimitWithLegacyFallback,
  requestIpHash
} from "@/lib/communications/rate-limit";
import { sha256 } from "@/lib/communications/security";

const modelKeyPattern = /^[A-Za-z0-9_-]{8,128}$/;
const sections = new Set(["overview", "book", "digitals", "video", "downloads"]);
const eventTypes = new Set(["model_viewed", "section_viewed"]);

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let body: { eventType?: "model_viewed" | "section_viewed"; publicModelKey?: string; section?: string };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (
    !body.eventType ||
    !eventTypes.has(body.eventType) ||
    (body.publicModelKey && !modelKeyPattern.test(body.publicModelKey)) ||
    (body.section && !sections.has(body.section))
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const allowed = await checkPresentationRateLimitWithLegacyFallback({
    ipHash: await requestIpHash(),
    operation: "presentation_event",
    tokenHash: sha256(token)
  });
  if (!allowed) return NextResponse.json({ ok: false }, { status: 429 });

  try {
    const ok = await recordPresentationEvent({
      eventType: body.eventType,
      publicModelKey: body.publicModelKey ?? null,
      section: body.section as "book" | "digitals" | "downloads" | "overview" | "video" | undefined,
      token
    });
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

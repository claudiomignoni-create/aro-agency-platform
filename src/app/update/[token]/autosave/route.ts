import { NextResponse } from "next/server";
import { saveUpdateRequestDraftByToken, startUpdateRequestByToken } from "@/lib/communications/data";
import { requestIpHash } from "@/lib/communications/rate-limit";
import { sanitizeError } from "@/lib/communications/security";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const ipHash = await requestIpHash();
    const body = (await request.json()) as { draft?: Record<string, unknown> };
    await startUpdateRequestByToken(token);
    await saveUpdateRequestDraftByToken(token, body.draft ?? {}, ipHash);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error), ok: false }, { status: 400 });
  }
}

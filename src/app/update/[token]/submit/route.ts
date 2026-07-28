import { NextResponse } from "next/server";
import { submitUpdateRequestByToken } from "@/lib/communications/data";
import { requestIpHash } from "@/lib/communications/rate-limit";
import { sanitizeError } from "@/lib/communications/security";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const ipHash = await requestIpHash();
    const body = (await request.json()) as { submission?: Record<string, unknown> };
    await submitUpdateRequestByToken(token, body.submission ?? {}, ipHash);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error), ok: false }, { status: 400 });
  }
}

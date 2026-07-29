import { NextResponse } from "next/server";
import {
  findPresentationByToken,
  getPresentationPrivateMediaRefByToken,
  recordPresentationEvent
} from "@/lib/communications/data";
import {
  checkPresentationRateLimitWithLegacyFallback,
  requestIpHash
} from "@/lib/communications/rate-limit";
import { sha256 } from "@/lib/communications/security";
import { createAdminClient } from "@/lib/supabase/admin";

const mediaKeyPattern = /^[A-Za-z0-9_-]{8,128}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaKey: string; token: string }> }
) {
  const { mediaKey, token } = await params;
  if (!mediaKeyPattern.test(mediaKey)) {
    return NextResponse.json({ error: "Material not found." }, { status: 404 });
  }

  const allowed = await checkPresentationRateLimitWithLegacyFallback({
    ipHash: await requestIpHash(),
    operation: "presentation_download",
    tokenHash: sha256(token)
  });
  if (!allowed) {
    return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
  }

  const presentation = await findPresentationByToken(token);
  if (!presentation || !presentation.allow_downloads) {
    return NextResponse.json({ error: "Downloads are not available for this presentation." }, { status: 403 });
  }

  const mediaRef = await getPresentationPrivateMediaRefByToken(token, mediaKey);
  if (!mediaRef?.storage_bucket || !mediaRef.storage_path) {
    return NextResponse.json({ error: "Material not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(mediaRef.storage_bucket)
    .createSignedUrl(mediaRef.storage_path, 60);

  if (error || !data.signedUrl) {
    return NextResponse.json({ error: "Material is temporarily unavailable." }, { status: 503 });
  }

  await recordPresentationEvent({
    eventType: "file_downloaded",
    token
  }).catch(() => false);

  return NextResponse.redirect(data.signedUrl, 302);
}

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function materialCategory(mediaType: string, storagePath: string) {
  const normalized = `${mediaType} ${storagePath}`.toLowerCase();
  if (/video|casting_video/.test(normalized)) return "video";
  if (/polaroid|digital/.test(normalized)) return "digitals";
  if (/document|composite|pdf/.test(normalized)) return "downloads";
  return "book";
}

function canPreview(path: string | null) {
  return Boolean(path && /\.(jpe?g|png|webp)$/i.test(path));
}

export async function GET(request: NextRequest, context: RouteContext) {
  await requireRole(["admin"]);
  const { id } = await context.params;
  const modelId = request.nextUrl.searchParams.get("modelId")?.trim();
  if (!modelId) {
    return NextResponse.json({ code: "invalid-model", materials: [] }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: presentation, error: presentationError } = await supabase
    .from("presentations")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (presentationError || !presentation) {
    return NextResponse.json(
      { code: "presentation-unavailable", materials: [] },
      { status: presentationError ? 503 : 404 }
    );
  }

  const { data, error } = await supabase
    .from("model_media")
    .select("id, media_type, storage_bucket, storage_path, thumbnail_path, title, status, visibility, sort_order")
    .eq("model_id", modelId)
    .eq("status", "approved")
    .neq("visibility", "private")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .limit(120);

  if (error) {
    console.error("[presentations:materials]", {
      code: error.code ?? "unknown",
      reference: "PRES-MATERIALS-001"
    });
    return NextResponse.json({ code: "materials-unavailable", materials: [] }, { status: 503 });
  }

  const admin = createAdminClient();
  const materials = await Promise.all(
    (data ?? []).map(async (item) => {
      const previewPath = item.thumbnail_path || item.storage_path;
      let previewUrl: string | null = null;
      if (canPreview(previewPath)) {
        const { data: signed } = await admin.storage
          .from(item.storage_bucket)
          .createSignedUrl(previewPath, 300, {
            transform: { quality: 72, resize: "contain", width: 420 }
          });
        previewUrl = signed?.signedUrl ?? null;
      }

      return {
        approved: true as const,
        category: materialCategory(item.media_type, item.storage_path),
        id: item.id,
        mediaType: item.media_type,
        previewUrl,
        title: item.title || "Material sem título"
      };
    })
  );

  return NextResponse.json(
    { materials },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

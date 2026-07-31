import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getEmailPresentationPreview } from "@/lib/communications/presentation-preview-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  await requireRole(["admin"]);
  const { id } = await context.params;

  try {
    const preview = await getEmailPresentationPreview(id);
    if (!preview) {
      return NextResponse.json({ preview: null }, { status: 404 });
    }
    return NextResponse.json(
      { preview },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { code: "preview-unavailable", preview: null },
      { status: 503 }
    );
  }
}

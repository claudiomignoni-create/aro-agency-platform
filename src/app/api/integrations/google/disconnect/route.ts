import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const profile = await requireRole(["admin"]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const supabase = await createClient();
  const { error } = await supabase
    .from("google_workspace_connections")
    .update({
      encrypted_access_token: null,
      encrypted_refresh_token: null,
      status: "disconnected"
    })
    .eq("profile_id", profile.id);

  if (error) throw error;

  return NextResponse.redirect(new URL("/admin/settings?tab=integrations&google=disconnected", appUrl));
}

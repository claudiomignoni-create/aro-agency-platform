import type { ReactNode } from "react";
import { AdminShellV2 } from "@/components/admin/admin-shell-v2";
import { getAdminUserProfile } from "@/lib/admin-profile";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({
  children
}: {
  children: ReactNode;
}) {
  await requireRole(["admin"]);
  const profile = await getAdminUserProfile();

  return <AdminShellV2 profile={profile!}>{children}</AdminShellV2>;
}

import type { ReactNode } from "react";
import {
  adminNavItems,
  DashboardShell
} from "@/components/shell/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({
  children
}: {
  children: ReactNode;
}) {
  await requireRole(["admin"]);

  return (
    <DashboardShell
      eyebrow="Cadastro360"
      navItems={adminNavItems}
      title="AROLAB"
    >
      {children}
    </DashboardShell>
  );
}

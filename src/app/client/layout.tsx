import type { ReactNode } from "react";
import {
  clientNavItems,
  DashboardShell
} from "@/components/shell/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function ClientLayout({
  children
}: {
  children: ReactNode;
}) {
  await requireRole(["client", "admin"]);

  return (
    <DashboardShell
      eyebrow="Portal do cliente"
      navItems={clientNavItems}
      title="Área do cliente"
    >
      {children}
    </DashboardShell>
  );
}

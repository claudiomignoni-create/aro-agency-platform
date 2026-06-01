import type { ReactNode } from "react";
import {
  DashboardShell,
  modelNavItems
} from "@/components/shell/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function ModelLayout({
  children
}: {
  children: ReactNode;
}) {
  await requireRole(["model", "admin"]);

  return (
    <DashboardShell
      eyebrow="Portal do modelo"
      navItems={modelNavItems}
      title="Minha área"
    >
      {children}
    </DashboardShell>
  );
}

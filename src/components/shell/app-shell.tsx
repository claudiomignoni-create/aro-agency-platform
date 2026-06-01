import type { ReactNode } from "react";
import { DashboardShell } from "@/components/shell/dashboard-shell";

type AppShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
};

export function AppShell({ children, eyebrow, title }: AppShellProps) {
  return (
    <DashboardShell
      eyebrow={eyebrow}
      navItems={[
        { href: "/admin", label: "Admin" },
        { href: "/model", label: "Modelo" },
        { href: "/client", label: "Cliente" }
      ]}
      title={title}
    >
      {children}
    </DashboardShell>
  );
}

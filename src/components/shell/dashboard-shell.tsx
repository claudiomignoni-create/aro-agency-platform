import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/(auth)/login/actions";

type NavItem = {
  href: string;
  label: string;
};

type DashboardShellProps = {
  children: ReactNode;
  eyebrow: string;
  navItems: NavItem[];
  title: string;
};

export function DashboardShell({
  children,
  eyebrow,
  navItems,
  title
}: DashboardShellProps) {
  return (
    <main className="dashboard">
      <aside className="sidebar">
        <Link className="brand" href="/">
          ARO Lab
        </Link>
        <nav className="side-nav" aria-label="Navegação da área">
          {navItems.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={signOut}>
          <button className="link-button" type="submit">
            Sair
          </button>
        </form>
      </aside>
      <section className="workspace">
        <header className="workspace-header">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
        </header>
        {children}
      </section>
    </main>
  );
}

export const adminNavItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/models", label: "Modelos" },
  { href: "/admin/media", label: "Mídias" },
  { href: "/admin/requests", label: "Pedidos" }
];

export const modelNavItems = [
  { href: "/model", label: "Dashboard" },
  { href: "/model/profile", label: "Perfil" },
  { href: "/model/media", label: "Mídias" },
  { href: "/model/availability", label: "Disponibilidade" }
];

export const clientNavItems = [
  { href: "/client", label: "Dashboard" },
  { href: "/client/models", label: "Buscar modelos" },
  { href: "/client/shortlists", label: "Shortlists" },
  { href: "/client/requests", label: "Pedidos" }
];

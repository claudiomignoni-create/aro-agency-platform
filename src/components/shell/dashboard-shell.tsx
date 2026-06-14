import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/(auth)/login/actions";
import { MobileNav } from "./mobile-nav";

type NavItem = {
  href: string;
  label: string;
};

type DashboardShellProps = {
  children: ReactNode;
  eyebrow: string;
  focusTone?: "admin";
  navItems: NavItem[];
  title: string;
};

export function DashboardShell({
  children,
  eyebrow,
  focusTone,
  navItems,
  title
}: DashboardShellProps) {
  const renderNav = () => (
    <nav className="side-nav" aria-label="Navegação da área">
      {navItems.map((item) => (
        <Link href={item.href} key={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );

  const renderSignOutForm = () => (
    <form action={signOut}>
      <button className="link-button" type="submit">
        Sair
      </button>
    </form>
  );

  return (
    <main className="dashboard">
      <MobileNav navItems={navItems} signOutForm={renderSignOutForm()} />
      <aside className="sidebar">
        <Link className="brand" href="/">
          <strong>ARO</strong>LAB
        </Link>
        {renderNav()}
        <div className="sidebar-footer">{renderSignOutForm()}</div>
      </aside>
      <section className="workspace">
        <header className="workspace-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
          </div>
          <span className="badge">AROLAB OS</span>
        </header>
        {children}
      </section>
      {focusTone === "admin" ? (
        <style>{`
          .dashboard :where(input, select, textarea):focus,
          .dashboard :where(input, select, textarea):focus-visible {
            border-color: color-mix(in srgb, #6eb6ff 62%, transparent);
            box-shadow:
              0 0 0 1px color-mix(in srgb, #6eb6ff 26%, transparent),
              0 0 0 4px rgba(54, 116, 178, 0.18);
            outline: none;
          }
        `}</style>
      ) : null}
    </main>
  );
}

export const adminNavItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/models", label: "Modelos" },
  { href: "/admin/clients", label: "Clientes" },
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

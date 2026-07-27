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
      <details className="mobile-nav">
        <summary>
          <Link className="brand" href="/">
            <strong>ARO</strong>LAB
          </Link>
          <span className="badge">Menu</span>
        </summary>
        <div className="mobile-nav-panel">
          {renderNav()}
          {renderSignOutForm()}
        </div>
      </details>
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
    </main>
  );
}

export const adminNavItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/models", label: "Modelos" },
  { href: "/admin/clients", label: "Clientes" },
  { href: "/admin/media", label: "Mídias" },
  { href: "/admin/calendar", label: "Agenda" },
  { href: "/admin/accounting", label: "Accounting" }
];

export const modelNavItems = [
  { href: "/model", label: "Dashboard" },
  { href: "/model/profile", label: "Perfil" },
  { href: "/model/media", label: "Mídias" },
  { href: "/model/availability", label: "Agenda" }
];

export const clientNavItems = [
  { href: "/client", label: "Dashboard" },
  { href: "/client/models", label: "Buscar modelos" },
  { href: "/client/shortlists", label: "Shortlists" },
  { href: "/client/jobs", label: "Agenda" }
];

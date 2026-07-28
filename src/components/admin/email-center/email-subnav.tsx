import Link from "next/link";

const items = [
  { href: "/admin/email", label: "Visão geral" },
  { href: "/admin/email/compose", label: "Novo e-mail" },
  { href: "/admin/email/activity", label: "Atividade" },
  { href: "/admin/email/sent", label: "Enviados" },
  { href: "/admin/email/drafts", label: "Rascunhos" },
  { href: "/admin/email/queue", label: "Fila" },
  { href: "/admin/email/templates", label: "Templates" },
  { href: "/admin/email/reports", label: "Relatórios" },
  { href: "/admin/email/settings", label: "Configurações" }
];

export function EmailSubnav({ active }: { active: string }) {
  return (
    <nav aria-label="Navegação do Email Center" className="email-subnav">
      {items.map((item) => (
        <Link
          aria-current={active === item.href ? "page" : undefined}
          className={active === item.href ? "active" : ""}
          href={item.href}
          key={item.href}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

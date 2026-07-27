/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import { Search } from "@/components/admin/admin-icons";

type AdminPageProps = {
  children: ReactNode;
  className?: string;
};

type AdminPageHeaderProps = {
  actions?: ReactNode;
  children?: ReactNode;
  description?: ReactNode;
  eyebrow: string;
  title: string;
};

type FieldProps = {
  children?: ReactNode;
  defaultValue?: string;
  label: string;
  name: string;
};

type SelectOption = {
  label: string;
  value: string;
};

type AvatarProps = {
  href?: string;
  imageUrl?: string | null;
  name: string | null | undefined;
  size?: "sm" | "md" | "lg";
};

type IdentityProps = {
  href?: string;
  imageUrl?: string | null;
  name: string | null | undefined;
  secondary?: ReactNode;
};

export function adminInitials(name: string | null | undefined) {
  return (
    name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AR"
  );
}

export function AdminPage({ children, className }: AdminPageProps) {
  return <div className={["admin-page", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function AdminPageHeader({
  actions,
  children,
  description,
  eyebrow,
  title
}: AdminPageHeaderProps) {
  return (
    <section className="admin-page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="admin-page-actions">{actions}</div> : null}
    </section>
  );
}

export function AdminSection({
  children,
  className,
  title,
  meta
}: AdminPageProps & { meta?: ReactNode; title?: string }) {
  return (
    <section className={["admin-section", className].filter(Boolean).join(" ")}>
      {title || meta ? (
        <header className="admin-section-header">
          {title ? <strong>{title}</strong> : <span />}
          {meta ? <span>{meta}</span> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function AdminToolbar({ children, className }: AdminPageProps) {
  return <section className={["admin-toolbar", className].filter(Boolean).join(" ")}>{children}</section>;
}

export function AdminFilterBar({ children }: { children: ReactNode }) {
  return <form className="admin-filter-bar" method="get">{children}</form>;
}

export function AdminSearchField({
  defaultValue,
  label = "Busca",
  name = "q",
  placeholder
}: {
  defaultValue?: string;
  label?: string;
  name?: string;
  placeholder: string;
}) {
  return (
    <label className="admin-field admin-search-field">
      <span>{label}</span>
      <Search aria-hidden="true" />
      <input defaultValue={defaultValue ?? ""} name={name} placeholder={placeholder} />
    </label>
  );
}

export function AdminSelectField({
  defaultValue,
  label,
  name,
  options
}: FieldProps & { options: SelectOption[] }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <select defaultValue={defaultValue ?? ""} name={name}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AdminDateField({ defaultValue, label, name }: FieldProps) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input defaultValue={defaultValue ?? ""} name={name} type="date" />
    </label>
  );
}

export function AdminTextField({
  defaultValue,
  label,
  name,
  placeholder
}: FieldProps & { placeholder?: string }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input defaultValue={defaultValue ?? ""} name={name} placeholder={placeholder} />
    </label>
  );
}

export function AdminFilterActions({ resetHref }: { resetHref: string }) {
  return (
    <div className="admin-filter-actions">
      <button className="button" type="submit">Aplicar</button>
      <Link className="button secondary" href={resetHref}>Limpar</Link>
    </div>
  );
}

export function AdminMoreFilters({ children, count = 0 }: { children: ReactNode; count?: number }) {
  return (
    <details className="admin-more-filters" open={count > 0}>
      <summary>
        Mais filtros
        {count > 0 ? <span className="admin-chip">{count}</span> : null}
      </summary>
      <div className="admin-more-filters-grid">{children}</div>
    </details>
  );
}

export function AdminDataTable({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="admin-table-wrap">
      <table className={["admin-data-table", className].filter(Boolean).join(" ")}>{children}</table>
    </div>
  );
}

export function AdminStatusPill({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "danger" | "neutral" | "success" | "warning";
}) {
  return <span className={`admin-status-pill ${tone}`}>{children}</span>;
}

export function AdminEntityAvatar({ href, imageUrl, name, size = "md" }: AvatarProps) {
  const avatar = (
    <span className={`admin-entity-avatar ${size}`}>
      {imageUrl ? <img alt={name ?? ""} src={imageUrl} /> : <span>{adminInitials(name)}</span>}
    </span>
  );

  if (href) {
    return <Link href={href}>{avatar}</Link>;
  }

  return avatar;
}

function AdminIdentity({ href, imageUrl, name, secondary }: IdentityProps) {
  const content = (
    <>
      <AdminEntityAvatar imageUrl={imageUrl} name={name} />
      <span>
        <strong>{name || "Sem nome"}</strong>
        {secondary ? <small>{secondary}</small> : null}
      </span>
    </>
  );

  if (href) {
    return (
      <Link className="admin-identity" href={href}>
        {content}
      </Link>
    );
  }

  return <span className="admin-identity">{content}</span>;
}

export function AdminModelIdentity(props: IdentityProps) {
  return <AdminIdentity {...props} />;
}

export function AdminClientIdentity(props: IdentityProps) {
  return <AdminIdentity {...props} />;
}

export function AdminAgencyIdentity(props: IdentityProps) {
  return <AdminIdentity {...props} />;
}

export function AdminEmptyState({
  action,
  description,
  title
}: {
  action?: ReactNode;
  description: ReactNode;
  title: string;
}) {
  return (
    <section className="admin-empty-state">
      <span className="eyebrow">Sem dados</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function AdminStat({
  label,
  value,
  detail
}: {
  detail?: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <article className="admin-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

export function AdminTabs({
  items
}: {
  items: Array<{ active?: boolean; href: string; label: string }>;
}) {
  return (
    <nav className="admin-tabs" aria-label="Seções">
      {items.map((item) => (
        <Link aria-current={item.active ? "page" : undefined} className={item.active ? "active" : ""} href={item.href} key={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

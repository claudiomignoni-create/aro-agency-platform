"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  Command,
  Landmark,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Plane,
  Search,
  Settings,
  Sun,
  User,
  UserRound,
  UsersRound,
  X
} from "@/components/admin/admin-icons";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "@/app/(auth)/login/actions";
import type { AdminUserProfile } from "@/lib/admin-profile";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type AdminShellV2Props = {
  children: ReactNode;
  profile: AdminUserProfile;
};

type SearchResult = {
  href: string;
  id: string;
  subtitle: string | null;
  title: string;
  type: "model" | "client" | "job" | "agency" | "travel" | "flight";
};

type AlertItem = {
  href: string;
  id: string;
  priority: "low" | "medium" | "high";
  title: string;
  description: string;
  timeLabel: string;
  type: "contract" | "payment" | "flight" | "travel" | "job" | "casting" | "document" | "model_update" | "message";
};

const adminNavItems: Array<{
  href: string;
  icon: IconComponent;
  label: string;
}> = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/models", icon: UserRound, label: "Models" },
  { href: "/admin/clients", icon: UsersRound, label: "Clients" },
  { href: "/admin/jobs", icon: BriefcaseBusiness, label: "Jobs" },
  { href: "/admin/accounting", icon: Landmark, label: "Accounting" },
  { href: "/admin/travel", icon: Plane, label: "Travel" },
  { href: "/admin/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/admin/messages", icon: MessageCircle, label: "Messages" },
  { href: "/admin/settings", icon: Settings, label: "Settings" }
];

const typeLabels: Record<SearchResult["type"], string> = {
  agency: "Agencia",
  client: "Cliente",
  flight: "Voo",
  job: "Job",
  model: "Modelo",
  travel: "Viagem"
};

function initials(name: string | null | undefined) {
  return (
    name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AR"
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShellV2({ children, profile }: AdminShellV2Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("dark");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const displayName = profile.full_name || profile.email || "Administrador";
  const title = profile.title || "Administrador";
  const avatar = profile.avatar_url;

  const groupedResults = useMemo(
    () =>
      results.reduce<Record<SearchResult["type"], SearchResult[]>>(
        (groups, result) => {
          groups[result.type].push(result);
          return groups;
        },
        { agency: [], client: [], flight: [], job: [], model: [], travel: [] }
      ),
    [results]
  );

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("aro-admin-theme");
    if (storedTheme === "system" || storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("aro-admin-theme", theme);
  }, [theme]);

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsPaletteOpen(true);
      }

      if (event.key === "Escape") {
        setIsPaletteOpen(false);
        setIsAlertsOpen(false);
        setIsProfileOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!isPaletteOpen) return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isPaletteOpen]);

  useEffect(() => {
    if (!isPaletteOpen) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/admin/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { results: SearchResult[] };
        setResults(payload.results);
        setActiveResultIndex(0);
      } finally {
        setIsSearching(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [isPaletteOpen, query]);

  useEffect(() => {
    let ignore = false;
    async function loadAlerts() {
      const response = await fetch("/admin/operational-alerts");
      if (!response.ok) return;
      const payload = (await response.json()) as { alerts: AlertItem[] };
      if (!ignore) setAlerts(payload.alerts);
    }
    loadAlerts();
    return () => {
      ignore = true;
    };
  }, []);

  const flatResults = results;

  function openResult(result: SearchResult | undefined) {
    if (!result) return;
    setIsPaletteOpen(false);
    router.push(result.href);
  }

  const sidebar = (
    <aside className="admin-v2-sidebar" aria-label="Navegacao administrativa">
      <Link className="admin-v2-brand" href="/admin" onClick={() => setIsDrawerOpen(false)}>
        <Image alt="ARO" height={44} priority src="/brand/aro-mark.png" width={44} />
        <span>ARO</span>
      </Link>
      <nav className="admin-v2-nav">
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={active ? "active" : ""}
              href={item.href}
              key={item.href}
              onClick={() => setIsDrawerOpen(false)}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="admin-v2-sidebar-footer">
        <div className="admin-v2-account-card">
          <div className="admin-v2-avatar">{initials(displayName)}</div>
          <div>
            <strong>ARO</strong>
            <span>Fashion Agency</span>
          </div>
        </div>
        <div className="admin-v2-theme-card" aria-label="Tema">
          {(["system", "light", "dark"] as const).map((option) => (
            <button
              aria-pressed={theme === option}
              className={theme === option ? "active" : ""}
              key={option}
              onClick={() => setTheme(option)}
              type="button"
            >
              {option === "system" ? "Sistema" : option === "light" ? "Claro" : "Escuro"}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );

  return (
    <main className={`admin-v2 admin-v2-${theme}`}>
      <div className="admin-v2-orb one" />
      <div className="admin-v2-orb two" />
      <button
        aria-label={isDrawerOpen ? "Fechar menu" : "Abrir menu"}
        className="admin-v2-menu-button"
        onClick={() => setIsDrawerOpen((current) => !current)}
        type="button"
      >
        {isDrawerOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      <div className={`admin-v2-drawer ${isDrawerOpen ? "open" : ""}`}>{sidebar}</div>
      <div className="admin-v2-desktop-sidebar">{sidebar}</div>
      <section className="admin-v2-workspace">
        <header className="admin-v2-topbar">
          <button
            className="admin-v2-search-trigger"
            onClick={() => setIsPaletteOpen(true)}
            type="button"
          >
            <Search aria-hidden="true" />
            <span>Buscar modelos, clientes, jobs, agencias...</span>
            <kbd>⌘K</kbd>
          </button>
          <div className="admin-v2-top-actions">
            <div className="admin-v2-popover-wrap">
              <button
                aria-label="Abrir notificacoes"
                className="admin-v2-icon-button"
                onClick={() => setIsAlertsOpen((current) => !current)}
                type="button"
              >
                <Bell aria-hidden="true" />
                {alerts.length > 0 ? <span className="admin-v2-count">{alerts.length}</span> : null}
              </button>
              {isAlertsOpen ? (
                <div className="admin-v2-popover admin-v2-alerts-panel">
                  <div className="admin-v2-popover-heading">
                    <strong>Alertas operacionais</strong>
                    <span>{alerts.length} ativo(s)</span>
                  </div>
                  {alerts.length > 0 ? (
                    alerts.slice(0, 8).map((alert) => (
                      <Link href={alert.href} key={alert.id} onClick={() => setIsAlertsOpen(false)}>
                        <span className={`admin-v2-alert-dot ${alert.priority}`} />
                        <span>
                          <strong>{alert.title}</strong>
                          <small>{alert.description}</small>
                        </span>
                        <em>{alert.timeLabel}</em>
                      </Link>
                    ))
                  ) : (
                    <p>Nenhum alerta real no momento.</p>
                  )}
                </div>
              ) : null}
            </div>
            <Link aria-label="Abrir mensagens" className="admin-v2-icon-button" href="/admin/messages">
              <MessageCircle aria-hidden="true" />
            </Link>
            <div className="admin-v2-popover-wrap">
              <button
                className="admin-v2-profile-button"
                onClick={() => setIsProfileOpen((current) => !current)}
                type="button"
              >
                {avatar ? (
                  <img alt={displayName} height={42} src={avatar} width={42} />
                ) : (
                  <span className="admin-v2-avatar">{initials(displayName)}</span>
                )}
                <span>
                  <strong>{displayName}</strong>
                  <small>{title}</small>
                </span>
                <ChevronDown aria-hidden="true" />
              </button>
              {isProfileOpen ? (
                <div className="admin-v2-popover admin-v2-profile-menu">
                  <Link href="/admin/settings" onClick={() => setIsProfileOpen(false)}>
                    <User aria-hidden="true" /> Meu perfil
                  </Link>
                  <Link href="/admin/settings?tab=appearance" onClick={() => setIsProfileOpen(false)}>
                    <Sun aria-hidden="true" /> Aparencia
                  </Link>
                  <form action={signOut}>
                    <button type="submit">Sair</button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <div className="admin-v2-content">{children}</div>
      </section>

      {isPaletteOpen ? (
        <div
          aria-modal="true"
          className="admin-v2-command-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsPaletteOpen(false);
          }}
          role="dialog"
        >
          <div className="admin-v2-command">
            <div className="admin-v2-command-input">
              <Command aria-hidden="true" />
              <input
                aria-label="Busca global"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveResultIndex((current) => Math.min(current + 1, flatResults.length - 1));
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveResultIndex((current) => Math.max(current - 1, 0));
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    openResult(flatResults[activeResultIndex]);
                  }
                }}
                placeholder="Buscar modelos, clientes, jobs, agencias..."
                ref={searchInputRef}
                value={query}
              />
              <button aria-label="Fechar busca" onClick={() => setIsPaletteOpen(false)} type="button">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="admin-v2-command-results">
              {isSearching ? <p>Buscando...</p> : null}
              {!isSearching && results.length === 0 ? <p>Nenhum resultado real encontrado.</p> : null}
              {Object.entries(groupedResults).map(([type, group]) =>
                group.length > 0 ? (
                  <section key={type}>
                    <h3>{typeLabels[type as SearchResult["type"]]}</h3>
                    {group.map((result) => {
                      const index = flatResults.findIndex((item) => item.id === result.id);
                      return (
                        <button
                          className={index === activeResultIndex ? "active" : ""}
                          key={result.id}
                          onClick={() => openResult(result)}
                          type="button"
                        >
                          <span>{result.title.slice(0, 1).toUpperCase()}</span>
                          <strong>{result.title}</strong>
                          {result.subtitle ? <small>{result.subtitle}</small> : null}
                          <em>{typeLabels[result.type]}</em>
                        </button>
                      );
                    })}
                  </section>
                ) : null
              )}
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .admin-v2 {
          --admin-bg: #03183e;
          --admin-bg-soft: rgba(7, 38, 93, 0.72);
          --admin-panel: rgba(9, 45, 104, 0.46);
          --admin-panel-strong: rgba(9, 49, 116, 0.62);
          --admin-border: rgba(153, 202, 255, 0.28);
          --admin-border-strong: rgba(174, 216, 255, 0.42);
          --admin-text: #f8fbff;
          --admin-muted: rgba(223, 235, 255, 0.68);
          --admin-soft: rgba(255, 255, 255, 0.07);
          --admin-blue: #2d85ff;
          --admin-blue-strong: #69b4ff;
          --admin-success: #83f7c7;
          --admin-danger: #ff8ea0;
          position: relative;
          display: grid;
          min-height: 100vh;
          grid-template-columns: 282px minmax(0, 1fr);
          overflow: clip;
          background:
            radial-gradient(circle at 55% 16%, rgba(80, 157, 255, 0.24), transparent 24rem),
            radial-gradient(circle at 92% 6%, rgba(107, 179, 255, 0.18), transparent 20rem),
            linear-gradient(135deg, #052968 0%, #041f4e 42%, #020c25 100%);
          color: var(--admin-text);
        }

        .admin-v2-light {
          --admin-bg: #eaf3ff;
          --admin-bg-soft: rgba(222, 236, 255, 0.82);
          --admin-panel: rgba(255, 255, 255, 0.58);
          --admin-panel-strong: rgba(255, 255, 255, 0.76);
          --admin-border: rgba(19, 82, 148, 0.2);
          --admin-border-strong: rgba(19, 82, 148, 0.34);
          --admin-text: #061b3e;
          --admin-muted: rgba(5, 28, 64, 0.66);
          --admin-soft: rgba(16, 83, 166, 0.08);
          background:
            radial-gradient(circle at 52% 12%, rgba(114, 180, 255, 0.3), transparent 22rem),
            linear-gradient(135deg, #eef6ff 0%, #d9eaff 48%, #c6dcf7 100%);
        }

        .admin-v2::before {
          position: fixed;
          inset: 0;
          background:
            linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
          background-size: 96px 96px;
          content: "";
          opacity: 0.45;
          pointer-events: none;
          mask-image: radial-gradient(circle at 52% 24%, black, transparent 74%);
        }

        .admin-v2-orb {
          position: fixed;
          border-radius: 999px;
          filter: blur(34px);
          opacity: 0.42;
          pointer-events: none;
        }

        .admin-v2-orb.one {
          top: 8%;
          right: 10%;
          width: 320px;
          height: 320px;
          background: rgba(55, 142, 255, 0.34);
        }

        .admin-v2-orb.two {
          bottom: 4%;
          left: 40%;
          width: 260px;
          height: 260px;
          background: rgba(28, 92, 190, 0.28);
        }

        .admin-v2 a,
        .admin-v2 button {
          -webkit-tap-highlight-color: transparent;
        }

        .admin-v2 :is(a, button, input, textarea, select):focus-visible {
          outline: 2px solid var(--admin-blue-strong);
          outline-offset: 3px;
        }

        .admin-v2 :is(input, textarea, select):focus {
          border-color: var(--admin-blue-strong);
          box-shadow: 0 0 0 4px rgba(105, 180, 255, 0.16);
        }

        .admin-v2-desktop-sidebar,
        .admin-v2-drawer,
        .admin-v2-workspace,
        .admin-v2-command-backdrop {
          position: relative;
          z-index: 1;
        }

        .admin-v2-desktop-sidebar {
          min-width: 0;
        }

        .admin-v2-sidebar {
          position: sticky;
          top: 14px;
          display: flex;
          height: calc(100vh - 28px);
          flex-direction: column;
          gap: 22px;
          margin: 14px;
          border: 1px solid var(--admin-border);
          border-radius: 18px;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.035)),
            var(--admin-panel);
          box-shadow: 0 28px 80px rgba(0, 8, 28, 0.34);
          padding: 18px;
          backdrop-filter: blur(26px) saturate(150%);
        }

        .admin-v2-brand {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          min-height: 58px;
          border-bottom: 1px solid var(--admin-border);
          color: var(--admin-text);
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 0.18em;
          padding-bottom: 14px;
        }

        .admin-v2-brand img {
          border-radius: 999px;
          box-shadow: 0 0 34px rgba(93, 164, 255, 0.38);
        }

        .admin-v2-nav {
          display: grid;
          gap: 8px;
        }

        .admin-v2-nav a {
          position: relative;
          display: grid;
          min-height: 50px;
          align-items: center;
          grid-template-columns: 22px minmax(0, 1fr);
          gap: 13px;
          border: 1px solid transparent;
          border-radius: 13px;
          color: var(--admin-muted);
          font-size: 14px;
          font-weight: 800;
          padding: 0 14px;
          transition:
            background 160ms ease,
            border-color 160ms ease,
            color 160ms ease,
            box-shadow 160ms ease,
            transform 160ms ease;
        }

        .admin-v2-nav a svg {
          width: 20px;
          height: 20px;
          stroke-width: 1.9;
        }

        .admin-v2-nav a:hover {
          border-color: var(--admin-border);
          background: var(--admin-soft);
          color: var(--admin-text);
          transform: translateX(2px);
        }

        .admin-v2-nav a.active {
          border-color: rgba(152, 206, 255, 0.56);
          background: linear-gradient(135deg, rgba(45, 133, 255, 0.9), rgba(17, 87, 202, 0.7));
          color: #ffffff;
          box-shadow:
            0 16px 38px rgba(28, 111, 240, 0.28),
            0 0 28px rgba(92, 171, 255, 0.26);
        }

        .admin-v2-nav a.active::after {
          position: absolute;
          top: 50%;
          right: 12px;
          width: 5px;
          height: 28px;
          border-radius: 999px;
          background: #ffffff;
          content: "";
          transform: translateY(-50%);
        }

        .admin-v2-sidebar-footer {
          display: grid;
          gap: 12px;
          margin-top: auto;
        }

        .admin-v2-account-card,
        .admin-v2-theme-card {
          border: 1px solid var(--admin-border);
          border-radius: 14px;
          background: var(--admin-soft);
          padding: 12px;
        }

        .admin-v2-account-card {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .admin-v2-account-card strong,
        .admin-v2-account-card span {
          display: block;
        }

        .admin-v2-account-card span {
          color: var(--admin-muted);
          font-size: 12px;
        }

        .admin-v2-theme-card {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
        }

        .admin-v2-theme-card button {
          min-height: 34px;
          border: 1px solid transparent;
          border-radius: 10px;
          background: transparent;
          color: var(--admin-muted);
          font-size: 12px;
          font-weight: 800;
        }

        .admin-v2-theme-card button.active {
          border-color: var(--admin-border-strong);
          background: rgba(45, 133, 255, 0.2);
          color: var(--admin-text);
        }

        .admin-v2-workspace {
          display: grid;
          min-width: 0;
          align-content: start;
          gap: 18px;
          padding: 28px 28px 34px 10px;
        }

        .admin-v2-topbar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
        }

        .admin-v2-search-trigger {
          display: grid;
          width: min(620px, 100%);
          min-height: 54px;
          align-items: center;
          grid-template-columns: 22px minmax(0, 1fr) auto;
          gap: 13px;
          border: 1px solid var(--admin-border-strong);
          border-radius: 999px;
          background: var(--admin-panel);
          color: var(--admin-muted);
          padding: 0 16px 0 18px;
          text-align: left;
          backdrop-filter: blur(24px);
          box-shadow: 0 18px 52px rgba(0, 8, 28, 0.2);
        }

        .admin-v2-search-trigger svg {
          width: 20px;
          height: 20px;
        }

        .admin-v2-search-trigger kbd {
          border: 1px solid var(--admin-border);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.08);
          color: var(--admin-muted);
          padding: 3px 7px;
          font-size: 12px;
        }

        .admin-v2-top-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-left: auto;
        }

        .admin-v2-icon-button,
        .admin-v2-profile-button,
        .admin-v2-menu-button {
          border: 1px solid var(--admin-border);
          background: var(--admin-panel);
          color: var(--admin-text);
          box-shadow: 0 14px 40px rgba(0, 8, 28, 0.2);
          backdrop-filter: blur(22px);
        }

        .admin-v2-icon-button,
        .admin-v2-menu-button {
          position: relative;
          display: inline-flex;
          width: 46px;
          height: 46px;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
        }

        .admin-v2-icon-button svg,
        .admin-v2-menu-button svg {
          width: 20px;
          height: 20px;
        }

        .admin-v2-count {
          position: absolute;
          top: -5px;
          right: -5px;
          display: inline-flex;
          min-width: 20px;
          height: 20px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: var(--admin-blue);
          color: #ffffff;
          font-size: 11px;
          font-weight: 800;
        }

        .admin-v2-profile-button {
          display: grid;
          min-height: 58px;
          align-items: center;
          grid-template-columns: 42px minmax(0, 1fr) 16px;
          gap: 10px;
          border-radius: 16px;
          padding: 7px 12px 7px 8px;
          text-align: left;
        }

        .admin-v2-profile-button img {
          border-radius: 999px;
          object-fit: cover;
        }

        .admin-v2-profile-button strong,
        .admin-v2-profile-button small {
          display: block;
          max-width: 170px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .admin-v2-profile-button small {
          color: var(--admin-muted);
          font-size: 11px;
        }

        .admin-v2-avatar {
          display: inline-flex;
          width: 42px;
          height: 42px;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border: 1px solid var(--admin-border-strong);
          border-radius: 999px;
          background: rgba(45, 133, 255, 0.2);
          color: var(--admin-text);
          font-weight: 800;
        }

        .admin-v2-popover-wrap {
          position: relative;
        }

        .admin-v2-popover {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          z-index: 20;
          width: min(360px, calc(100vw - 28px));
          border: 1px solid var(--admin-border-strong);
          border-radius: 16px;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04)),
            rgba(5, 28, 70, 0.9);
          box-shadow: 0 30px 70px rgba(0, 8, 28, 0.38);
          padding: 12px;
          backdrop-filter: blur(24px);
        }

        .admin-v2-light .admin-v2-popover {
          background: rgba(244, 249, 255, 0.94);
        }

        .admin-v2-popover-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 4px 4px 10px;
        }

        .admin-v2-popover-heading span,
        .admin-v2-popover p {
          color: var(--admin-muted);
          font-size: 12px;
        }

        .admin-v2-alerts-panel a,
        .admin-v2-profile-menu a,
        .admin-v2-profile-menu button {
          display: grid;
          width: 100%;
          align-items: center;
          gap: 10px;
          border: 0;
          border-radius: 12px;
          background: transparent;
          color: var(--admin-text);
          padding: 10px;
          text-align: left;
        }

        .admin-v2-alerts-panel a {
          grid-template-columns: 10px minmax(0, 1fr) auto;
        }

        .admin-v2-profile-menu a,
        .admin-v2-profile-menu button {
          grid-template-columns: 18px minmax(0, 1fr);
          font-size: 14px;
          font-weight: 800;
        }

        .admin-v2-alerts-panel a:hover,
        .admin-v2-profile-menu a:hover,
        .admin-v2-profile-menu button:hover {
          background: var(--admin-soft);
        }

        .admin-v2-alerts-panel small,
        .admin-v2-alerts-panel em {
          display: block;
          color: var(--admin-muted);
          font-size: 11px;
          font-style: normal;
          line-height: 1.35;
        }

        .admin-v2-alert-dot {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: var(--admin-blue-strong);
        }

        .admin-v2-alert-dot.high {
          background: var(--admin-danger);
        }

        .admin-v2-alert-dot.medium {
          background: #ffd166;
        }

        .admin-v2-content {
          min-width: 0;
        }

        .admin-v2-command-backdrop {
          position: fixed;
          inset: 0;
          display: grid;
          align-items: start;
          justify-items: center;
          background: rgba(0, 10, 34, 0.52);
          padding: 7vh 16px 16px;
          backdrop-filter: blur(18px);
        }

        .admin-v2-command {
          width: min(780px, 100%);
          max-height: min(720px, 86vh);
          overflow: hidden;
          border: 1px solid var(--admin-border-strong);
          border-radius: 18px;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04)),
            rgba(5, 27, 70, 0.94);
          box-shadow: 0 34px 90px rgba(0, 8, 28, 0.48);
          backdrop-filter: blur(28px);
        }

        .admin-v2-command-input {
          display: grid;
          align-items: center;
          grid-template-columns: 22px minmax(0, 1fr) 38px;
          gap: 12px;
          border-bottom: 1px solid var(--admin-border);
          padding: 14px;
        }

        .admin-v2-command-input input,
        .admin-v2-command-input button {
          border: 0;
          background: transparent;
          color: var(--admin-text);
        }

        .admin-v2-command-input input {
          min-height: 42px;
          outline: 0;
          font-size: 16px;
        }

        .admin-v2-command-results {
          display: grid;
          max-height: 580px;
          gap: 14px;
          overflow-y: auto;
          padding: 14px;
        }

        .admin-v2-command-results h3 {
          color: var(--admin-muted);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .admin-v2-command-results section {
          display: grid;
          gap: 7px;
        }

        .admin-v2-command-results button {
          display: grid;
          min-height: 58px;
          align-items: center;
          grid-template-columns: 38px minmax(0, 1fr) auto;
          gap: 10px;
          border: 1px solid transparent;
          border-radius: 13px;
          background: transparent;
          color: var(--admin-text);
          padding: 8px 10px;
          text-align: left;
        }

        .admin-v2-command-results button.active,
        .admin-v2-command-results button:hover {
          border-color: var(--admin-border);
          background: var(--admin-soft);
        }

        .admin-v2-command-results button > span {
          display: inline-flex;
          width: 38px;
          height: 38px;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: rgba(45, 133, 255, 0.22);
          font-weight: 800;
        }

        .admin-v2-command-results strong,
        .admin-v2-command-results small {
          display: block;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .admin-v2-command-results small,
        .admin-v2-command-results em {
          color: var(--admin-muted);
          font-size: 12px;
          font-style: normal;
        }

        .admin-v2-drawer,
        .admin-v2-menu-button {
          display: none;
        }

        @media (max-width: 1120px) {
          .admin-v2 {
            grid-template-columns: 1fr;
          }

          .admin-v2-desktop-sidebar {
            display: none;
          }

          .admin-v2-menu-button {
            position: fixed;
            top: 16px;
            left: 16px;
            z-index: 40;
            display: inline-flex;
          }

          .admin-v2-drawer {
            position: fixed;
            inset: 0 auto 0 0;
            z-index: 35;
            display: block;
            width: min(310px, calc(100vw - 34px));
            transform: translateX(-110%);
            transition: transform 180ms ease;
          }

          .admin-v2-drawer.open {
            transform: translateX(0);
          }

          .admin-v2-drawer .admin-v2-sidebar {
            top: 0;
            height: calc(100vh - 28px);
          }

          .admin-v2-workspace {
            padding: 76px 16px 26px;
          }
        }

        @media (max-width: 760px) {
          .admin-v2-topbar {
            align-items: stretch;
            flex-direction: column;
          }

          .admin-v2-top-actions {
            width: 100%;
            justify-content: space-between;
            margin-left: 0;
          }

          .admin-v2-search-trigger {
            width: 100%;
          }

          .admin-v2-profile-button {
            min-width: 0;
            flex: 1;
          }

          .admin-v2-profile-button strong,
          .admin-v2-profile-button small {
            max-width: 120px;
          }
        }

        @media (max-width: 430px) {
          .admin-v2-workspace {
            padding-right: 12px;
            padding-left: 12px;
          }

          .admin-v2-search-trigger {
            min-height: 48px;
            font-size: 13px;
          }

          .admin-v2-search-trigger kbd {
            display: none;
          }

          .admin-v2-icon-button {
            width: 42px;
            height: 42px;
          }

          .admin-v2-profile-button {
            min-height: 50px;
            grid-template-columns: 36px minmax(0, 1fr) 14px;
          }

          .admin-v2-profile-button .admin-v2-avatar {
            width: 36px;
            height: 36px;
          }
        }
      `}</style>
    </main>
  );
}

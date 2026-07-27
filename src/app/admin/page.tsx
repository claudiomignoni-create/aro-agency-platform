import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  BriefcaseBusiness,
  CircleDollarSign,
  Globe2,
  Hand,
  Landmark,
  MapPin,
  Plane,
  Plus,
  Send,
  UserRound,
  UsersRound
} from "lucide-react";
import {
  formatDashboardDateTime,
  formatRelativeDate,
  getDashboardCommandCenterData,
  modelBoard,
  modelDisplayName,
  activeJobStatuses
} from "@/lib/admin-dashboard";
import { getAdminUserProfile } from "@/lib/admin-profile";
import { currentMonthKey, nextMonthKey, previousMonthKey } from "@/lib/calendar";
import { formatMoney } from "@/lib/finance-calculations";
import { jobStatusLabel, jobTypeLabel } from "@/lib/jobs";

export const dynamic = "force-dynamic";

type AdminDashboardPageProps = {
  searchParams?: Promise<{
    month?: string;
  }>;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function modelImage(
  name: string,
  id: string,
  imageUrls: Record<string, string>,
  className = "aro-model-thumb"
) {
  const url = imageUrls[id];

  return url ? (
    <img alt={name} className={className} src={url} />
  ) : (
    <span className={`${className} placeholder`}>{initials(name) || "AR"}</span>
  );
}

function moneySecondary(
  rows: Array<{ currency: string; formatted: string; value: number }>
) {
  return rows.length > 0
    ? rows.map((row) => `${row.currency} ${row.formatted}`).join(" · ")
    : "Sem comparação disponível";
}

export default async function AdminDashboardPage({
  searchParams
}: AdminDashboardPageProps) {
  const params = (await searchParams) ?? {};
  const monthKey = params.month?.match(/^\d{4}-\d{2}$/)
    ? params.month
    : currentMonthKey();
  const [profile, dashboard] = await Promise.all([
    getAdminUserProfile(),
    getDashboardCommandCenterData(monthKey)
  ]);
  const fullName = profile?.full_name || profile?.email || "Administrador";
  const firstName = fullName.split(" ")[0] || "Admin";
  const eventDates = new Set(dashboard.calendar.eventDates);

  const metricCards = [
    {
      icon: UserRound,
      label: "Modelos Ativos",
      value: String(dashboard.activeModels),
      helper: "Sem comparação disponível"
    },
    {
      icon: BriefcaseBusiness,
      label: "Jobs Abertos",
      value: String(dashboard.openJobs),
      helper: `Status: ${activeJobStatuses.map(jobStatusLabel).join(", ")}`
    },
    {
      icon: Globe2,
      label: "Temporadas Internacionais",
      value:
        dashboard.internationalSeasonCount === null
          ? "—"
          : String(dashboard.internationalSeasonCount),
      helper: dashboard.travelReady ? "Fonte: Travel" : "Travel ainda não ativado"
    },
    {
      icon: CircleDollarSign,
      label: "Pagamentos Pendentes",
      value: dashboard.paymentsPendingPrimary,
      helper: dashboard.paymentsPendingSecondary || "Sem comparação disponível"
    }
  ];

  return (
    <div className="aro-dashboard">
      <header className="aro-dashboard-hero">
        <div>
          <h1>
            Ola, {firstName}
            <Hand aria-hidden="true" />
          </h1>
          <p>Bem-vindo ao ARO</p>
          <span>Seu resumo da agencia em tempo real.</span>
        </div>
        {dashboard.failedWidgets.length > 0 ? (
          <div className="aro-dashboard-fallback">
            Alguns widgets entraram em fallback: {dashboard.failedWidgets.join(", ")}.
          </div>
        ) : null}
      </header>

      <section className="aro-metrics" aria-label="Metricas principais">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="aro-glass-card aro-metric-card" key={metric.label}>
              <span className="aro-icon-bubble">
                <Icon aria-hidden="true" />
              </span>
              <div>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.helper}</small>
              </div>
            </article>
          );
        })}
      </section>

      <section className="aro-dashboard-grid" aria-label="Centro de comando">
        <article className="aro-glass-card aro-widget span-3">
          <WidgetHeading index={1} title="Proximos Trabalhos" href="/admin/jobs" />
          <div className="aro-list">
            {dashboard.upcomingJobs.length > 0 ? (
              dashboard.upcomingJobs.map((job) => {
                const model = job.job_models[0]?.model ?? null;
                const name = modelDisplayName(model);
                return (
                  <Link className="aro-job-row" href={`/admin/calendar/${job.id}`} key={job.id}>
                    {model ? modelImage(name, model.id, dashboard.imageUrls) : <span className="aro-model-thumb placeholder">AR</span>}
                    <span>
                      <strong>{job.project_name || job.brand_name || "Job"}</strong>
                      <small>{formatDashboardDateTime(job.start_at)}</small>
                      <small>{[job.location_name, job.city, job.country].filter(Boolean).join(" · ")}</small>
                    </span>
                    <em>{jobTypeLabel(job.type)}</em>
                  </Link>
                );
              })
            ) : (
              <EmptyState text="Nenhum trabalho futuro encontrado." />
            )}
          </div>
        </article>

        <article className="aro-glass-card aro-widget span-4">
          <WidgetHeading
            index={2}
            title="Calendario"
            href="/admin/calendar"
            actions={
              <>
                <Link href={`/admin?month=${previousMonthKey(monthKey)}`} aria-label="Mes anterior">
                  ‹
                </Link>
                <span>{dashboard.calendar.title}</span>
                <Link href={`/admin?month=${nextMonthKey(monthKey)}`} aria-label="Proximo mes">
                  ›
                </Link>
              </>
            }
          />
          <div className="aro-calendar-mini">
            {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"].map((day) => (
              <strong key={day}>{day}</strong>
            ))}
            {dashboard.calendar.days.map((day) => (
              <Link
                className={[
                  day.isCurrentMonth ? "" : "muted",
                  day.isToday ? "today" : "",
                  eventDates.has(day.date) ? "has-event" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                href={`/admin/calendar?date=${day.date}`}
                key={day.date}
              >
                {day.dayOfMonth}
              </Link>
            ))}
          </div>
        </article>

        <article className="aro-glass-card aro-widget span-5">
          <WidgetHeading index={3} title="Ultimos Modelos Adicionados" href="/admin/models" />
          <div className="aro-model-carousel">
            {dashboard.latestModels.length > 0 ? (
              dashboard.latestModels.slice(0, 6).map((model) => {
                const name = modelDisplayName(model);
                return (
                  <Link className="aro-model-card" href={`/admin/models/${model.id}/edit`} key={model.id}>
                    {modelImage(name, model.id, dashboard.imageUrls, "aro-model-photo")}
                    <strong>{name}</strong>
                    <small>{[model.current_city || model.base_city, model.current_country || model.base_country].filter(Boolean).join(", ") || "—"}</small>
                    <em>{modelBoard(model)}</em>
                  </Link>
                );
              })
            ) : (
              <EmptyState text="Nenhum modelo cadastrado." />
            )}
          </div>
        </article>

        <article className="aro-glass-card aro-widget span-3">
          <WidgetHeading index={4} title="Modelos Atualizados Recentemente" href="/admin/models" />
          <div className="aro-list compact">
            {dashboard.recentModels.length > 0 ? (
              dashboard.recentModels.map((model) => {
                const name = modelDisplayName(model);
                return (
                  <Link className="aro-measure-row" href={`/admin/models/${model.id}/edit`} key={model.id}>
                    {modelImage(name, model.id, dashboard.imageUrls)}
                    <span>
                      <strong>{name}</strong>
                      <small>
                        Altura {model.height_cm ?? "—"}cm · Busto {model.bust_cm ?? "—"}cm · Cintura {model.waist_cm ?? "—"}cm · Quadril {model.hips_cm ?? "—"}cm
                      </small>
                    </span>
                    <em>{formatRelativeDate(model.last_profile_update_at || model.updated_at)}</em>
                  </Link>
                );
              })
            ) : (
              <EmptyState text="Nenhuma atualizacao recente." />
            )}
          </div>
        </article>

        <article className="aro-glass-card aro-widget span-4">
          <WidgetHeading index={5} title="Entradas Financeiras Recentes" href="/admin/accounting" />
          {dashboard.accountingReady ? (
            <>
              <div className="aro-finance-list">
                {dashboard.financial.recentEntries.length > 0 ? (
                  dashboard.financial.recentEntries.slice(0, 5).map((entry) => (
                    <Link href="/admin/accounting" key={entry.id}>
                      <strong>{formatMoney(Number(entry.amount ?? 0), entry.currency)}</strong>
                      <span>
                        {entry.title}
                        <small>{entry.occurred_on}</small>
                      </span>
                    </Link>
                  ))
                ) : (
                  <EmptyState text="Nenhuma entrada nos ultimos 30 dias." />
                )}
              </div>
              <footer className="aro-widget-footer">
                Total ultimos 30 dias <strong>{moneySecondary(dashboard.financial.recentTotals)}</strong>
              </footer>
            </>
          ) : (
            <EmptyState
              href="/admin/accounting"
              text="Accounting ainda nao ativado para este banco."
            />
          )}
        </article>

        <article className="aro-glass-card aro-widget span-5">
          <WidgetHeading index={6} title="Modelos em Temporadas Internacionais" href="/admin/travel" />
          <div className="aro-world-map">
            <svg aria-hidden="true" viewBox="0 0 100 52">
              <path d="M6 21h9l4-4 7 2 6-3 9 5 8-2 9 3 7-4 8 2 5 5 9-2 6 6-5 5-11-1-7 4-10-2-8 3-9-5-7 1-8-2-7 3-8-5-7 1-5-4z" />
              <path d="M13 36l8 3 7-2 8 4 10-2 7 4 9-3 12 2 8-3 10 5" />
              <path d="M25 13l10-3 9 4 12-3 12 2 7 4" />
            </svg>
            {dashboard.travelMapPoints.map((point) => (
              <Link
                className="aro-map-point"
                href={point.href}
                key={point.id}
                style={{
                  left: `${(point.lng + 180) / 3.6}%`,
                  top: `${(90 - point.lat) / 1.8}%`
                }}
                title={`${point.modelName} · ${point.city}, ${point.country}`}
              >
                <MapPin aria-hidden="true" />
                <span>
                  <strong>{point.city}</strong>
                  <small>{point.country}</small>
                </span>
              </Link>
            ))}
            {dashboard.travelMapPoints.length === 0 ? (
              <p>Nenhum marcador com coordenadas reais cadastrado.</p>
            ) : null}
          </div>
        </article>

        <article className="aro-glass-card aro-widget span-3">
          <WidgetHeading index={7} title="Modelos Viajando Agora" href="/admin/travel" />
          <div className="aro-list compact">
            {dashboard.modelsTravelingNow.length > 0 ? (
              dashboard.modelsTravelingNow.map((trip) => (
                <Link className="aro-travel-row" href={trip.href} key={trip.id}>
                  <span className="aro-country-dot">•</span>
                  <span>
                    <strong>{trip.modelName}</strong>
                    <small>{trip.route || [trip.origin, trip.destination].filter(Boolean).join(" → ") || "Rota nao informada"}</small>
                  </span>
                  <em>{trip.flightStatus || trip.status}</em>
                </Link>
              ))
            ) : (
              <EmptyState text={dashboard.travelReady ? "Nenhuma viagem ativa." : "Travel ainda nao ativado."} />
            )}
          </div>
        </article>

        <article className="aro-glass-card aro-widget span-4">
          <WidgetHeading index={8} title="Atalhos" />
          <div className="aro-shortcuts">
            <Shortcut href="/admin/models/new" icon={UserRound} label="Adicionar Modelo" />
            <Shortcut href="/admin/calendar/new?type=job" icon={BriefcaseBusiness} label="Novo Job" />
            <Shortcut href="/admin/media" icon={Send} label="Enviar Material" />
            <Shortcut href="/admin/clients" icon={UsersRound} label="Ver CRM" />
            <Shortcut href="/admin/accounting/reports" icon={Landmark} label="Relatorios Gerenciais" />
            <Shortcut href="/admin/clients/new?client_type=international_agency" icon={Plus} label="Nova Agencia Parceira" />
          </div>
        </article>

        <article className="aro-glass-card aro-widget span-5">
          <WidgetHeading index={9} title="Mensagens / Alertas" href="/admin/messages" />
          <div className="aro-alert-list">
            {dashboard.upcomingJobs.slice(0, 2).map((job) => (
              <Link href={`/admin/calendar/${job.id}`} key={`alert-job-${job.id}`}>
                <BriefcaseBusiness aria-hidden="true" />
                <span>
                  <strong>{job.project_name || job.brand_name || "Job proximo"}</strong>
                  <small>{formatDashboardDateTime(job.start_at)}</small>
                </span>
              </Link>
            ))}
            {dashboard.financial.pendingByCurrency.slice(0, 2).map((row) => (
              <Link href="/admin/accounting" key={`alert-payment-${row.currency}`}>
                <CircleDollarSign aria-hidden="true" />
                <span>
                  <strong>Pagamento pendente</strong>
                  <small>{row.formatted} em {row.currency}</small>
                </span>
              </Link>
            ))}
            {dashboard.modelsTravelingNow.slice(0, 2).map((trip) => (
              <Link href={trip.href} key={`alert-travel-${trip.id}`}>
                <Plane aria-hidden="true" />
                <span>
                  <strong>{trip.modelName}</strong>
                  <small>{trip.flightStatus || trip.status}</small>
                </span>
              </Link>
            ))}
            {dashboard.upcomingJobs.length === 0 &&
            dashboard.financial.pendingByCurrency.length === 0 &&
            dashboard.modelsTravelingNow.length === 0 ? (
              <EmptyState text="Nenhum alerta operacional real no momento." />
            ) : null}
          </div>
        </article>
      </section>

      <style>{`
        .aro-dashboard {
          display: grid;
          gap: 14px;
          min-width: 0;
        }

        .aro-dashboard-hero {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 18px;
          padding: 22px 8px 6px;
        }

        .aro-dashboard-hero h1 {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 0 8px;
          color: var(--admin-text);
          font-size: clamp(30px, 3.8vw, 46px);
          line-height: 1;
        }

        .aro-dashboard-hero h1 svg {
          width: 28px;
          height: 28px;
          color: var(--admin-blue-strong);
        }

        .aro-dashboard-hero p {
          margin-bottom: 4px;
          color: var(--admin-text);
          font-size: 18px;
          font-weight: 800;
        }

        .aro-dashboard-hero span,
        .aro-dashboard-fallback {
          color: var(--admin-muted);
          font-size: 13px;
        }

        .aro-dashboard-fallback {
          max-width: 420px;
          border: 1px solid rgba(255, 209, 102, 0.28);
          border-radius: 12px;
          background: rgba(255, 209, 102, 0.08);
          padding: 10px 12px;
        }

        .aro-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .aro-glass-card {
          position: relative;
          overflow: hidden;
          border: 1px solid var(--admin-border);
          border-radius: 16px;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04)),
            var(--admin-panel);
          box-shadow:
            0 24px 70px rgba(0, 8, 28, 0.24),
            0 0 26px rgba(75, 150, 255, 0.1);
          backdrop-filter: blur(24px) saturate(145%);
        }

        .aro-glass-card::before {
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, rgba(255, 255, 255, 0.18), transparent 38%);
          content: "";
          opacity: 0.46;
          pointer-events: none;
        }

        .aro-glass-card > * {
          position: relative;
        }

        .aro-metric-card {
          display: grid;
          min-height: 116px;
          align-items: center;
          grid-template-columns: 48px minmax(0, 1fr);
          gap: 14px;
          padding: 18px;
        }

        .aro-icon-bubble {
          display: inline-flex;
          width: 46px;
          height: 46px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: rgba(45, 133, 255, 0.28);
          color: #ffffff;
          box-shadow: 0 0 26px rgba(83, 162, 255, 0.24);
        }

        .aro-icon-bubble svg {
          width: 21px;
          height: 21px;
        }

        .aro-metric-card span,
        .aro-metric-card small {
          display: block;
          color: var(--admin-muted);
          font-size: 12px;
        }

        .aro-metric-card strong {
          display: block;
          margin: 4px 0;
          color: var(--admin-text);
          font-size: clamp(24px, 3vw, 34px);
          line-height: 1;
        }

        .aro-dashboard-grid {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 12px;
        }

        .span-3 {
          grid-column: span 3;
        }

        .span-4 {
          grid-column: span 4;
        }

        .span-5 {
          grid-column: span 5;
        }

        .aro-widget {
          display: grid;
          min-height: 260px;
          align-content: start;
          gap: 12px;
          padding: 16px;
        }

        .aro-widget-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .aro-widget-heading div {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .aro-widget-heading h2 {
          margin: 0;
          color: var(--admin-text);
          font-size: 15px;
          line-height: 1.2;
        }

        .aro-widget-heading .index {
          display: inline-flex;
          width: 25px;
          height: 25px;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: rgba(45, 133, 255, 0.24);
          color: #ffffff;
          font-size: 12px;
          font-weight: 800;
        }

        .aro-widget-heading a,
        .aro-widget-actions {
          color: var(--admin-muted);
          font-size: 12px;
          font-weight: 800;
        }

        .aro-widget-actions {
          display: inline-flex;
          align-items: center;
          gap: 12px;
        }

        .aro-list,
        .aro-alert-list,
        .aro-finance-list {
          display: grid;
          gap: 9px;
        }

        .aro-job-row,
        .aro-measure-row,
        .aro-travel-row,
        .aro-alert-list a,
        .aro-finance-list a {
          display: grid;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--admin-text);
          padding: 8px 0;
        }

        .aro-job-row {
          grid-template-columns: 52px minmax(0, 1fr) auto;
        }

        .aro-measure-row {
          grid-template-columns: 42px minmax(0, 1fr) auto;
        }

        .aro-travel-row,
        .aro-alert-list a {
          grid-template-columns: 24px minmax(0, 1fr) auto;
        }

        .aro-finance-list a {
          grid-template-columns: 128px minmax(0, 1fr);
        }

        .aro-job-row strong,
        .aro-measure-row strong,
        .aro-travel-row strong,
        .aro-finance-list strong,
        .aro-alert-list strong {
          display: block;
          overflow: hidden;
          color: var(--admin-text);
          font-size: 13px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .aro-job-row small,
        .aro-measure-row small,
        .aro-travel-row small,
        .aro-finance-list small,
        .aro-alert-list small {
          display: block;
          overflow: hidden;
          color: var(--admin-muted);
          font-size: 11px;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .aro-job-row em,
        .aro-measure-row em,
        .aro-travel-row em {
          border: 1px solid var(--admin-border);
          border-radius: 999px;
          color: var(--admin-muted);
          font-size: 11px;
          font-style: normal;
          padding: 5px 8px;
          white-space: nowrap;
        }

        .aro-model-thumb,
        .aro-model-photo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 1px solid var(--admin-border);
          background: rgba(45, 133, 255, 0.18);
          color: var(--admin-text);
          font-weight: 800;
          object-fit: cover;
        }

        .aro-model-thumb {
          width: 46px;
          height: 46px;
          border-radius: 10px;
        }

        .aro-model-photo {
          width: 100%;
          aspect-ratio: 3 / 4;
          border-radius: 13px;
        }

        .aro-model-carousel {
          display: grid;
          grid-auto-columns: minmax(132px, 1fr);
          grid-auto-flow: column;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 4px;
          scroll-snap-type: x mandatory;
        }

        .aro-model-card {
          display: grid;
          min-width: 132px;
          gap: 6px;
          scroll-snap-align: start;
        }

        .aro-model-card strong,
        .aro-model-card small,
        .aro-model-card em {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .aro-model-card small,
        .aro-model-card em {
          color: var(--admin-muted);
          font-size: 11px;
          font-style: normal;
        }

        .aro-calendar-mini {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 8px;
          align-items: center;
        }

        .aro-calendar-mini strong,
        .aro-calendar-mini a {
          display: inline-flex;
          min-height: 34px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          color: var(--admin-text);
          font-size: 12px;
          font-weight: 800;
        }

        .aro-calendar-mini strong,
        .aro-calendar-mini a.muted {
          color: rgba(223, 235, 255, 0.38);
        }

        .aro-calendar-mini a.today {
          background: var(--admin-blue);
          color: #ffffff;
          box-shadow: 0 0 28px rgba(45, 133, 255, 0.36);
        }

        .aro-calendar-mini a.has-event:not(.today) {
          border: 1px solid rgba(105, 180, 255, 0.52);
        }

        .aro-calendar-mini a.has-event::after {
          width: 4px;
          height: 4px;
          border-radius: 999px;
          background: var(--admin-blue-strong);
          content: "";
          transform: translate(3px, 12px);
        }

        .aro-widget-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 4px;
          color: var(--admin-muted);
          font-size: 12px;
        }

        .aro-widget-footer strong,
        .aro-finance-list strong {
          color: var(--admin-success);
        }

        .aro-world-map {
          position: relative;
          min-height: 205px;
          overflow: hidden;
          border-radius: 14px;
          background: rgba(3, 25, 67, 0.22);
        }

        .aro-world-map svg {
          width: 100%;
          height: 205px;
          fill: none;
          stroke: rgba(132, 190, 255, 0.22);
          stroke-width: 0.7;
        }

        .aro-map-point {
          position: absolute;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          max-width: 132px;
          border: 1px solid var(--admin-border);
          border-radius: 10px;
          background: rgba(4, 28, 74, 0.82);
          padding: 6px 8px;
          transform: translate(-50%, -50%);
          backdrop-filter: blur(16px);
        }

        .aro-map-point svg {
          width: 15px;
          height: 15px;
          fill: var(--admin-blue);
          stroke: var(--admin-blue);
        }

        .aro-map-point strong,
        .aro-map-point small {
          display: block;
          overflow: hidden;
          color: var(--admin-text);
          font-size: 11px;
          line-height: 1.1;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .aro-map-point small {
          color: var(--admin-muted);
          font-size: 10px;
        }

        .aro-world-map p,
        .aro-empty {
          color: var(--admin-muted);
          font-size: 12px;
          line-height: 1.5;
        }

        .aro-world-map p {
          position: absolute;
          right: 14px;
          bottom: 12px;
          left: 14px;
          margin: 0;
          text-align: center;
        }

        .aro-shortcuts {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .aro-shortcut {
          display: grid;
          min-height: 86px;
          place-items: center;
          gap: 8px;
          border: 1px solid var(--admin-border);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.055);
          color: var(--admin-text);
          font-size: 12px;
          font-weight: 800;
          padding: 12px;
          text-align: center;
        }

        .aro-shortcut svg,
        .aro-alert-list svg {
          width: 22px;
          height: 22px;
        }

        .aro-country-dot {
          color: var(--admin-blue-strong);
          font-size: 28px;
          line-height: 1;
        }

        @media (max-width: 1320px) {
          .aro-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .span-3,
          .span-4,
          .span-5 {
            grid-column: span 6;
          }
        }

        @media (max-width: 820px) {
          .aro-dashboard-hero {
            align-items: start;
            flex-direction: column;
          }

          .aro-dashboard-grid {
            grid-template-columns: 1fr;
          }

          .span-3,
          .span-4,
          .span-5 {
            grid-column: 1;
          }
        }

        @media (max-width: 560px) {
          .aro-metrics {
            grid-template-columns: 1fr;
          }

          .aro-widget,
          .aro-metric-card {
            padding: 13px;
          }

          .aro-job-row,
          .aro-measure-row {
            grid-template-columns: 42px minmax(0, 1fr);
          }

          .aro-job-row em,
          .aro-measure-row em {
            grid-column: 2;
            justify-self: start;
          }

          .aro-shortcuts {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}

function WidgetHeading({
  actions,
  href,
  index,
  title
}: {
  actions?: ReactNode;
  href?: string;
  index: number;
  title: string;
}) {
  return (
    <header className="aro-widget-heading">
      <div>
        <span className="index">{index}</span>
        <h2>{title}</h2>
      </div>
      {actions ? (
        <span className="aro-widget-actions">{actions}</span>
      ) : href ? (
        <Link href={href}>Ver todos</Link>
      ) : null}
    </header>
  );
}

function EmptyState({ href, text }: { href?: string; text: string }) {
  const content = <p className="aro-empty">{text}</p>;
  return href ? <Link href={href}>{content}</Link> : content;
}

function Shortcut({
  href,
  icon: Icon,
  label
}: {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
}) {
  return (
    <Link className="aro-shortcut" href={href}>
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

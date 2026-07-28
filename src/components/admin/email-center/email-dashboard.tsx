/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  ArrowRight,
  BarChart3,
  Clock3,
  Eye,
  FileText,
  Inbox,
  Layers3,
  Mail,
  RefreshCw,
  Reply,
  Send,
  Star,
  UsersRound
} from "@/components/admin/admin-icons";
import { adminInitials } from "@/components/admin/admin-ui";
import { EmailStatusBadge } from "@/components/admin/email-center/email-status-badge";
import type {
  EmailCenterActivity,
  EmailCenterDashboard,
  EmailCenterFeatured,
  EmailCenterMetric,
  EmailCenterTopModel,
  EmailPerformanceSegment
} from "@/lib/communications/email-center";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

function relativeTime(value: string) {
  const deltaSeconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 365 * 24 * 60 * 60],
    ["month", 30 * 24 * 60 * 60],
    ["day", 24 * 60 * 60],
    ["hour", 60 * 60],
    ["minute", 60]
  ];

  for (const [unit, seconds] of ranges) {
    if (Math.abs(deltaSeconds) >= seconds) {
      return formatter.format(Math.round(deltaSeconds / seconds), unit);
    }
  }
  return "agora";
}

function comparison(metric: EmailCenterMetric) {
  if (metric.current === 0 && metric.previous === 0) {
    return { label: "Sem comparação disponível", tone: "neutral" };
  }
  if (metric.previous === 0) {
    return { label: "Primeiros registros no período", tone: "positive" };
  }
  const change = Math.round(((metric.current - metric.previous) / metric.previous) * 100);
  if (change === 0) return { label: "Estável vs. período anterior", tone: "neutral" };
  return {
    label: `${change > 0 ? "+" : ""}${change}% vs. período anterior`,
    tone: change > 0 ? "positive" : "negative"
  };
}

export function EmailMetricCard({
  href,
  icon: Icon,
  label,
  metric
}: {
  href: string;
  icon: IconComponent;
  label: string;
  metric: EmailCenterMetric;
}) {
  const change = comparison(metric);
  return (
    <Link className="email-metric-card" href={href}>
      <span className="email-metric-icon"><Icon aria-hidden="true" /></span>
      <span className="email-metric-content">
        <small>{label}</small>
        <strong>{formatNumber(metric.current)}</strong>
        <em className={`is-${change.tone}`}>{change.label}</em>
      </span>
      <ArrowRight aria-hidden="true" className="email-metric-arrow" />
    </Link>
  );
}

export function EmailResponsesMetricCard() {
  return (
    <article className="email-metric-card is-unavailable">
      <span className="email-metric-icon"><Reply aria-hidden="true" /></span>
      <span className="email-metric-content">
        <small>Respostas recebidas</small>
        <strong>—</strong>
        <em>Sincronização não ativada</em>
      </span>
      <Link
        aria-label="Configurar integração para respostas"
        className="email-metric-settings"
        href="/admin/email/settings"
        title="A ARO não lê respostas sem autorização adicional e explícita."
      >
        Configurar
      </Link>
    </article>
  );
}

export function EmailActivityRow({ activity }: { activity: EmailCenterActivity }) {
  const Icon =
    activity.kind === "presentation" ? Eye : activity.kind === "model_update" ? RefreshCw : Mail;
  return (
    <Link className="email-activity-row" href={activity.href}>
      <span className={`email-activity-avatar is-${activity.kind}`}>
        <Icon aria-hidden="true" />
      </span>
      <span className="email-activity-copy">
        <strong>{activity.recipient}</strong>
        <span>{activity.title}</span>
        <small>{activity.subtitle} · Por {activity.sender} · {relativeTime(activity.occurred_at)}</small>
      </span>
      <EmailStatusBadge status={activity.status} />
    </Link>
  );
}

export function EmailEmptyState({
  action,
  description,
  icon: Icon = Inbox,
  title
}: {
  action?: { href: string; label: string };
  description: string;
  icon?: IconComponent;
  title: string;
}) {
  return (
    <div className="email-empty-state">
      <span><Icon aria-hidden="true" /></span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action ? <Link className="button secondary" href={action.href}>{action.label}</Link> : null}
    </div>
  );
}

export function EmailActivityCard({ activity }: { activity: EmailCenterActivity[] }) {
  return (
    <section className="email-panel email-activity-card">
      <header>
        <div>
          <span className="email-section-index">01</span>
          <h2>Atividade recente</h2>
        </div>
        <Link href="/admin/email/activity">Ver todas</Link>
      </header>
      {activity.length ? (
        <div className="email-activity-list">
          {activity
            .slice(0, 8)
            .map((item) => <EmailActivityRow activity={item} key={`${item.kind}:${item.id}`} />)}
        </div>
      ) : (
        <EmailEmptyState
          action={{ href: "/admin/email/compose", label: "Novo e-mail" }}
          description="Envios, acessos e atualizações aparecerão aqui conforme acontecerem."
          title="Nenhuma atividade neste período"
        />
      )}
      <Link className="email-panel-footer-link" href="/admin/email/activity">
        Ver todas as atividades <ArrowRight aria-hidden="true" />
      </Link>
    </section>
  );
}

const segmentColors: Record<EmailPerformanceSegment["key"], string> = {
  failed: "var(--email-status-failed)",
  opened: "var(--email-status-opened)",
  pending: "var(--email-status-scheduled)",
  unopened: "var(--email-status-draft)"
};

export function EmailPerformanceChart({
  segments,
  total
}: {
  segments: EmailPerformanceSegment[];
  total: number;
}) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <section className="email-panel email-performance-card">
      <header>
        <div>
          <span className="email-section-index">02</span>
          <h2>Desempenho de e-mails</h2>
        </div>
        <span className="email-accuracy-note" title="Considerado aberto quando o destinatário acessa o link seguro da apresentação.">
          Métrica por link
        </span>
      </header>
      {total > 0 ? (
        <div className="email-performance-content">
          <div
            aria-label={`${formatNumber(total)} comunicações no período. ${segments
              .map((segment) => `${segment.label}: ${segment.count}`)
              .join(". ")}`}
            className="email-donut"
            role="img"
          >
            <svg aria-hidden="true" viewBox="0 0 120 120">
              <circle className="email-donut-track" cx="60" cy="60" r={radius} />
              {segments.map((segment) => {
                const length = total ? (segment.count / total) * circumference : 0;
                const offset = -currentOffset;
                currentOffset += length;
                return (
                  <circle
                    cx="60"
                    cy="60"
                    fill="none"
                    key={segment.key}
                    r={radius}
                    stroke={segmentColors[segment.key]}
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={offset}
                    strokeLinecap="butt"
                    strokeWidth="10"
                  />
                );
              })}
            </svg>
            <span>
              <strong>{formatNumber(total)}</strong>
              <small>registros</small>
            </span>
          </div>
          <div className="email-performance-legend">
            {segments.map((segment) => {
              const percentage = total ? Math.round((segment.count / total) * 100) : 0;
              return (
                <div key={segment.key}>
                  <span style={{ backgroundColor: segmentColors[segment.key] }} />
                  <small>{segment.label}</small>
                  <strong>{percentage}%</strong>
                  <em>{formatNumber(segment.count)}</em>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmailEmptyState
          description="O gráfico será preenchido com envios, acessos reais, falhas e agendamentos."
          icon={BarChart3}
          title="Ainda não há envios suficientes neste período"
        />
      )}
    </section>
  );
}

function FeaturedModelAvatars({ models }: Pick<EmailCenterFeatured, "models">) {
  if (!models.length) return null;
  return (
    <div className="email-featured-models" aria-label={`${models.length} modelos na apresentação`}>
      {models.map((model, index) => (
        <span key={`${model.id ?? model.name}:${index}`} title={model.name}>
          {model.image_url ? <img alt={model.name} src={model.image_url} /> : adminInitials(model.name)}
        </span>
      ))}
    </div>
  );
}

export function FeaturedEmailCard({ featured }: { featured: EmailCenterFeatured | null }) {
  return (
    <section className="email-panel email-featured-card">
      <header>
        <div>
          <span className="email-section-index">03</span>
          <h2>E-mail em destaque</h2>
        </div>
        <Link href="/admin/email/sent">Ver todos</Link>
      </header>
      {featured ? (
        <Link className="email-featured-body" href={featured.href}>
          <span className="email-featured-recipient">Para: {featured.recipient}</span>
          <div className="email-featured-title">
            <strong>{featured.subject}</strong>
            <EmailStatusBadge status={featured.status} />
          </div>
          <small>{formatDateTime(featured.sent_at)}</small>
          {featured.body_excerpt ? <p>{featured.body_excerpt}</p> : null}
          <div className="email-featured-meta">
            <span><strong>{featured.access_count}</strong><small>Acessos</small></span>
            <span><strong>{featured.model_count}</strong><small>Modelos</small></span>
            <FeaturedModelAvatars models={featured.models} />
          </div>
        </Link>
      ) : (
        <EmailEmptyState
          description="Aparecerá aqui o envio de apresentação com maior engajamento real."
          icon={Star}
          title="Nenhum e-mail em destaque"
        />
      )}
    </section>
  );
}

function ModelRow({ model }: { model: EmailCenterTopModel }) {
  const content = (
    <>
      <span className="email-model-avatar">
        {model.image_url ? <img alt={model.name} src={model.image_url} /> : adminInitials(model.name)}
      </span>
      <span>
        <strong>{model.name}</strong>
        <small>
          {formatNumber(model.presentation_count)} apresentação(ões) · {formatNumber(model.recipient_count)} destinatário(s)
        </small>
      </span>
      <ArrowRight aria-hidden="true" />
    </>
  );

  return model.id ? (
    <Link className="email-model-row" href={`/admin/models/${model.id}/edit`}>{content}</Link>
  ) : (
    <span className="email-model-row">{content}</span>
  );
}

export function TopPresentedModels({ models }: { models: EmailCenterTopModel[] }) {
  return (
    <section className="email-panel email-model-ranking">
      <header>
        <div>
          <span className="email-section-index">04</span>
          <h2>Modelos mais apresentados</h2>
        </div>
        <Link href="/admin/email/reports">Ranking completo</Link>
      </header>
      {models.length ? (
        <div>
          {models.map((model, index) => (
            <ModelRow key={`${model.id ?? model.name}:${index}`} model={model} />
          ))}
        </div>
      ) : (
        <EmailEmptyState
          description="O ranking considera somente apresentações enviadas e vinculadas a destinatários."
          icon={UsersRound}
          title="Ainda não há modelos apresentados"
        />
      )}
    </section>
  );
}

const quickActions: Array<{
  href: string;
  icon: IconComponent;
  label: string;
}> = [
  { href: "/admin/email/compose", icon: Send, label: "Novo e-mail" },
  { href: "/admin/presentations/new", icon: FileText, label: "Nova apresentação" },
  { href: "/admin/model-updates/new", icon: RefreshCw, label: "Solicitar atualização" },
  { href: "/admin/email/templates", icon: Layers3, label: "Templates" },
  { href: "/admin/email/reports", icon: BarChart3, label: "Relatórios" }
];

export function EmailQuickActions({ queue }: { queue: EmailCenterDashboard["queue"] }) {
  return (
    <section className="email-panel email-quick-actions">
      <header>
        <div>
          <span className="email-section-index">05</span>
          <h2>Ações rápidas</h2>
        </div>
        <Link href="/admin/email/queue">
          {queue.pending + queue.scheduled} na fila
        </Link>
      </header>
      <div className="email-quick-action-grid">
        {quickActions.map(({ href, icon: Icon, label }) => (
          <Link href={href} key={href}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </div>
      {queue.failed > 0 ? (
        <Link className="email-queue-warning" href="/admin/email/queue">
          <Clock3 aria-hidden="true" />
          <span><strong>{queue.failed} envio(s) precisam de atenção</strong><small>Abrir fila operacional</small></span>
          <ArrowRight aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  );
}

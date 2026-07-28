import Link from "next/link";
import {
  AlertTriangle,
  Eye,
  FileText,
  Send,
  UsersRound
} from "@/components/admin/admin-icons";
import {
  EmailActivityCard,
  EmailMetricCard,
  EmailPerformanceChart,
  EmailQuickActions,
  EmailResponsesMetricCard,
  FeaturedEmailCard,
  TopPresentedModels
} from "@/components/admin/email-center/email-dashboard";
import { EmailPeriodFilter } from "@/components/admin/email-center/email-period-filter";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-ui";
import {
  getEmailCenterDashboard,
  resolveEmailCenterPeriod
} from "@/lib/communications/email-center";

type EmailCenterSearchParams = Promise<{
  end?: string;
  period?: string;
  start?: string;
}>;

export const dynamic = "force-dynamic";

export default async function EmailCenterPage({
  searchParams
}: {
  searchParams: EmailCenterSearchParams;
}) {
  const query = await searchParams;
  const period = resolveEmailCenterPeriod(query);
  const dashboard = await getEmailCenterDashboard(period);

  return (
    <AdminPage className="email-center">
      <AdminPageHeader
        actions={
          <div className="email-primary-actions">
            <Link className="button" href="/admin/email/compose">
              <Send aria-hidden="true" />
              Novo e-mail
            </Link>
            <Link className="button secondary" href="/admin/presentations/new">
              <FileText aria-hidden="true" />
              Nova apresentação
            </Link>
            <EmailPeriodFilter period={period} />
          </div>
        }
        description="Gerencie comunicações, apresentações e atualizações de perfil."
        eyebrow="Comunicação"
        title="Email Center"
      >
        <nav aria-label="Atalhos do Email Center" className="email-center-header-copy">
          <Link href="/admin/email/queue">Ver fila</Link>
          <span aria-hidden="true">·</span>
          <Link href="/admin/email/sent">Enviados</Link>
          <span aria-hidden="true">·</span>
          <Link href="/admin/email/drafts">Rascunhos</Link>
          <span aria-hidden="true">·</span>
          <Link href="/admin/email/queue?status=scheduled">Agendados</Link>
          <span aria-hidden="true">·</span>
          <Link href="/admin/email/settings">Google Workspace</Link>
        </nav>
      </AdminPageHeader>

      {!dashboard.ready ? (
        <div className="email-schema-notice" role="status">
          <AlertTriangle aria-hidden="true" />
          <span>
            <strong>Analytics aguardando atualização do banco</strong>
            {dashboard.schema_message}
          </span>
        </div>
      ) : null}

      <section aria-label="Métricas do Email Center" className="email-metrics-grid">
        <EmailMetricCard
          href="/admin/email/sent"
          icon={Send}
          label="E-mails enviados"
          metric={dashboard.metrics.emails_sent}
        />
        <EmailMetricCard
          href="/admin/email/reports#models"
          icon={Eye}
          label="Modelos apresentados"
          metric={dashboard.metrics.models_presented}
        />
        <EmailMetricCard
          href="/admin/presentations"
          icon={UsersRound}
          label="Apresentações realizadas"
          metric={dashboard.metrics.presentations_sent}
        />
        <EmailResponsesMetricCard />
      </section>

      <div className="email-center-main-grid">
        <div className="email-center-column">
          <EmailActivityCard activity={dashboard.activity} />
          <TopPresentedModels models={dashboard.top_models} />
        </div>
        <div className="email-center-column">
          <EmailPerformanceChart
            segments={dashboard.performance.segments}
            total={dashboard.performance.total}
          />
          <FeaturedEmailCard featured={dashboard.featured} />
          <EmailQuickActions queue={dashboard.queue} />
        </div>
      </div>
    </AdminPage>
  );
}

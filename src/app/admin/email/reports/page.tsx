import Link from "next/link";
import { BarChart3, Eye, Send, UsersRound } from "@/components/admin/admin-icons";
import {
  EmailMetricCard,
  EmailPerformanceChart,
  EmailResponsesMetricCard,
  TopPresentedModels
} from "@/components/admin/email-center/email-dashboard";
import { EmailPeriodFilter } from "@/components/admin/email-center/email-period-filter";
import { EmailSubnav } from "@/components/admin/email-center/email-subnav";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-ui";
import {
  getEmailCenterDashboard,
  resolveEmailCenterPeriod
} from "@/lib/communications/email-center";

export const dynamic = "force-dynamic";

export default async function EmailReportsPage({
  searchParams
}: {
  searchParams: Promise<{ end?: string; period?: string; start?: string }>;
}) {
  const period = resolveEmailCenterPeriod(await searchParams);
  const dashboard = await getEmailCenterDashboard(period);

  return (
    <AdminPage className="email-center-subpage email-center">
      <AdminPageHeader
        actions={
          <>
            <EmailPeriodFilter period={period} />
            <Link className="button secondary" href="/admin/email">Visão geral</Link>
          </>
        }
        description="Métricas baseadas em envios registrados e acessos ao link seguro da apresentação."
        eyebrow="Email Center"
        title="Relatórios"
      />
      <EmailSubnav active="/admin/email/reports" />
      <section aria-label="Métricas do período" className="email-metrics-grid">
        <EmailMetricCard
          href="/admin/email/sent"
          icon={Send}
          label="E-mails enviados"
          metric={dashboard.metrics.emails_sent}
        />
        <EmailMetricCard
          href="#models"
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
      <div className="email-detail-grid">
        <EmailPerformanceChart
          segments={dashboard.performance.segments}
          total={dashboard.performance.total}
        />
        <section className="email-panel">
          <header>
            <div>
              <span className="email-section-index"><BarChart3 aria-hidden="true" /></span>
              <h2>Leitura dos dados</h2>
            </div>
          </header>
          <div className="admin-kv-grid">
            <span>Período</span><strong>{period.label}</strong>
            <span>Abertura</span><strong>Acesso ao link seguro</strong>
            <span>Respostas</span><strong>Indisponíveis sem escopo adicional</strong>
            <span>Tracking oculto</span><strong>Não utilizado</strong>
            <span>IP bruto</span><strong>Não armazenado</strong>
          </div>
        </section>
      </div>
      <div id="models">
        <TopPresentedModels models={dashboard.top_models} />
      </div>
    </AdminPage>
  );
}

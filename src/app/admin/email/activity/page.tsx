import Link from "next/link";
import {
  EmailActivityRow,
  EmailEmptyState
} from "@/components/admin/email-center/email-dashboard";
import { EmailPeriodFilter } from "@/components/admin/email-center/email-period-filter";
import { EmailSubnav } from "@/components/admin/email-center/email-subnav";
import {
  AdminPage,
  AdminPageHeader,
  AdminSection
} from "@/components/admin/admin-ui";
import {
  getEmailCenterDashboard,
  resolveEmailCenterPeriod
} from "@/lib/communications/email-center";

export const dynamic = "force-dynamic";

export default async function EmailActivityPage({
  searchParams
}: {
  searchParams: Promise<{ end?: string; period?: string; start?: string }>;
}) {
  const period = resolveEmailCenterPeriod(await searchParams);
  const dashboard = await getEmailCenterDashboard(period);

  return (
    <AdminPage className="email-center-subpage">
      <AdminPageHeader
        actions={
          <>
            <EmailPeriodFilter period={period} />
            <Link className="button" href="/admin/email/compose">Novo e-mail</Link>
          </>
        }
        description="Linha do tempo unificada de envios, acessos de apresentações e pedidos de atualização."
        eyebrow="Email Center"
        title="Atividade"
      />
      <EmailSubnav active="/admin/email/activity" />
      <AdminSection title={`Atividade · ${period.label}`} meta={`${dashboard.activity.length} evento(s)`}>
        {dashboard.activity.length ? (
          <div className="email-activity-list">
            {dashboard.activity.map((activity) => (
              <EmailActivityRow activity={activity} key={`${activity.kind}:${activity.id}`} />
            ))}
          </div>
        ) : (
          <EmailEmptyState
            description="Nenhum envio, acesso ou pedido de atualização foi registrado neste período."
            title="Sem atividade"
          />
        )}
      </AdminSection>
    </AdminPage>
  );
}

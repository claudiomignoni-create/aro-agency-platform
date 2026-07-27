import Link from "next/link";
import {
  AdminDataTable,
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminStat,
  AdminStatusPill
} from "@/components/admin/admin-ui";
import { getCommunicationSchemaState, listOutboundEmails } from "@/lib/communications/data";

export default async function EmailCenterPage() {
  const [schema, emails] = await Promise.all([
    getCommunicationSchemaState(),
    listOutboundEmails()
  ]);
  const counters = {
    draft: emails.filter((email) => email.status === "draft").length,
    failed: emails.filter((email) => email.status === "failed").length,
    queued: emails.filter((email) => ["queued", "scheduled", "retry_pending"].includes(email.status)).length,
    sent: emails.filter((email) => email.status === "sent").length
  };

  return (
    <AdminPage>
      <AdminPageHeader
        actions={
          <>
            <Link className="button" href="/admin/email/compose">Compor</Link>
            <Link className="button secondary" href="/admin/email/settings">Configurações</Link>
          </>
        }
        description="E-mails, rascunhos Gmail, fila segura e comunicações vinculadas a apresentações e atualizações."
        eyebrow="Comunicação"
        title="Email Center"
      />

      {!schema.ready ? (
        <AdminEmptyState
          description={schema.message}
          title="Schema de comunicação pendente."
        />
      ) : null}

      <section className="admin-stat-grid">
        <AdminStat label="Rascunhos" value={String(counters.draft)} />
        <AdminStat label="Fila" value={String(counters.queued)} />
        <AdminStat label="Enviados" value={String(counters.sent)} />
        <AdminStat label="Falhas" value={String(counters.failed)} />
      </section>

      <AdminSection title="Últimos e-mails" meta={`${emails.length} registro(s)`}>
        <AdminDataTable>
          <thead>
            <tr>
              <th>Destinatário</th>
              <th>Assunto</th>
              <th>Modo</th>
              <th>Status</th>
              <th>Criado em</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((email) => (
              <tr key={email.id}>
                <td data-label="Destinatário">
                  <strong>{email.recipient_name || email.recipient_email}</strong>
                  <small>{email.recipient_email}</small>
                </td>
                <td data-label="Assunto">{email.subject}</td>
                <td data-label="Modo">{email.mode}</td>
                <td data-label="Status"><AdminStatusPill>{email.status}</AdminStatusPill></td>
                <td data-label="Criado em">{new Date(email.created_at).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </AdminDataTable>
      </AdminSection>
    </AdminPage>
  );
}

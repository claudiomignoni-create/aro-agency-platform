import Link from "next/link";
import { AdminDataTable, AdminPage, AdminPageHeader, AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { listOutboundEmails } from "@/lib/communications/data";

export async function EmailListPage({ status, title }: { status?: string; title: string }) {
  const emails = await listOutboundEmails(status);

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href="/admin/email">Email Center</Link>}
        description="Mensagens registradas individualmente, sem expor destinatários entre si."
        eyebrow="Email Center"
        title={title}
      />
      <AdminSection title={title} meta={`${emails.length} registro(s)`}>
        <AdminDataTable>
          <thead>
            <tr>
              <th>Destinatário</th>
              <th>Assunto</th>
              <th>Modo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((email) => (
              <tr key={email.id}>
                <td data-label="Destinatário">{email.recipient_email}</td>
                <td data-label="Assunto">{email.subject}</td>
                <td data-label="Modo">{email.mode}</td>
                <td data-label="Status"><AdminStatusPill>{email.status}</AdminStatusPill></td>
              </tr>
            ))}
          </tbody>
        </AdminDataTable>
      </AdminSection>
    </AdminPage>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { EmailStatusBadge } from "@/components/admin/email-center/email-status-badge";
import { EmailSubnav } from "@/components/admin/email-center/email-subnav";
import {
  AdminDataTable,
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
  AdminSection
} from "@/components/admin/admin-ui";
import { listEmailCenterEmails } from "@/lib/communications/email-center";

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

export async function EmailListPage({
  active,
  feedback,
  headerActions,
  description,
  page = 1,
  statuses,
  title
}: {
  active: string;
  description: string;
  feedback?: ReactNode;
  headerActions?: ReactNode;
  page?: number;
  statuses?: string[];
  title: string;
}) {
  const result = await listEmailCenterEmails({ page, statuses });
  const totalPages = Math.max(1, Math.ceil(result.total / 40));
  const isQueue = active === "/admin/email/queue";

  return (
    <AdminPage className="email-center-subpage">
      <AdminPageHeader
        actions={
          <>
            <Link className="button" href="/admin/email/compose">Novo e-mail</Link>
            {headerActions}
          </>
        }
        description={description}
        eyebrow="Email Center"
        title={title}
      />
      <EmailSubnav active={active} />
      {feedback}
      <AdminSection title={title} meta={`${result.total} registro(s)`}>
        {result.items.length ? (
          <>
            <AdminDataTable>
              <thead>
                <tr>
                  <th>Destinatário</th>
                  <th>Assunto</th>
                  <th>Modo</th>
                  <th>Status</th>
                  <th>{isQueue ? "Programado / retry" : "Programado / enviado"}</th>
                  <th>Tentativas</th>
                  {isQueue ? <th>Erro sanitizado</th> : null}
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.items.map((email) => (
                  <tr key={email.id}>
                    <td data-label="Destinatário">
                      <span className="email-list-primary">
                        <strong>{email.recipient_name || email.recipient_email}</strong>
                        <small>{email.recipient_email}</small>
                      </span>
                    </td>
                    <td data-label="Assunto">
                      <Link className="email-row-link" href={`/admin/email/${email.id}`}>
                        {email.subject}
                      </Link>
                    </td>
                    <td data-label="Modo">{email.mode}</td>
                    <td data-label="Status"><EmailStatusBadge status={email.status} /></td>
                    <td data-label="Programado / enviado">
                      {dateTime(
                        email.sent_at ||
                          email.next_attempt_at ||
                          email.scheduled_at ||
                          email.created_at
                      )}
                    </td>
                    <td data-label="Tentativas">{email.attempt_count}</td>
                    {isQueue ? (
                      <td data-label="Erro sanitizado">
                        {email.error_message_sanitized ?? "—"}
                      </td>
                    ) : null}
                    <td data-label="Ação">
                      <Link className="button secondary" href={`/admin/email/${email.id}`}>
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminDataTable>
            {totalPages > 1 ? (
              <nav aria-label="Paginação" className="email-pagination">
                {result.page > 1 ? (
                  <Link className="button secondary" href={`${active}?page=${result.page - 1}`}>
                    Anterior
                  </Link>
                ) : null}
                <span>Página {result.page} de {totalPages}</span>
                {result.page < totalPages ? (
                  <Link className="button secondary" href={`${active}?page=${result.page + 1}`}>
                    Próxima
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        ) : (
          <AdminEmptyState
            action={<Link className="button" href="/admin/email/compose">Criar comunicação</Link>}
            description="A lista será atualizada somente com comunicações reais registradas pelo sistema."
            title={`Nenhum registro em ${title.toLowerCase()}`}
          />
        )}
      </AdminSection>
    </AdminPage>
  );
}

import Link from "next/link";
import {
  getEmailSettings,
  listEmailOutbox,
  listEmailTemplates
} from "@/lib/email";
import { listAdminNotifications } from "@/lib/notifications";

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

const statusLabels: Record<string, string> = {
  canceled: "Cancelado",
  failed: "Erro",
  pending: "Pendente",
  sent: "Enviado"
};

export default async function AdminNotificationsPage() {
  const [notifications, outbox, templates, settings] = await Promise.all([
    listAdminNotifications(),
    listEmailOutbox(),
    listEmailTemplates(),
    getEmailSettings()
  ]);
  const pendingEmails = outbox.filter((email) => email.status === "pending");
  const failedEmails = outbox.filter((email) => email.status === "failed");
  const sentEmails = outbox.filter((email) => email.status === "sent");

  return (
    <div className="stack notifications-page">
      <div className="grid stats-grid">
        <section className="mini-panel">
          <span className="eyebrow">Notificações</span>
          <strong>{notifications.length}</strong>
        </section>
        <section className="mini-panel">
          <span className="eyebrow">Fila de e-mail</span>
          <strong>{pendingEmails.length}</strong>
        </section>
        <section className="mini-panel">
          <span className="eyebrow">Enviados</span>
          <strong>{sentEmails.length}</strong>
        </section>
        <section className="mini-panel">
          <span className="eyebrow">Erros</span>
          <strong>{failedEmails.length}</strong>
        </section>
      </div>

      <section className="panel stack">
        <div className="actions spread">
          <div>
            <span className="eyebrow">Configuração</span>
            <h2>Notificações e e-mails</h2>
            <p>
              Provider atual: <strong>{settings.provider}</strong>. O envio real
              permanece desativado até configurar um provider externo.
            </p>
          </div>
          <Link className="button secondary" href="/admin/models">
            Solicitar atualização de modelo
          </Link>
        </div>
      </section>

      <section className="panel stack">
        <div>
          <span className="eyebrow">Recentes</span>
          <h2>Notificações internas</h2>
        </div>
        {notifications.length ? (
          <div className="notification-list">
            {notifications.map((notification) => (
              <article className="notification-card" key={notification.id}>
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                </div>
                <div className="notification-meta">
                  <span className="badge">{notification.recipient_role}</span>
                  <span>{formatDate(notification.created_at)}</span>
                  <span>{notification.read_at ? "Lida" : "Não lida"}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Nenhuma notificação registrada ainda.</p>
        )}
      </section>

      <section className="panel stack">
        <div>
          <span className="eyebrow">Outbox</span>
          <h2>Fila de e-mails</h2>
        </div>
        {outbox.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Destinatário</th>
                  <th>Assunto</th>
                  <th>Status</th>
                  <th>Provider</th>
                  <th>Criado</th>
                </tr>
              </thead>
              <tbody>
                {outbox.map((email) => (
                  <tr key={email.id}>
                    <td>
                      <strong>
                        {email.recipient_name ?? email.recipient_email}
                      </strong>
                      <br />
                      <span className="muted">{email.recipient_email}</span>
                    </td>
                    <td>
                      {email.subject}
                      {email.error_message ? (
                        <>
                          <br />
                          <span className="muted">{email.error_message}</span>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <span className="badge">
                        {statusLabels[email.status] ?? email.status}
                      </span>
                    </td>
                    <td>{email.provider}</td>
                    <td>{formatDate(email.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Nenhum e-mail na fila ainda.</p>
        )}
      </section>

      <section className="panel stack">
        <div>
          <span className="eyebrow">Templates</span>
          <h2>Modelos ativos</h2>
        </div>
        <div className="template-grid">
          {templates.map((template) => (
            <article className="template-card" key={template.id}>
              <span className="eyebrow">{template.key}</span>
              <strong>{template.name}</strong>
              <p>{template.subject}</p>
            </article>
          ))}
        </div>
      </section>

      <style>{`
        .notifications-page .panel h2 {
          font-size: 1.35rem;
          line-height: 1.2;
          margin-bottom: 0.4rem;
        }

        .notification-list,
        .template-grid {
          display: grid;
          gap: 0.75rem;
        }

        .template-grid {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .notification-card,
        .template-card {
          border: 1px solid color-mix(in srgb, #86c8ff 18%, var(--line));
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.045);
          padding: 0.9rem;
        }

        .notification-card {
          align-items: start;
          display: grid;
          gap: 0.75rem;
          grid-template-columns: minmax(0, 1fr) auto;
        }

        .notification-card p,
        .template-card p {
          font-size: 0.86rem;
          line-height: 1.5;
          margin: 0.25rem 0 0;
        }

        .notification-meta {
          align-items: flex-end;
          color: var(--muted);
          display: grid;
          font-size: 0.78rem;
          gap: 0.35rem;
          justify-items: end;
          min-width: 8rem;
        }

        @media (max-width: 640px) {
          .notification-card {
            grid-template-columns: 1fr;
          }

          .notification-meta {
            align-items: start;
            justify-items: start;
          }
        }
      `}</style>
    </div>
  );
}

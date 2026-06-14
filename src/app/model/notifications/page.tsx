import Link from "next/link";
import { listCurrentUserNotifications } from "@/lib/notifications";
import { markNotificationReadAction } from "./actions";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function ModelNotificationsPage() {
  const notifications = await listCurrentUserNotifications(60);

  return (
    <div className="stack model-notifications-page">
      <section className="panel stack">
        <div>
          <span className="eyebrow">Minha área</span>
          <h2>Notificações</h2>
          <p>Solicitações da agência, avisos de agenda e futuros trabalhos.</p>
        </div>
      </section>

      {notifications.length ? (
        <section className="notification-list">
          {notifications.map((notification) => (
            <article
              className={`panel notification-card ${
                notification.read_at ? "is-read" : ""
              }`}
              key={notification.id}
            >
              <div>
                <span className="eyebrow">
                  {formatDate(notification.created_at)}
                </span>
                <h2>{notification.title}</h2>
                <p>{notification.message}</p>
              </div>
              <div className="actions">
                {notification.action_url ? (
                  <Link className="button" href={notification.action_url}>
                    Abrir
                  </Link>
                ) : null}
                {notification.read_at ? (
                  <span className="badge">Lida</span>
                ) : (
                  <form
                    action={markNotificationReadAction.bind(
                      null,
                      notification.id
                    )}
                  >
                    <button className="button secondary" type="submit">
                      Marcar como lida
                    </button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel">
          <span className="eyebrow">Tudo certo</span>
          <h2>Nenhuma notificação</h2>
          <p>
            Quando a agência solicitar atualização ou enviar trabalho, aparece
            aqui.
          </p>
        </section>
      )}

      <style>{`
        .model-notifications-page .panel h2 {
          font-size: 1.35rem;
          line-height: 1.2;
          margin-bottom: 0.4rem;
        }

        .notification-list {
          display: grid;
          gap: 0.9rem;
        }

        .notification-card {
          align-items: center;
          display: grid;
          gap: 1rem;
          grid-template-columns: minmax(0, 1fr) auto;
        }

        .notification-card.is-read {
          opacity: 0.78;
        }

        .notification-card p {
          font-size: 0.9rem;
          line-height: 1.55;
          margin: 0;
        }

        @media (max-width: 640px) {
          .notification-card {
            align-items: stretch;
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

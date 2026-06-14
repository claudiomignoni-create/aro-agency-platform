import Link from "next/link";
import { listCurrentUserNotifications } from "@/lib/notifications";

function notificationLabel(count: number) {
  return count === 1 ? "1 nova solicitação" : `${count} novas solicitações`;
}

export default async function ModelPortalPage() {
  const notifications = await listCurrentUserNotifications(8);
  const unreadNotifications = notifications.filter(
    (notification) => !notification.read_at
  );

  return (
    <div className="grid">
      <section className="panel">
        <span className="eyebrow">Perfil</span>
        <h2>Completar cadastro</h2>
        <p>Edite dados, medidas e consentimentos.</p>
      </section>
      <section className="panel">
        <span className="eyebrow">Mídia</span>
        <h2>Enviar material</h2>
        <p>Fotos, polaroids e vídeos entram para revisão.</p>
      </section>
      <section className="panel">
        <span className="eyebrow">Agenda</span>
        <h2>Disponibilidade</h2>
        <p>Marque períodos disponíveis, indisponíveis ou tentativos.</p>
      </section>
      <section className="panel model-notification-panel">
        <span className="eyebrow">Notificações</span>
        <h2>{notificationLabel(unreadNotifications.length)}</h2>
        <p>Pedidos da agência, lembretes e futuros trabalhos aguardando resposta.</p>
        <Link className="button secondary" href="/model/notifications">
          Ver notificações
        </Link>
      </section>
      <style>{`
        .model-notification-panel {
          display: grid;
          gap: 0.8rem;
        }

        .model-notification-panel h2 {
          font-size: 1.45rem;
          line-height: 1.15;
          margin: 0;
        }

        .model-notification-panel p {
          font-size: 0.88rem;
          line-height: 1.55;
          margin: 0;
        }

        .model-notification-panel .button {
          justify-self: start;
        }
      `}</style>
    </div>
  );
}

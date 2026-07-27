import Link from "next/link";
import { MessageCircle } from "lucide-react";

export default function MessagesPage() {
  return (
    <div className="messages-page">
      <section className="aro-glass-card messages-panel">
        <MessageCircle aria-hidden="true" />
        <div>
          <span className="eyebrow">Messages</span>
          <h1>Messages</h1>
          <p>
            O módulo de mensagens está preparado para ativação futura. Por enquanto,
            alertas operacionais reais aparecem no sino e no Dashboard.
          </p>
          <div className="actions">
            <Link className="button" href="/admin">
              Voltar ao Dashboard
            </Link>
            <Link className="button secondary" href="/admin/requests">
              Ver solicitações
            </Link>
          </div>
        </div>
      </section>
      <style>{`
        .messages-page {
          display: grid;
          min-height: 54vh;
          place-items: center;
        }

        .messages-panel {
          display: grid;
          width: min(720px, 100%);
          grid-template-columns: 54px minmax(0, 1fr);
          gap: 16px;
          padding: 22px;
        }

        .messages-panel > svg {
          width: 42px;
          height: 42px;
          color: var(--admin-blue-strong);
        }

        .messages-panel h1 {
          margin: 0 0 10px;
          font-size: clamp(28px, 4vw, 44px);
        }

        .messages-panel p {
          margin-bottom: 18px;
          color: var(--admin-muted);
        }

        @media (max-width: 560px) {
          .messages-panel {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

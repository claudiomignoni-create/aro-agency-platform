import Link from "next/link";
import { AIAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { requireRole } from "@/lib/auth";
import { listModels } from "@/lib/models";

export default async function AdminPage() {
  const profile = await requireRole(["admin"]);
  const models = await listModels();
  const pendingModels = models.filter(
    (model) => model.status === "pending_review"
  ).length;
  const publishedModels = models.filter((model) => model.is_published).length;

  return (
    <div className="stack">
      <div className="grid stats-grid">
        <section className="mini-panel">
          <span className="eyebrow">Modelos pendentes</span>
          <strong>{pendingModels}</strong>
        </section>
        <section className="mini-panel">
          <span className="eyebrow">Modelos publicados</span>
          <strong>{publishedModels}</strong>
        </section>
        <section className="mini-panel">
          <span className="eyebrow">Total de modelos</span>
          <strong>{models.length}</strong>
        </section>
        <section className="mini-panel">
          <span className="eyebrow">Pedidos novos</span>
          <strong>0</strong>
        </section>
      </div>
      <section className="panel stack">
        <div>
          <span className="eyebrow">Cadastro360</span>
          <h2>Modelos</h2>
          <p>
            Acesse a lista de modelos, crie perfis ou revise cadastros
            pendentes.
          </p>
        </div>
        <div className="actions">
          <Link className="button" href="/admin/models/new">
            Criar modelo
          </Link>
          <Link className="button secondary" href="/admin/models">
            Ver modelos
          </Link>
        </div>
      </section>
      <AIAssistantPanel role={profile.role} />
      <style>{`
        .stack {
          max-width: 100%;
          min-width: 0;
        }

        .mini-panel,
        .panel {
          background:
            linear-gradient(180deg, rgba(10, 30, 55, 0.88), rgba(13, 38, 68, 0.72)),
            color-mix(in srgb, #102a4a 86%, var(--panel));
          border-color: color-mix(in srgb, #6eb6ff 20%, transparent);
          box-shadow: 0 16px 42px rgba(0, 0, 0, 0.14);
        }

        .panel h2 {
          font-size: 1.35rem;
          line-height: 1.2;
          margin-bottom: 0.4rem;
        }

        .panel p {
          font-size: 0.86rem;
          line-height: 1.5;
        }

        @media (max-width: 430px) {
          .panel,
          .mini-panel {
            padding: 0.9rem;
          }
        }
      `}</style>
    </div>
  );
}

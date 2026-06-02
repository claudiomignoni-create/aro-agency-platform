import Link from "next/link";
import { listModels } from "@/lib/models";

export default async function AdminPage() {
  const models = await listModels();
  const pendingModels = models.filter(
    (model) => model.status === "pending_review"
  ).length;
  const publishedModels = models.filter((model) => model.is_published).length;

  return (
    <div className="stack">
      <section className="panel stack">
        <div>
          <span className="eyebrow">Admin</span>
          <h2>Operação da agência</h2>
          <p>
            Crie novos perfis, revise pendências ou abra a lista completa de
            modelos.
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
      <details className="panel stack">
        <summary className="button secondary">Resumo do painel</summary>
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
      </details>
    </div>
  );
}

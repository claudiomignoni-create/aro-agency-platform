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
    </div>
  );
}

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
      <div className="grid">
        <section className="panel">
          <span className="eyebrow">Modelos pendentes</span>
          <h2>{pendingModels}</h2>
        </section>
        <section className="panel">
          <span className="eyebrow">Modelos publicados</span>
          <h2>{publishedModels}</h2>
        </section>
        <section className="panel">
          <span className="eyebrow">Total de modelos</span>
          <h2>{models.length}</h2>
        </section>
        <section className="panel">
          <span className="eyebrow">Pedidos novos</span>
          <h2>0</h2>
        </section>
      </div>
      <section className="panel stack">
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

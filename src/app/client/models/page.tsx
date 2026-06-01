import Link from "next/link";
import { listClientModelProfiles } from "@/lib/models";

export default async function ClientModelsPage() {
  const models = await listClientModelProfiles();

  return (
    <div className="stack">
      <section className="panel">
        <div className="actions spread">
          <div>
            <span className="eyebrow">Cliente</span>
            <h2>Modelos aprovados</h2>
          </div>
          <Link className="button secondary" href="/client">
            Voltar
          </Link>
        </div>
      </section>
      <section className="grid">
        {models.map((model) => (
          <article className="panel stack" key={model.id}>
            <div>
              <span className="eyebrow">{model.model_type ?? "Modelo"}</span>
              <h3>{model.stage_name}</h3>
              <p className="muted">
                {[model.current_city, model.current_country]
                  .filter(Boolean)
                  .join(", ") || "-"}
              </p>
            </div>
            <div className="compact-list">
              <span>{model.height_cm ? `${model.height_cm} cm` : "-"}</span>
              <span>
                {[
                  model.bust_cm,
                  model.waist_cm,
                  model.hips_cm
                ]
                  .filter(Boolean)
                  .join(" / ") || "-"}
              </span>
              <span>{model.shoe_size_br ? `BR ${model.shoe_size_br}` : "-"}</span>
            </div>
            <p>{model.categories.join(", ") || "Sem categoria"}</p>
          </article>
        ))}
        {models.length === 0 ? (
          <section className="panel">
            <p>Nenhum modelo aprovado disponível.</p>
          </section>
        ) : null}
      </section>
    </div>
  );
}

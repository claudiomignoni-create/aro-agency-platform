import Link from "next/link";
import { getModelPortalData } from "@/lib/model-portal";

export default async function ModelPortalPage() {
  const data = await getModelPortalData();
  const modelName = data.model?.stage_name || data.model?.display_name || "Modelo ARO";

  return (
    <div className="model-portal-home">
      <section className="model-portal-hero">
        <span className="eyebrow">ARO Model Portal</span>
        <h1>{modelName}</h1>
        <p>Perfil, materiais, agenda, viagens e pagamentos em um espaço seguro da ARO.</p>
        <div className="model-progress" aria-label={`Cadastro ${data.completion}% completo`}>
          <span style={{ width: `${data.completion}%` }} />
        </div>
        <small>{data.completion}% do cadastro operacional preenchido</small>
      </section>

      {data.alerts.length ? (
        <section className="model-portal-alerts">
          {data.alerts.map((alert) => (
            <article key={`${alert.title}-${alert.meta}`}>
              <strong>{alert.title}</strong>
              {alert.meta ? <span>{alert.meta}</span> : null}
            </article>
          ))}
        </section>
      ) : null}

      <section className="model-portal-grid">
        {[
          ["Atualizações", `${data.requests.length} solicitação(ões)`, "/model/requests"],
          ["Perfil e medidas", `${data.measurements.length} medida(s)`, "/model/profile"],
          ["Materiais", `${data.materials.length} material(is)`, "/model/materials"],
          ["Trabalhos", `${data.jobs.length} registro(s)`, "/model/jobs"],
          ["Travel", `${data.travel.length} viagem(ns)`, "/model/travel"],
          ["Pagamentos", `${data.payments.length} lançamento(s)`, "/model/payments"]
        ].map(([title, description, href]) => (
          <Link className="model-portal-card" href={href} key={href}>
            <strong>{title}</strong>
            <span>{description}</span>
          </Link>
        ))}
      </section>
      <style>{`
        .model-portal-home {
          display: grid;
          gap: 14px;
        }

        .model-portal-hero,
        .model-portal-card,
        .model-portal-alerts article {
          border: 1px solid rgba(153, 202, 255, 0.22);
          border-radius: 16px;
          background:
            radial-gradient(circle at 20% 0%, rgba(45, 133, 255, 0.2), transparent 18rem),
            rgba(9, 45, 104, 0.42);
          color: #f8fbff;
          padding: 16px;
          backdrop-filter: blur(16px);
        }

        .model-portal-hero h1 {
          margin: 6px 0;
          font-size: 28px;
          line-height: 1.1;
        }

        .model-portal-hero p,
        .model-portal-hero small,
        .model-portal-card span,
        .model-portal-alerts span {
          color: rgba(248, 251, 255, 0.72);
          font-size: 12px;
          line-height: 1.5;
        }

        .model-progress {
          height: 8px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
        }

        .model-progress span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #69b4ff;
        }

        .model-portal-alerts {
          display: grid;
          gap: 8px;
        }

        .model-portal-alerts article {
          display: grid;
          gap: 4px;
        }

        .model-portal-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .model-portal-card {
          display: grid;
          gap: 6px;
          text-decoration: none;
        }

        @media (max-width: 760px) {
          .model-portal-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

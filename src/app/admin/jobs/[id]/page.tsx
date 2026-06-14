import Link from "next/link";
import { notFound } from "next/navigation";
import { dateKeyFromIso, formatDatePtBr } from "@/lib/calendar";
import {
  formatMoney,
  getAdminJob,
  jobTitle,
  jobTypeLabel,
  modelDisplayName,
  modelInitials,
  modelLocation,
  modelMeasurements
} from "@/lib/jobs";
import { createModelMainImageUrls } from "@/lib/models";
import {
  approveJobForModelAction,
  updateJobStatusAction
} from "../actions";

type AdminJobDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const statusActions = [
  ["Aprovar solicitação", "agency_approved"],
  ["Recusar solicitação", "declined"],
  ["Confirmar trabalho", "confirmed"],
  ["Cancelar trabalho", "canceled"],
  ["Marcar como finalizado", "completed"],
  ["Liberar para o modelo responder", "waiting_model"]
] as const;

export default async function AdminJobDetailPage({
  params
}: AdminJobDetailPageProps) {
  const { id } = await params;
  const job = await getAdminJob(id);

  if (!job) {
    notFound();
  }

  const modelImageUrls = await createModelMainImageUrls(
    job.job_models
      .map((jobModel) => jobModel.model)
      .filter((model): model is NonNullable<typeof model> => Boolean(model))
  );
  const rows = [
    ["Cliente", job.client?.company_name ?? "-"],
    ["Tipo", jobTypeLabel(job.type)],
    ["Status geral", job.status],
    ["Data", formatDatePtBr(dateKeyFromIso(job.start_at))],
    ["Chegada", new Date(job.call_time ?? job.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })],
    ["Término previsto", job.end_at ? new Date(job.end_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-"],
    ["Endereço", [job.location_name, job.address_line, job.city, job.country].filter(Boolean).join(" · ") || "-"],
    ["Valor informado", formatMoney(job.client_budget)],
    ["Valor final +20%", formatMoney(job.final_amount)],
    ["Utilização", [job.usage_term_months ? `${job.usage_term_months} meses` : null, job.usage_scope, job.usage_countries.join(", ")].filter(Boolean).join(" · ") || "-"]
  ];

  return (
    <div className="stack">
      <section className="panel job-detail-hero">
        <div>
          <span className="eyebrow">Trabalho</span>
          <h2>{jobTitle(job)}</h2>
          <p>{job.brand_name || job.project_name || "Sem marca informada"}</p>
        </div>
        <div className="actions">
          <Link className="button secondary" href="/admin/jobs">
            Voltar
          </Link>
          <Link className="button secondary" href={`/admin/jobs/new?type=${job.type}`}>
            Duplicar fluxo
          </Link>
        </div>
      </section>

      <section className="grid detail-grid">
        <article className="panel stack">
          <span className="eyebrow">Dados completos</span>
          <dl className="detail-list">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </article>

        <article className="panel stack">
          <span className="eyebrow">Ações</span>
          <div className="job-action-grid">
            {statusActions.map(([label, status]) => (
              <form action={updateJobStatusAction.bind(null, job.id, status)} key={status}>
                <button className="button secondary" type="submit">
                  {label}
                </button>
              </form>
            ))}
          </div>
        </article>
      </section>

      <section className="panel stack">
        <span className="eyebrow">Modelos vinculados</span>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Status do modelo</th>
                <th>Resposta</th>
                <th>Valor</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {job.job_models.map((jobModel) => (
                <tr key={jobModel.id}>
                  <td>
                    <div className="model-summary">
                      {jobModel.model && modelImageUrls[jobModel.model.id] ? (
                        <img
                          alt={modelDisplayName(jobModel.model)}
                          src={modelImageUrls[jobModel.model.id]}
                        />
                      ) : (
                        <span className="model-summary-placeholder">
                          {modelInitials(jobModel.model)}
                        </span>
                      )}
                      <span>
                        <strong>{modelDisplayName(jobModel.model) || "-"}</strong>
                        <small>{modelLocation(jobModel.model) || "Praça não informada"}</small>
                        <small>{modelMeasurements(jobModel.model) || "Medidas não informadas"}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="status">{jobModel.status}</span>
                  </td>
                  <td>{jobModel.model_response_status}</td>
                  <td>{formatMoney(jobModel.final_amount ?? jobModel.fee_amount)}</td>
                  <td>
                    <div className="actions">
                      <form
                        action={approveJobForModelAction.bind(
                          null,
                          job.id,
                          jobModel.model_id
                        )}
                      >
                        <button className="button secondary" type="submit">
                          Liberar resposta
                        </button>
                      </form>
                      <Link
                        className="button secondary"
                        href={`/admin/jobs/new?modelId=${jobModel.model_id}&type=option`}
                      >
                        Colocar em opção
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {job.job_models.length === 0 ? (
          <p>Nenhum modelo vinculado a este trabalho.</p>
        ) : null}
      </section>

      <section className="grid detail-grid">
        <article className="panel stack">
          <span className="eyebrow">Briefing</span>
          <p>{job.brief || "Sem briefing informado."}</p>
          <p>{job.model_recommendations || "Sem recomendações para o modelo."}</p>
          <p>{job.model_must_bring || "Sem lista de itens para levar."}</p>
        </article>
        <article className="panel stack">
          <span className="eyebrow">Observações internas</span>
          <p>{job.internal_notes || "Sem observações internas."}</p>
          <span className="eyebrow">Histórico simples</span>
          <p>
            Criado em {formatDatePtBr(dateKeyFromIso(job.created_at))}. Última
            atualização em {formatDatePtBr(dateKeyFromIso(job.updated_at))}.
          </p>
        </article>
      </section>

      <style>{`
        .job-detail-hero {
          align-items: center;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
        }

        .detail-grid {
          grid-template-columns: minmax(0, 1.4fr) minmax(18rem, 0.8fr);
        }

        .detail-list {
          display: grid;
          gap: 0.65rem;
          margin: 0;
        }

        .detail-list div {
          border: 1px solid var(--line);
          border-radius: var(--radius);
          display: grid;
          gap: 0.25rem;
          padding: 0.7rem;
        }

        .detail-list dt {
          color: var(--muted);
          font-size: 0.68rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .detail-list dd {
          margin: 0;
        }

        .job-action-grid {
          display: grid;
          gap: 0.55rem;
        }

        .job-action-grid .button {
          width: 100%;
        }

        .model-summary {
          align-items: center;
          display: flex;
          gap: 0.65rem;
          min-width: 14rem;
        }

        .model-summary img,
        .model-summary-placeholder {
          border: 1px solid color-mix(in srgb, #86c8ff 18%, var(--line));
          border-radius: 8px;
          flex: 0 0 auto;
          height: 3rem;
          width: 3rem;
        }

        .model-summary img {
          object-fit: cover;
        }

        .model-summary-placeholder {
          align-items: center;
          background: rgba(255, 255, 255, 0.06);
          color: var(--muted-strong);
          display: inline-flex;
          font-size: 0.78rem;
          font-weight: 800;
          justify-content: center;
        }

        .model-summary > span:last-child {
          display: grid;
          gap: 0.15rem;
          min-width: 0;
        }

        .model-summary strong,
        .model-summary small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .model-summary small {
          color: var(--muted);
          font-size: 0.72rem;
        }

        @media (max-width: 780px) {
          .job-detail-hero {
            align-items: stretch;
            flex-direction: column;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

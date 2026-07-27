/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { dateKeyFromIso, formatDatePtBr } from "@/lib/calendar";
import {
  formatMoney,
  getAdminJob,
  jobModelStatusLabel,
  jobStatusLabel,
  jobTypeLabel,
  listJobDeletionStatuses,
  modelDisplayName,
  modelInitials,
  modelLocation,
  modelMeasurements,
  modelNames,
  smartJobTitle,
  type JobModelWithModel
} from "@/lib/jobs";
import { createModelMainImageUrls } from "@/lib/models";
import type { JobStatus } from "@/types/database";
import {
  approveJobForModelAction,
  updateJobStatusAction
} from "../../jobs/actions";
import { JobActionsMenu } from "../../jobs/job-actions-menu";

type AdminCalendarDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    notice?: string;
  }>;
};

const statusActions = [
  ["Aprovar solicitação", "agency_approved"],
  ["Recusar solicitação", "declined"],
  ["Confirmar evento", "confirmed"],
  ["Cancelar evento", "canceled"],
  ["Marcar como finalizado", "completed"]
] as const;

const noticeMessages: Record<string, string> = {
  model_sent: "Evento enviado para o modelo. Aguardando resposta.",
  status_agency_approved: "Solicitação aprovada.",
  status_canceled: "Evento cancelado.",
  status_completed: "Evento finalizado.",
  status_confirmed: "Evento confirmado.",
  status_declined: "Solicitação recusada.",
  updated: "Evento atualizado."
};

const errorMessages: Record<string, string> = {
  job_status_failed:
    "Não foi possível atualizar o status do evento. Tente novamente.",
  model_send_failed:
    "Não foi possível enviar o evento para o modelo. Tente novamente."
};

function statusActionState(currentStatus: JobStatus, nextStatus: JobStatus) {
  if (currentStatus === "canceled" || currentStatus === "completed") {
    return { disabled: true, label: null };
  }

  if (currentStatus === nextStatus) {
    return { disabled: true, label: jobStatusLabel(nextStatus) };
  }

  return { disabled: false, label: null };
}

function modelResponseLabel(jobModel: JobModelWithModel) {
  if (jobModel.status === "canceled") {
    return "Cancelado";
  }

  if (jobModel.status === "completed") {
    return "Finalizado";
  }

  if (jobModel.status === "confirmed") {
    return "Confirmado";
  }

  if (jobModel.model_response_status === "accepted") {
    return "Aceito pelo modelo";
  }

  if (jobModel.model_response_status === "declined") {
    return "Recusado pelo modelo";
  }

  if (jobModel.model_response_status === "waiting") {
    return "Aguardando resposta";
  }

  return "Não enviado";
}

function modelActionState(jobStatus: JobStatus, jobModel: JobModelWithModel) {
  if (jobStatus === "canceled" || jobModel.status === "canceled") {
    return { disabled: true, label: "Evento cancelado" };
  }

  if (jobStatus === "completed" || jobModel.status === "completed") {
    return { disabled: true, label: "Evento finalizado" };
  }

  if (jobModel.status === "confirmed") {
    return { disabled: true, label: "Confirmado" };
  }

  if (jobModel.model_response_status === "accepted") {
    return { disabled: true, label: "Aceito pelo modelo" };
  }

  if (jobModel.model_response_status === "declined") {
    return { disabled: true, label: "Recusado pelo modelo" };
  }

  if (jobModel.model_response_status === "waiting") {
    return { disabled: true, label: "Aguardando resposta" };
  }

  return { disabled: false, label: "Enviar para modelo aprovar" };
}

export default async function AdminCalendarDetailPage({
  params,
  searchParams
}: AdminCalendarDetailPageProps) {
  const { id } = await params;
  const { error, notice } = (await searchParams) ?? {};
  const job = await getAdminJob(id);

  if (!job) {
    notFound();
  }

  const modelImageUrls = await createModelMainImageUrls(
    job.job_models
      .map((jobModel) => jobModel.model)
      .filter((model): model is NonNullable<typeof model> => Boolean(model))
  );
  const deletionStatus = (await listJobDeletionStatuses([job])).get(job.id) ?? {
    canDelete: false,
    reason: "Não foi possível auditar dependências deste job."
  };
  const jobActionsDisabled =
    job.status === "canceled" || job.status === "completed";
  const rows = [
    ["Cliente", job.client?.company_name ?? "-"],
    ["Tipo", jobTypeLabel(job.type)],
    ["Status geral", jobStatusLabel(job.status)],
    ["Data", formatDatePtBr(dateKeyFromIso(job.start_at))],
    [
      "Chegada / início",
      new Date(job.call_time ?? job.start_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo"
      })
    ],
    [
      "Término previsto",
      job.end_at
        ? new Date(job.end_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Sao_Paulo"
          })
        : "-"
    ],
    [
      "Endereço",
      [job.location_name, job.address_line, job.city, job.country]
        .filter(Boolean)
        .join(" · ") || "-"
    ],
    ["Valor informado", formatMoney(job.client_budget)],
    ["Valor final +20%", formatMoney(job.final_amount)],
    [
      "Utilização",
      [
        job.usage_term_months ? `${job.usage_term_months} meses` : null,
        job.usage_scope,
        job.usage_countries.join(", ")
      ]
        .filter(Boolean)
        .join(" · ") || "-"
    ],
    ["Criado em", formatDatePtBr(dateKeyFromIso(job.created_at))],
    ["Atualizado em", formatDatePtBr(dateKeyFromIso(job.updated_at))]
  ];

  return (
    <div className="stack">
      {notice ? (
        <p className="toast">
          {noticeMessages[notice] ?? "Alteração aplicada com sucesso."}
        </p>
      ) : null}
      {error ? (
        <p className="toast error">
          {errorMessages[error] ??
            "Não foi possível concluir a ação. Tente novamente."}
        </p>
      ) : null}
      <section className="panel job-detail-hero">
        <div>
          <span className="eyebrow">Agenda</span>
          <h2>{smartJobTitle(job)}</h2>
          <p>{job.brand_name || job.project_name || "Evento sem marca informada"}</p>
        </div>
        <div className="actions">
          <Link className="button secondary" href="/admin/calendar">
            Voltar para Agenda
          </Link>
          <Link className="button secondary" href={`/admin/calendar/${job.id}/edit`}>
            Editar
          </Link>
          <Link
            className="button secondary"
            href={`/admin/calendar/new?type=${job.type}&date=${dateKeyFromIso(job.start_at)}`}
          >
            Duplicar fluxo
          </Link>
          <JobActionsMenu
            dateLabel={formatDatePtBr(dateKeyFromIso(job.start_at))}
            deletionStatus={deletionStatus}
            jobId={job.id}
            modelLabel={modelNames(job)}
            title={smartJobTitle(job)}
          />
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
          <span className="eyebrow">Status geral</span>
          <p className="action-hint">
            Ações incompatíveis ficam bloqueadas quando o evento está cancelado
            ou finalizado.
          </p>
          <div className="job-action-grid">
            {statusActions.map(([label, status]) => {
              const actionState = statusActionState(job.status, status);

              return (
                <form
                  action={updateJobStatusAction.bind(null, job.id, status)}
                  key={status}
                >
                  <button
                    className="button secondary"
                    disabled={actionState.disabled}
                    type="submit"
                  >
                    {actionState.label ?? label}
                  </button>
                </form>
              );
            })}
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
              {job.job_models.map((jobModel) => {
                const actionState = modelActionState(job.status, jobModel);

                return (
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
                          <strong>
                            {modelDisplayName(jobModel.model) || "-"}
                          </strong>
                          <small>
                            {modelLocation(jobModel.model) ||
                              "Praça não informada"}
                          </small>
                          <small>
                            {modelMeasurements(jobModel.model) ||
                              "Medidas não informadas"}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="status">
                        {jobModelStatusLabel(jobModel.status)}
                      </span>
                    </td>
                    <td>{modelResponseLabel(jobModel)}</td>
                    <td>
                      {formatMoney(
                        jobModel.final_amount ?? jobModel.fee_amount
                      )}
                    </td>
                    <td>
                      <div className="actions model-row-actions">
                        <form
                          action={approveJobForModelAction.bind(
                            null,
                            job.id,
                            jobModel.model_id
                          )}
                        >
                          <button
                            className="button model-approval-button"
                            disabled={actionState.disabled}
                            type="submit"
                          >
                            {actionState.label}
                          </button>
                        </form>
                        {jobActionsDisabled ? (
                          <button className="button secondary" disabled type="button">
                            Colocar em opção
                          </button>
                        ) : (
                          <Link
                            className="button secondary"
                            href={`/admin/calendar/new?modelId=${jobModel.model_id}&type=option`}
                          >
                            Colocar em opção
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {job.job_models.length === 0 ? (
          <p>Nenhum modelo vinculado a este evento.</p>
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
          <span className="eyebrow">Operação interna</span>
          <p>{job.internal_notes || "Sem observações internas."}</p>
          <span className="eyebrow">Financeiro futuro</span>
          <p>Os dados financeiros deste trabalho serão administrados no módulo Financeiro.</p>
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
          font-size: 0.78rem;
          min-height: 2.25rem;
          padding: 0.35rem 0.75rem;
          width: 100%;
        }

        .action-hint {
          font-size: 0.82rem;
          line-height: 1.45;
          margin: 0;
        }

        .model-row-actions {
          align-items: center;
          flex-wrap: nowrap;
        }

        .model-approval-button {
          min-width: 13.5rem;
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

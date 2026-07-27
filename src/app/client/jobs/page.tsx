import Link from "next/link";
import { dateKeyFromIso, formatDatePtBr } from "@/lib/calendar";
import {
  formatMoney,
  jobStatusLabel,
  jobTitle,
  jobTypeLabel,
  listClientJobs,
  modelDisplayName,
  modelInitials
} from "@/lib/jobs";
import { createModelMainImageUrls } from "@/lib/models";

type ClientJobsPageProps = {
  searchParams?: Promise<{
    created?: string;
  }>;
};

export default async function ClientJobsPage({ searchParams }: ClientJobsPageProps) {
  const params = (await searchParams) ?? {};
  const jobs = await listClientJobs();
  const modelImageUrls = await createModelMainImageUrls(
    jobs
      .flatMap((job) => job.job_models.map((jobModel) => jobModel.model))
      .filter((model): model is NonNullable<typeof model> => Boolean(model))
  );

  return (
    <div className="stack">
      {params.created ? (
        <p className="toast">Solicitação enviada para revisão da agência.</p>
      ) : null}
      <section className="panel">
        <div className="actions spread">
          <div>
            <span className="eyebrow">Cliente</span>
            <h2>Minha agenda</h2>
            <p>Solicitações, orçamentos e eventos vinculados ao seu perfil.</p>
          </div>
          <Link className="button" href="/client/jobs/new">
            Nova solicitação
          </Link>
        </div>
      </section>

      <section className="panel table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Projeto / marca</th>
              <th>Data</th>
              <th>Modelos solicitados</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{jobTitle(job)}</td>
                <td>{formatDatePtBr(dateKeyFromIso(job.start_at))}</td>
                <td>
                  <div className="model-chip-list">
                    {job.job_models.map((jobModel) => {
                      const model = jobModel.model;
                      const name = modelDisplayName(model) || "-";

                      return (
                        <span className="model-chip" key={jobModel.id}>
                          {model && modelImageUrls[model.id] ? (
                            <img alt={name} src={modelImageUrls[model.id]} />
                          ) : (
                            <span className="model-chip-placeholder">
                              {modelInitials(model)}
                            </span>
                          )}
                          <strong>{name}</strong>
                        </span>
                      );
                    })}
                    {job.job_models.length === 0 ? "-" : null}
                  </div>
                </td>
                <td>{jobTypeLabel(job.type)}</td>
                <td>
                  <span className="status">{jobStatusLabel(job.status)}</span>
                </td>
                <td>{formatMoney(job.final_amount ?? job.client_budget)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 ? (
          <p>Nenhuma solicitação na agenda ainda.</p>
        ) : null}
      </section>
      <style>{`
        .model-chip-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          min-width: 12rem;
        }

        .model-chip {
          align-items: center;
          border: 1px solid var(--line);
          border-radius: 8px;
          display: inline-flex;
          gap: 0.5rem;
          max-width: 13rem;
          min-width: 0;
          padding: 0.35rem 0.5rem 0.35rem 0.35rem;
        }

        .model-chip img,
        .model-chip-placeholder {
          border: 1px solid color-mix(in srgb, #86c8ff 18%, var(--line));
          border-radius: 7px;
          flex: 0 0 auto;
          height: 2.25rem;
          width: 2.25rem;
        }

        .model-chip img {
          object-fit: cover;
        }

        .model-chip-placeholder {
          align-items: center;
          background: rgba(255, 255, 255, 0.06);
          color: var(--muted-strong);
          display: inline-flex;
          font-size: 0.72rem;
          font-weight: 800;
          justify-content: center;
        }

        .model-chip strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

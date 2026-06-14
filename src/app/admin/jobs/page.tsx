import Link from "next/link";
import { listClients } from "@/lib/clients";
import { dateKeyFromIso, formatDatePtBr } from "@/lib/calendar";
import {
  countJobsByStatus,
  countJobsByType,
  formatMoney,
  jobTitle,
  jobTypeLabel,
  listAdminJobs,
  modelNames
} from "@/lib/jobs";
import { listModels } from "@/lib/models";
import type { JobStatus, JobType } from "@/types/database";

type AdminJobsPageProps = {
  searchParams?: Promise<{
    client?: string;
    date?: string;
    model?: string;
    status?: string;
    type?: string;
  }>;
};

const actions = [
  ["Novo trabalho", "/admin/jobs/new?type=job"],
  ["Novo casting", "/admin/jobs/new?type=casting"],
  ["Novo ensaio", "/admin/jobs/new?type=shoot"],
  ["Nova opção", "/admin/jobs/new?type=option"],
  ["Bloquear agenda", "/admin/jobs/new?type=manual_block"]
] as const;

const jobTypes: JobType[] = ["job", "casting", "shoot", "option", "manual_block"];
const jobStatuses: JobStatus[] = [
  "booker_review",
  "quote_requested",
  "agency_approved",
  "waiting_model",
  "confirmed",
  "completed",
  "canceled"
];

export default async function AdminJobsPage({ searchParams }: AdminJobsPageProps) {
  const filters = (await searchParams) ?? {};
  const [jobs, clients, models] = await Promise.all([
    listAdminJobs({
      clientId: filters.client,
      date: filters.date,
      modelId: filters.model,
      status: filters.status,
      type: filters.type
    }),
    listClients(),
    listModels()
  ]);
  const today = "2026-06-13";
  const nextWeek = jobs.filter((job) => {
    const dateKey = dateKeyFromIso(job.start_at);
    return dateKey >= today && dateKey <= "2026-06-20";
  });

  return (
    <div className="stack">
      <section className="panel jobs-hero">
        <div>
          <span className="eyebrow">Agenda + Trabalhos</span>
          <h2>Trabalhos</h2>
          <p>Painel operacional para revisão, opções, agenda e confirmações.</p>
        </div>
        <div className="actions">
          {actions.map(([label, href]) => (
            <Link className="button secondary" href={href} key={href}>
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid stats-grid">
        <article className="mini-panel">
          <span className="eyebrow">Em revisão</span>
          <strong>{countJobsByStatus(jobs, ["booker_review", "quote_requested"])}</strong>
        </article>
        <article className="mini-panel">
          <span className="eyebrow">Confirmados</span>
          <strong>{countJobsByStatus(jobs, ["confirmed"])}</strong>
        </article>
        <article className="mini-panel">
          <span className="eyebrow">Modelos em opção</span>
          <strong>{countJobsByType(jobs, ["option"])}</strong>
        </article>
        <article className="mini-panel">
          <span className="eyebrow">Próximos 7 dias</span>
          <strong>{nextWeek.length}</strong>
        </article>
      </section>

      <section className="panel stack">
        <form className="jobs-filter-form" method="get">
          <label>
            Data
            <input defaultValue={filters.date} name="date" type="date" />
          </label>
          <label>
            Cliente
            <select defaultValue={filters.client ?? ""} name="client">
              <option value="">Todos</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Modelo
            <select defaultValue={filters.model ?? ""} name="model">
              <option value="">Todos</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.stage_name || model.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select defaultValue={filters.type ?? ""} name="type">
              <option value="">Todos</option>
              {jobTypes.map((type) => (
                <option key={type} value={type}>
                  {jobTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select defaultValue={filters.status ?? ""} name="status">
              <option value="">Todos</option>
              {jobStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button className="button" type="submit">
              Filtrar
            </button>
            <Link className="button secondary" href="/admin/jobs">
              Limpar
            </Link>
          </div>
        </form>
      </section>

      <section className="panel table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Projeto / marca</th>
              <th>Cliente</th>
              <th>Modelos</th>
              <th>Status</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{formatDatePtBr(dateKeyFromIso(job.start_at))}</td>
                <td>{jobTypeLabel(job.type)}</td>
                <td>
                  <Link href={`/admin/jobs/${job.id}`}>
                    <strong>{jobTitle(job)}</strong>
                  </Link>
                </td>
                <td>{job.client?.company_name ?? "-"}</td>
                <td>{modelNames(job) || "-"}</td>
                <td>
                  <span className="status">{job.status}</span>
                </td>
                <td>{formatMoney(job.final_amount ?? job.client_budget)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 ? (
          <p className="muted">Nenhum trabalho encontrado para os filtros atuais.</p>
        ) : null}
      </section>

      <style>{`
        .jobs-hero {
          align-items: center;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
        }

        .jobs-filter-form {
          display: grid;
          gap: 0.8rem;
          grid-template-columns: repeat(5, minmax(9rem, 1fr)) auto;
        }

        .jobs-filter-form label {
          color: var(--muted-strong);
          display: grid;
          font-size: 0.78rem;
          font-weight: 800;
          gap: 0.4rem;
        }

        .jobs-filter-form input,
        .jobs-filter-form select {
          background: rgba(1, 16, 42, 0.36);
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          color: var(--foreground);
          min-height: 2.65rem;
          padding: 0 0.75rem;
        }

        .jobs-filter-form .actions {
          align-items: end;
        }

        @media (max-width: 980px) {
          .jobs-hero {
            align-items: stretch;
            flex-direction: column;
          }

          .jobs-filter-form {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .jobs-filter-form {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

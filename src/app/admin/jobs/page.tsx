import Link from "next/link";
import { Search } from "lucide-react";
import { getAccountingSchemaStatus, isMissingSchemaError } from "@/lib/accounting-schema";
import { formatDashboardDateTime } from "@/lib/admin-dashboard";
import { listClientOptions } from "@/lib/clients";
import {
  jobStatusLabel,
  jobStatusOptions,
  jobTitle,
  jobTypeLabel,
  jobTypeOptions,
  listAdminJobs,
  modelNames
} from "@/lib/jobs";
import { listModels } from "@/lib/models";
import { createClient } from "@/lib/supabase/server";

type AdminJobsPageProps = {
  searchParams?: Promise<{
    client?: string;
    dateFrom?: string;
    dateTo?: string;
    model?: string;
    q?: string;
    status?: string;
    type?: string;
  }>;
};

type PaymentStatusByJob = Record<string, string>;

function formatMoneyValue(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency"
  }).format(Number(value));
}

function hrefWith(
  filters: Awaited<NonNullable<AdminJobsPageProps["searchParams"]>>,
  updates: Record<string, string | undefined>
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...updates })) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `/admin/jobs${query ? `?${query}` : ""}`;
}

async function getPaymentStatusByJob(jobIds: string[]) {
  if (jobIds.length === 0) return {};
  const schema = await getAccountingSchemaStatus();
  if (!schema.ready) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_job_entries")
    .select("job_id, client_payment_status")
    .in("job_id", jobIds);

  if (error && isMissingSchemaError(error)) return {};
  if (error) throw error;

  return Object.fromEntries(
    (data ?? []).map((entry) => [entry.job_id, entry.client_payment_status])
  ) as PaymentStatusByJob;
}

export default async function AdminJobsPage({ searchParams }: AdminJobsPageProps) {
  const filters = (await searchParams) ?? {};
  const [jobs, clients, models] = await Promise.all([
    listAdminJobs({
      clientId: filters.client,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      limit: 250,
      modelId: filters.model,
      q: filters.q,
      status: filters.status,
      type: filters.type
    }),
    listClientOptions(),
    listModels()
  ]);
  const paymentStatusByJob = await getPaymentStatusByJob(jobs.map((job) => job.id));

  return (
    <div className="admin-jobs-page">
      <section className="aro-glass-card jobs-hero">
        <div>
          <span className="eyebrow">Jobs</span>
          <h1>Jobs</h1>
          <p>
            Visualizacao operacional de trabalhos, castings, fittings, opcoes,
            reunioes e viagens conectadas ao Calendar.
          </p>
        </div>
        <Link className="button" href="/admin/calendar/new?type=job">
          Novo Job
        </Link>
      </section>

      <section className="aro-glass-card jobs-filters">
        <form method="get">
          <label className="jobs-search">
            <Search aria-hidden="true" />
            <input
              defaultValue={filters.q ?? ""}
              name="q"
              placeholder="Buscar por job, cliente, modelo, local..."
            />
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
            Status
            <select defaultValue={filters.status ?? ""} name="status">
              <option value="">Todos</option>
              {jobStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select defaultValue={filters.type ?? ""} name="type">
              <option value="">Todos</option>
              {jobTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            De
            <input defaultValue={filters.dateFrom ?? ""} name="dateFrom" type="date" />
          </label>
          <label>
            Ate
            <input defaultValue={filters.dateTo ?? ""} name="dateTo" type="date" />
          </label>
          <div className="jobs-filter-actions">
            <button className="button" type="submit">
              Aplicar
            </button>
            <Link className="button secondary" href="/admin/jobs">
              Limpar
            </Link>
          </div>
        </form>
      </section>

      <section className="aro-glass-card jobs-results">
        <header>
          <strong>{jobs.length} job(s)</strong>
          <Link href={hrefWith(filters, { dateFrom: undefined, dateTo: undefined })}>
            Limpar periodo
          </Link>
        </header>
        <div className="jobs-table-wrap">
          <table className="jobs-table">
            <thead>
              <tr>
                <th>Trabalho</th>
                <th>Modelo(s)</th>
                <th>Cliente</th>
                <th>Data</th>
                <th>Local</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Valor</th>
                <th>Financeiro</th>
                <th>Abrir</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td data-label="Trabalho">
                    <strong>{jobTitle(job)}</strong>
                    {job.brand_name ? <small>{job.brand_name}</small> : null}
                  </td>
                  <td data-label="Modelo(s)">{modelNames(job) || "—"}</td>
                  <td data-label="Cliente">{job.client?.company_name ?? "—"}</td>
                  <td data-label="Data">{formatDashboardDateTime(job.start_at)}</td>
                  <td data-label="Local">
                    {[job.location_name, job.city, job.country].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td data-label="Tipo">{jobTypeLabel(job.type)}</td>
                  <td data-label="Status">
                    <span className="status">{jobStatusLabel(job.status)}</span>
                  </td>
                  <td data-label="Valor">{formatMoneyValue(job.final_amount ?? job.client_budget)}</td>
                  <td data-label="Financeiro">
                    <span className="status">
                      {paymentStatusByJob[job.id] ?? "Accounting pendente"}
                    </span>
                  </td>
                  <td data-label="Abrir">
                    <Link className="button secondary" href={`/admin/calendar/${job.id}`}>
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {jobs.length === 0 ? <p className="muted">Nenhum job encontrado.</p> : null}
      </section>

      <style>{`
        .admin-jobs-page {
          display: grid;
          gap: 14px;
          min-width: 0;
        }

        .jobs-hero,
        .jobs-results,
        .jobs-filters {
          padding: 18px;
        }

        .jobs-hero {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 16px;
        }

        .jobs-hero h1 {
          margin: 0 0 8px;
          font-size: clamp(28px, 4vw, 44px);
        }

        .jobs-hero p {
          max-width: 760px;
          margin: 0;
          color: var(--admin-muted);
        }

        .jobs-filters form {
          display: grid;
          grid-template-columns: minmax(260px, 1.7fr) repeat(6, minmax(132px, 1fr)) auto;
          gap: 10px;
          align-items: end;
        }

        .jobs-filters label {
          display: grid;
          gap: 7px;
          color: var(--admin-muted);
          font-size: 12px;
          font-weight: 800;
        }

        .jobs-filters input,
        .jobs-filters select {
          width: 100%;
          min-height: 42px;
          border: 1px solid var(--admin-border);
          border-radius: 10px;
          background: rgba(2, 18, 50, 0.34);
          color: var(--admin-text);
          padding: 0 11px;
        }

        .jobs-search {
          position: relative;
        }

        .jobs-search svg {
          position: absolute;
          bottom: 11px;
          left: 11px;
          width: 18px;
          height: 18px;
          color: var(--admin-muted);
        }

        .jobs-search input {
          padding-left: 36px;
        }

        .jobs-filter-actions {
          display: flex;
          gap: 8px;
        }

        .jobs-results header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .jobs-results header a {
          color: var(--admin-muted);
          font-size: 12px;
          font-weight: 800;
        }

        .jobs-table-wrap {
          overflow-x: auto;
        }

        .jobs-table {
          width: 100%;
          min-width: 1120px;
          border-collapse: collapse;
        }

        .jobs-table th,
        .jobs-table td {
          border-bottom: 1px solid rgba(255, 255, 255, 0.09);
          padding: 12px 10px;
          text-align: left;
          vertical-align: top;
        }

        .jobs-table th {
          color: var(--admin-muted);
          font-size: 11px;
          text-transform: uppercase;
        }

        .jobs-table td strong,
        .jobs-table td small {
          display: block;
        }

        .jobs-table td small {
          color: var(--admin-muted);
          font-size: 12px;
        }

        .jobs-table .button {
          min-height: 34px;
          padding: 0 12px;
        }

        @media (max-width: 1320px) {
          .jobs-filters form {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .jobs-search {
            grid-column: span 3;
          }
        }

        @media (max-width: 820px) {
          .jobs-hero {
            align-items: start;
            flex-direction: column;
          }

          .jobs-filters form {
            grid-template-columns: 1fr;
          }

          .jobs-search {
            grid-column: auto;
          }

          .jobs-table {
            min-width: 0;
          }

          .jobs-table thead {
            display: none;
          }

          .jobs-table,
          .jobs-table tbody,
          .jobs-table tr,
          .jobs-table td {
            display: block;
            width: 100%;
          }

          .jobs-table tr {
            border: 1px solid var(--admin-border);
            border-radius: 14px;
            margin-bottom: 10px;
            padding: 10px;
          }

          .jobs-table td {
            display: flex;
            justify-content: space-between;
            gap: 14px;
            border-bottom: 0;
            padding: 7px 0;
          }

          .jobs-table td::before {
            color: var(--admin-muted);
            content: attr(data-label);
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
          }
        }
      `}</style>
    </div>
  );
}

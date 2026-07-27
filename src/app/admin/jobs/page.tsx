import Link from "next/link";
import {
  AdminDataTable,
  AdminDateField,
  AdminFilterActions,
  AdminFilterBar,
  AdminModelIdentity,
  AdminMoreFilters,
  AdminPage,
  AdminPageHeader,
  AdminSearchField,
  AdminSection,
  AdminSelectField,
  AdminStatusPill,
  AdminToolbar
} from "@/components/admin/admin-ui";
import { getAccountingSchemaStatus, isMissingSchemaError } from "@/lib/accounting-schema";
import { formatDashboardDateTime } from "@/lib/admin-dashboard";
import { listClientOptions } from "@/lib/clients";
import {
  isUntitledJob,
  jobStatusLabel,
  jobStatusOptions,
  jobTypeLabel,
  jobTypeOptions,
  listAdminJobs,
  listJobDeletionStatuses,
  modelDisplayName,
  modelNames,
  smartJobTitle,
  type JobWithRelations
} from "@/lib/jobs";
import { createModelMainImageUrls, listModels } from "@/lib/models";
import { createClient } from "@/lib/supabase/server";
import { JobActionsMenu } from "./job-actions-menu";

type AdminJobsPageProps = {
  searchParams?: Promise<{
    client?: string;
    dateFrom?: string;
    dateTo?: string;
    error?: string;
    model?: string;
    notice?: string;
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

function modelSecondary(model: NonNullable<JobWithRelations["job_models"][number]["model"]>) {
  return [model.current_city, model.current_country].filter(Boolean).join(", ") || model.categories?.[0] || "Modelo";
}

function locationLabel(job: JobWithRelations) {
  return [job.location_name, job.city, job.country].filter(Boolean).join(" · ") || "—";
}

function statusTone(status: string) {
  if (["confirmed", "completed", "model_accepted", "received"].includes(status)) return "success";
  if (["canceled", "declined"].includes(status)) return "danger";
  if (["waiting_model", "quote_requested", "partially_received"].includes(status)) return "warning";
  return "neutral";
}

function activeSecondaryFilters(filters: Awaited<NonNullable<AdminJobsPageProps["searchParams"]>>) {
  return [filters.client, filters.dateFrom, filters.dateTo].filter(Boolean).length;
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

function ModelStack({
  job,
  modelImageUrls
}: {
  job: JobWithRelations;
  modelImageUrls: Record<string, string>;
}) {
  const assignments = job.job_models.filter((jobModel) => jobModel.model);
  const [firstAssignment] = assignments;
  const firstModel = firstAssignment?.model;

  if (!firstModel) return <span className="muted">Sem modelo</span>;

  return (
    <div className="job-model-stack">
      <AdminModelIdentity
        href={`/admin/models/${firstModel.id}/edit`}
        imageUrl={modelImageUrls[firstModel.id]}
        name={modelDisplayName(firstModel)}
        secondary={modelSecondary(firstModel)}
      />
      {assignments.length > 1 ? (
        <span className="job-model-count">+{assignments.length - 1}</span>
      ) : null}
    </div>
  );
}

export default async function AdminJobsPage({ searchParams }: AdminJobsPageProps) {
  const filters = (await searchParams) ?? {};
  const [jobs, clients, models] = await Promise.all([
    listAdminJobs({
      clientId: filters.client,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      limit: 120,
      modelId: filters.model,
      q: filters.q,
      status: filters.status,
      type: filters.type
    }),
    listClientOptions(),
    listModels()
  ]);
  const [paymentStatusByJob, deletionStatuses, modelImageUrls] = await Promise.all([
    getPaymentStatusByJob(jobs.map((job) => job.id)),
    listJobDeletionStatuses(jobs),
    createModelMainImageUrls(
      jobs
        .flatMap((job) => job.job_models.map((jobModel) => jobModel.model))
        .filter((model): model is NonNullable<typeof model> => Boolean(model))
    )
  ]);

  return (
    <AdminPage className="jobs-workspace">
      <AdminPageHeader
        actions={<Link className="button" href="/admin/calendar/new?type=job">Novo Job</Link>}
        description="Visualização operacional de trabalhos, castings, fittings, opções, reuniões e viagens conectadas ao Calendar."
        eyebrow="Jobs"
        title="Jobs"
      />

      {filters.notice === "job_deleted" ? <p className="toast">Job excluído com segurança.</p> : null}
      {filters.error ? <p className="toast error">{filters.error}</p> : null}

      <AdminToolbar>
        <AdminFilterBar>
          <AdminSearchField
            defaultValue={filters.q}
            placeholder="Buscar por job, cliente, modelo ou local"
          />
          <AdminSelectField
            defaultValue={filters.model}
            label="Modelo"
            name="model"
            options={[
              { label: "Todos", value: "" },
              ...models.map((model) => ({
                label: model.stage_name || model.display_name,
                value: model.id
              }))
            ]}
          />
          <AdminSelectField
            defaultValue={filters.status}
            label="Status"
            name="status"
            options={[{ label: "Todos", value: "" }, ...jobStatusOptions]}
          />
          <AdminSelectField
            defaultValue={filters.type}
            label="Tipo"
            name="type"
            options={[{ label: "Todos", value: "" }, ...jobTypeOptions]}
          />
          <AdminFilterActions resetHref="/admin/jobs" />
          <AdminMoreFilters count={activeSecondaryFilters(filters)}>
            <AdminSelectField
              defaultValue={filters.client}
              label="Cliente"
              name="client"
              options={[
                { label: "Todos", value: "" },
                ...clients.map((client) => ({
                  label: client.company_name,
                  value: client.id
                }))
              ]}
            />
            <AdminDateField defaultValue={filters.dateFrom} label="De" name="dateFrom" />
            <AdminDateField defaultValue={filters.dateTo} label="Até" name="dateTo" />
          </AdminMoreFilters>
        </AdminFilterBar>
      </AdminToolbar>

      <AdminSection meta="Limite operacional: 120 registros" title={`${jobs.length} job(s)`}>
        <AdminDataTable className="jobs-table">
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
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const deletionStatus = deletionStatuses.get(job.id) ?? {
                canDelete: false,
                reason: "Não foi possível auditar dependências deste job."
              };
              const financialStatus = paymentStatusByJob[job.id] ?? "Accounting pendente";

              return (
                <tr key={job.id}>
                  <td data-label="Trabalho">
                    <Link className="job-title-link" href={`/admin/calendar/${job.id}`}>
                      <strong>{smartJobTitle(job)}</strong>
                      {isUntitledJob(job) ? <small>Título pendente</small> : job.brand_name ? <small>{job.brand_name}</small> : null}
                    </Link>
                  </td>
                  <td data-label="Modelo(s)">
                    <ModelStack job={job} modelImageUrls={modelImageUrls} />
                  </td>
                  <td data-label="Cliente">{job.client?.company_name ?? "—"}</td>
                  <td data-label="Data">{formatDashboardDateTime(job.start_at)}</td>
                  <td data-label="Local">{locationLabel(job)}</td>
                  <td data-label="Tipo">{jobTypeLabel(job.type)}</td>
                  <td data-label="Status">
                    <AdminStatusPill tone={statusTone(job.status)}>
                      {jobStatusLabel(job.status)}
                    </AdminStatusPill>
                  </td>
                  <td data-label="Valor">{formatMoneyValue(job.final_amount ?? job.client_budget)}</td>
                  <td data-label="Financeiro">
                    <AdminStatusPill tone={statusTone(financialStatus)}>
                      {financialStatus}
                    </AdminStatusPill>
                  </td>
                  <td data-label="Ações">
                    <JobActionsMenu
                      dateLabel={formatDashboardDateTime(job.start_at)}
                      deletionStatus={deletionStatus}
                      jobId={job.id}
                      modelLabel={modelNames(job)}
                      title={smartJobTitle(job)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </AdminDataTable>
        {jobs.length === 0 ? (
          <p className="muted">Nenhum job encontrado para os filtros atuais.</p>
        ) : null}
      </AdminSection>

      <style>{`
        .jobs-workspace {
          overflow-x: clip;
        }

        .job-title-link {
          display: grid;
          gap: 3px;
        }

        .job-model-stack {
          display: flex;
          align-items: center;
          min-width: 0;
          gap: 8px;
        }

        .job-model-count {
          display: inline-flex;
          width: 28px;
          height: 28px;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--admin-border);
          border-radius: 999px;
          color: var(--admin-muted);
          font-size: 11px;
          font-weight: 800;
        }

        .jobs-table th:nth-child(5),
        .jobs-table td:nth-child(5) {
          max-width: 210px;
        }

        @media (max-width: 1380px) {
          .jobs-table th:nth-child(8),
          .jobs-table td:nth-child(8),
          .jobs-table th:nth-child(9),
          .jobs-table td:nth-child(9) {
            display: none;
          }
        }

        @media (max-width: 1120px) {
          .jobs-table th:nth-child(5),
          .jobs-table td:nth-child(5),
          .jobs-table th:nth-child(6),
          .jobs-table td:nth-child(6) {
            display: none;
          }
        }

        @media (max-width: 760px) {
          .jobs-table th,
          .jobs-table td {
            display: block;
          }

          .jobs-table td:nth-child(5),
          .jobs-table td:nth-child(6),
          .jobs-table td:nth-child(8),
          .jobs-table td:nth-child(9) {
            display: grid;
          }
        }
      `}</style>
    </AdminPage>
  );
}

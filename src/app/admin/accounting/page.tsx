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
  AdminStat,
  AdminStatusPill,
  AdminToolbar
} from "@/components/admin/admin-ui";
import {
  accountingCurrencies,
  accountingStatusLabel,
  currentAccountingMonth,
  defaultAccountingCurrency,
  formatMoney,
  getAgencyFinancialPosition,
  listAccountingJobs,
  monthRange,
  type AccountingCurrency
} from "@/lib/accounting";
import { financialJobTitle } from "@/lib/finance";
import { createModelMainImageUrls } from "@/lib/models";

type AccountingPageProps = {
  searchParams?: Promise<{
    currency?: string;
    from?: string;
    month?: string;
    paymentStatus?: string;
    q?: string;
    to?: string;
  }>;
};

function selectedCurrency(value: string | undefined): AccountingCurrency {
  return accountingCurrencies.includes(value as AccountingCurrency)
    ? (value as AccountingCurrency)
    : defaultAccountingCurrency;
}

function accountingHref(path: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const queryString = query.toString();
  return `${path}${queryString ? `?${queryString}` : ""}`;
}

function statusTone(status: string, review: boolean) {
  if (review || status === "review") return "warning";
  if (status === "received") return "success";
  if (status === "pending") return "danger";
  if (status === "partially_received") return "warning";
  return "neutral";
}

export default async function AccountingPage({ searchParams }: AccountingPageProps) {
  const params = (await searchParams) ?? {};
  const currency = selectedCurrency(params.currency);
  const selectedMonth = params.month ?? currentAccountingMonth();
  const range = params.from || params.to ? { from: params.from, to: params.to } : monthRange(selectedMonth);
  const filters = {
    currency,
    from: range.from,
    paymentStatus: params.paymentStatus,
    q: params.q,
    to: range.to
  };
  const [position, jobs] = await Promise.all([
    getAgencyFinancialPosition(filters),
    listAccountingJobs(filters)
  ]);
  const modelImageUrls = await createModelMainImageUrls(
    jobs
      .map((job) => job.model)
      .filter((model): model is NonNullable<typeof model> => Boolean(model))
  );

  return (
    <AdminPage>
      <AdminPageHeader
        actions={
          <>
            <Link className="button secondary" href={accountingHref("/admin/accounting/expenses", params)}>Despesas</Link>
            <Link className="button secondary" href={accountingHref("/admin/accounting/model-accounts", params)}>Contas dos modelos</Link>
            <Link className="button secondary" href={accountingHref("/admin/accounting/reports", params)}>Relatórios</Link>
          </>
        }
        description={`Período ${range.from ?? "—"} até ${range.to ?? "—"} em ${currency}. Valores por moeda, sem conversão automática.`}
        eyebrow="Accounting"
        title="Accounting"
      />

      <section className="admin-stat-grid">
        <AdminStat label="Recebido" value={formatMoney(position.clientCashReceived, currency)} />
        <AdminStat label="A receber" value={formatMoney(position.clientReceivable, currency)} />
        <AdminStat label="A pagar aos modelos" value={formatMoney(position.modelPayable, currency)} />
        <AdminStat label="Despesas recuperáveis" value={formatMoney(position.recoverableModelExpenses, currency)} />
        <AdminStat label="Caixa disponível" value={formatMoney(position.agencyAvailableCash, currency)} />
        <AdminStat label="Receita da agência" value={formatMoney(position.agencyRevenue, currency)} />
      </section>

      <AdminToolbar>
        <AdminFilterBar>
          <AdminSearchField defaultValue={params.q} placeholder="Trabalho, nota ou referência" />
          <label className="admin-field">
            <span>Mês</span>
            <input defaultValue={selectedMonth} name="month" type="month" />
          </label>
          <AdminSelectField
            defaultValue={currency}
            label="Moeda"
            name="currency"
            options={accountingCurrencies.map((option) => ({ label: option, value: option }))}
          />
          <AdminSelectField
            defaultValue={params.paymentStatus}
            label="Status"
            name="paymentStatus"
            options={[
              { label: "Todos", value: "" },
              { label: "Pendente", value: "pending" },
              { label: "Parcialmente recebido", value: "partially_received" },
              { label: "Recebido", value: "received" },
              { label: "Cadastro financeiro incompleto", value: "review" }
            ]}
          />
          <AdminFilterActions resetHref="/admin/accounting" />
          <AdminMoreFilters count={[params.from, params.to].filter(Boolean).length}>
            <AdminDateField defaultValue={params.from} label="De" name="from" />
            <AdminDateField defaultValue={params.to} label="Até" name="to" />
          </AdminMoreFilters>
        </AdminFilterBar>
      </AdminToolbar>

      <AdminSection title="Trabalhos financeiros" meta={`${jobs.length} lançamento(s)`}>
        <AdminDataTable className="accounting-table">
          <thead>
            <tr>
              <th>Trabalho</th>
              <th>Modelo</th>
              <th>Cliente</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Modelo líquido</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td data-label="Trabalho">
                  <strong>{financialJobTitle(job)}</strong>
                  <small>{job.job?.city || job.job?.country || "Job financeiro"}</small>
                </td>
                <td data-label="Modelo">
                  <AdminModelIdentity
                    href={`/admin/models/${job.model_id}/edit`}
                    imageUrl={job.model?.id ? modelImageUrls[job.model.id] : undefined}
                    name={job.model?.stage_name || job.model?.display_name}
                    secondary="Conta do modelo"
                  />
                </td>
                <td data-label="Cliente">{job.client?.company_name || "—"}</td>
                <td data-label="Data">{job.job_date}</td>
                <td data-label="Cliente">{formatMoney(job.client_amount_due, job.currency)}</td>
                <td data-label="Modelo líquido">{formatMoney(job.model_net_amount, job.currency)}</td>
                <td data-label="Status">
                  <AdminStatusPill tone={statusTone(job.clientPaymentStatus, job.financial_review_required)}>
                    {job.financial_review_required ? "Revisar" : accountingStatusLabel(job.clientPaymentStatus)}
                  </AdminStatusPill>
                </td>
                <td data-label="Ação">
                  <Link className="button secondary" href={`/admin/accounting/${job.id}`}>
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminDataTable>
        {jobs.length === 0 ? <p className="muted">Nenhum lançamento financeiro encontrado.</p> : null}
      </AdminSection>

      <style>{`
        .admin-stat-grid {
          grid-template-columns: repeat(6, minmax(0, 1fr));
        }

        @media (max-width: 1380px) {
          .admin-stat-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .accounting-table th:nth-child(5),
          .accounting-table td:nth-child(5),
          .accounting-table th:nth-child(6),
          .accounting-table td:nth-child(6) {
            display: none;
          }
        }

        @media (max-width: 760px) {
          .admin-stat-grid {
            grid-template-columns: 1fr;
          }

          .accounting-table td:nth-child(5),
          .accounting-table td:nth-child(6) {
            display: grid;
          }
        }
      `}</style>
    </AdminPage>
  );
}

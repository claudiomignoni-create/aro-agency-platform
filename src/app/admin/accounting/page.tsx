import Link from "next/link";
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

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="actions spread">
          <div>
            <span className="eyebrow">Accounting</span>
            <h2>Accounting</h2>
            <p>Recebimentos, contas de modelos, despesas e relatórios financeiros.</p>
          </div>
          <div className="actions">
            <Link className="button secondary" href={accountingHref("/admin/accounting/expenses", params)}>
              Despesas
            </Link>
            <Link className="button secondary" href={accountingHref("/admin/accounting/model-accounts", params)}>
              Contas dos modelos
            </Link>
            <Link className="button secondary" href={accountingHref("/admin/accounting/reports", params)}>
              Relatórios
            </Link>
          </div>
        </div>
        <form className="grid" method="get">
          <label>
            Mês
            <input defaultValue={selectedMonth} name="month" type="month" />
          </label>
          <label>
            De
            <input defaultValue={params.from ?? ""} name="from" type="date" />
          </label>
          <label>
            Até
            <input defaultValue={params.to ?? ""} name="to" type="date" />
          </label>
          <label>
            Moeda
            <select defaultValue={currency} name="currency">
              {accountingCurrencies.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select defaultValue={params.paymentStatus ?? ""} name="paymentStatus">
              <option value="">Todos</option>
              <option value="pending">Pendente</option>
              <option value="partially_received">Parcialmente recebido</option>
              <option value="received">Recebido</option>
              <option value="review">Cadastro financeiro incompleto</option>
            </select>
          </label>
          <label>
            Busca
            <input defaultValue={params.q ?? ""} name="q" placeholder="Trabalho, nota ou referência" />
          </label>
          <div className="actions">
            <button className="button" type="submit">Aplicar</button>
            <Link className="button secondary" href="/admin/accounting">Limpar</Link>
          </div>
        </form>
      </section>

      <section className="grid">
        <article className="panel">
          <span className="eyebrow">Caixa recebido de clientes</span>
          <h3>{formatMoney(position.clientCashReceived, currency)}</h3>
        </article>
        <article className="panel">
          <span className="eyebrow">Valores a receber</span>
          <h3>{formatMoney(position.clientReceivable, currency)}</h3>
        </article>
        <article className="panel">
          <span className="eyebrow">Valores a pagar aos modelos</span>
          <h3>{formatMoney(position.modelPayable, currency)}</h3>
        </article>
        <article className="panel">
          <span className="eyebrow">Despesas recuperáveis</span>
          <h3>{formatMoney(position.recoverableModelExpenses, currency)}</h3>
        </article>
        <article className="panel">
          <span className="eyebrow">Caixa disponível da agência</span>
          <h3>{formatMoney(position.agencyAvailableCash, currency)}</h3>
        </article>
        <article className="panel">
          <span className="eyebrow">Receita de taxa/comissão</span>
          <h3>{formatMoney(position.agencyRevenue, currency)}</h3>
        </article>
      </section>

      <section className="panel stack">
        <div className="actions spread">
          <span className="eyebrow">Trabalhos financeiros</span>
          <span className="badge">{jobs.length} lançamentos</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Trabalho</th>
                <th>Modelo</th>
                <th>Cliente</th>
                <th>Data</th>
                <th>Cliente</th>
                <th>Modelo líquido</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td data-label="Trabalho">{financialJobTitle(job)}</td>
                  <td data-label="Modelo">{job.model?.stage_name || job.model?.display_name || "-"}</td>
                  <td data-label="Cliente">{job.client?.company_name || "-"}</td>
                  <td data-label="Data">{job.job_date}</td>
                  <td data-label="Cliente">{formatMoney(job.client_amount_due, job.currency)}</td>
                  <td data-label="Modelo líquido">{formatMoney(job.model_net_amount, job.currency)}</td>
                  <td data-label="Status">
                    <span className={job.financial_review_required ? "badge" : "status"}>
                      {job.financial_review_required
                        ? "Revisar"
                        : accountingStatusLabel(job.clientPaymentStatus)}
                    </span>
                  </td>
                  <td>
                    <Link className="button secondary" href={`/admin/accounting/${job.id}`}>
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {jobs.length === 0 ? <p className="muted">Nenhum lançamento financeiro encontrado.</p> : null}
      </section>
    </div>
  );
}

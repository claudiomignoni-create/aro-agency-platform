import Link from "next/link";
import {
  defaultAccountingCurrency,
  formatMoney,
  getAgencyFinancialPosition,
  listAccountingEntries,
  listAccountingJobs
} from "@/lib/accounting";
import { financialJobTitle } from "@/lib/finance";

type ReportsPageProps = {
  searchParams?: Promise<{ currency?: string; from?: string; q?: string; to?: string }>;
};

export default async function AccountingReportsPage({ searchParams }: ReportsPageProps) {
  const params = (await searchParams) ?? {};
  const currency = (params.currency as never) || defaultAccountingCurrency;
  const [position, jobs, entries] = await Promise.all([
    getAgencyFinancialPosition({ currency, from: params.from, q: params.q, to: params.to }),
    listAccountingJobs({ currency, from: params.from, q: params.q, to: params.to }),
    listAccountingEntries({ currency, from: params.from, q: params.q, to: params.to })
  ]);

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="actions spread">
          <div>
            <span className="eyebrow">Accounting</span>
            <h2>Relatórios da agência</h2>
          </div>
          <Link className="button secondary" href="/admin/accounting">Voltar</Link>
        </div>
        <form className="grid" method="get">
          <label>De<input defaultValue={params.from ?? ""} name="from" type="date" /></label>
          <label>Até<input defaultValue={params.to ?? ""} name="to" type="date" /></label>
          <label>Moeda<select defaultValue={currency} name="currency"><option>BRL</option><option>USD</option><option>EUR</option></select></label>
          <label>Busca<input defaultValue={params.q ?? ""} name="q" /></label>
          <button className="button" type="submit">Aplicar</button>
        </form>
      </section>
      <section className="grid">
        <article className="panel"><span className="eyebrow">Recebido</span><h3>{formatMoney(position.clientCashReceived, currency)}</h3></article>
        <article className="panel"><span className="eyebrow">Em aberto</span><h3>{formatMoney(position.clientReceivable, currency)}</h3></article>
        <article className="panel"><span className="eyebrow">Pagamentos modelos</span><h3>{formatMoney(position.modelPayable, currency)}</h3></article>
        <article className="panel"><span className="eyebrow">Receita agência</span><h3>{formatMoney(position.agencyRevenue, currency)}</h3></article>
      </section>
      <section className="panel stack">
        <h3>Histórico de transações</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th></tr></thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}><td>{job.job_date}</td><td>Trabalho</td><td>{financialJobTitle(job)}</td><td>{formatMoney(job.client_amount_due, job.currency)}</td></tr>
              ))}
              {entries.map((entry) => (
                <tr key={entry.id}><td>{entry.occurred_on}</td><td>{entry.entry_type}</td><td>{entry.title}</td><td>{formatMoney(entry.amount, entry.currency)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

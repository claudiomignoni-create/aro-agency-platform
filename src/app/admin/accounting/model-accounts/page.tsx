import Link from "next/link";
import {
  accountingCurrencies,
  defaultAccountingCurrency,
  formatMoney,
  listModelAccountSummaries,
  type AccountingCurrency
} from "@/lib/accounting";

type ModelAccountsPageProps = {
  searchParams?: Promise<{ currency?: string; from?: string; q?: string; to?: string }>;
};

function selectedCurrency(value: string | undefined): AccountingCurrency {
  return accountingCurrencies.includes(value as AccountingCurrency)
    ? (value as AccountingCurrency)
    : defaultAccountingCurrency;
}

export default async function ModelAccountsPage({ searchParams }: ModelAccountsPageProps) {
  const params = (await searchParams) ?? {};
  const currency = selectedCurrency(params.currency);
  const summaries = await listModelAccountSummaries({
    currency,
    from: params.from,
    q: params.q,
    to: params.to
  });

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="actions spread">
          <div>
            <span className="eyebrow">Accounting</span>
            <h2>Contas dos modelos</h2>
          </div>
          <Link className="button secondary" href="/admin/accounting">Voltar</Link>
        </div>
      </section>
      <section className="panel stack">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Trabalhos pagos</th>
                <th>Pendente de cliente</th>
                <th>Despesas/adiantamentos</th>
                <th>Pagamentos</th>
                <th>Disponível</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {summaries.map((summary) => (
                <tr key={summary.modelId}>
                  <td>{summary.model?.stage_name || summary.model?.display_name || "Modelo"}</td>
                  <td>{formatMoney(summary.paidJobs, currency)}</td>
                  <td>{formatMoney(summary.pendingClient, currency)}</td>
                  <td>{formatMoney(summary.expenses, currency)}</td>
                  <td>{formatMoney(summary.payouts, currency)}</td>
                  <td>{formatMoney(summary.available, currency)}</td>
                  <td>
                    <Link className="button secondary" href={`/admin/accounting/models/${summary.modelId}`}>
                      Extrato
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

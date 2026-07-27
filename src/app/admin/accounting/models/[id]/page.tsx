import Link from "next/link";
import {
  categoryLabel,
  entryTypeLabel,
  formatMoney,
  buildModelStatement
} from "@/lib/accounting";
import { financialJobTitle } from "@/lib/finance";
import { createModelAccountingEntry } from "../../actions";

type ModelStatementPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ currency?: string; from?: string; to?: string }>;
};

export default async function ModelStatementPage({ params, searchParams }: ModelStatementPageProps) {
  const { id } = await params;
  const filters = (await searchParams) ?? {};
  const statement = await buildModelStatement(id, {
    currency: filters.currency as never,
    from: filters.from,
    to: filters.to
  });
  const modelLabel = statement.model?.stage_name || statement.model?.display_name || "Modelo";

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="actions spread">
          <div>
            <span className="eyebrow">Conta do modelo</span>
            <h2>{modelLabel}</h2>
          </div>
          <div className="actions">
            <Link className="button secondary" href={`/admin/accounting/models/${id}/pdf`} target="_blank">
              Open PDF
            </Link>
            <Link className="button secondary" href={`/admin/accounting/models/${id}/pdf?download=1`}>
              Download PDF
            </Link>
            <Link className="button secondary" href="/admin/accounting/model-accounts">Voltar</Link>
          </div>
        </div>
        <div className="grid">
          <article>
            <span className="eyebrow">Disponível para pagar</span>
            <h3>{formatMoney(statement.summary?.available, statement.currency)}</h3>
          </article>
          <article>
            <span className="eyebrow">Pendente de clientes</span>
            <h3>{formatMoney(statement.summary?.pendingClient, statement.currency)}</h3>
          </article>
          <article>
            <span className="eyebrow">Pagamentos realizados</span>
            <h3>{formatMoney(statement.summary?.payouts, statement.currency)}</h3>
          </article>
        </div>
      </section>

      <section className="panel stack">
        <h3>Registrar pagamento ou ajuste</h3>
        <form action={createModelAccountingEntry} className="grid">
          <input name="model_id" type="hidden" value={id} />
          <label>
            Tipo
            <select name="entry_type" required>
              <option value="model_payout">Pagamento ao modelo</option>
              <option value="credit_adjustment">Ajuste de crédito</option>
              <option value="debit_adjustment">Ajuste de débito</option>
            </select>
          </label>
          <label>
            Título
            <input name="title" required />
          </label>
          <label>
            Valor
            <input name="amount" required />
          </label>
          <label>
            Moeda
            <select defaultValue={statement.currency} name="currency">
              <option>BRL</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </label>
          <label>
            Data
            <input name="occurred_on" required type="date" />
          </label>
          <label>
            Referência
            <input name="payment_reference" />
          </label>
          <label className="span-2">
            Justificativa / observação
            <textarea name="description" required />
          </label>
          <button className="button" type="submit">Registrar</button>
        </form>
      </section>

      <section className="panel stack">
        <h3>Trabalhos pagos e pendentes</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Trabalho</th>
                <th>Cliente</th>
                <th>Cliente deve</th>
                <th>Modelo líquido</th>
              </tr>
            </thead>
            <tbody>
              {statement.jobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.job_date}</td>
                  <td>{financialJobTitle(job)}</td>
                  <td>{job.client?.company_name || "-"}</td>
                  <td>{formatMoney(job.client_amount_due, job.currency)}</td>
                  <td>{formatMoney(job.model_net_amount, job.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel stack">
        <h3>Despesas, pagamentos e ajustes</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Título</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {statement.entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.occurred_on}</td>
                  <td>{entryTypeLabel(entry.entry_type)}</td>
                  <td>{categoryLabel(entry.category, entry.custom_category_label)}</td>
                  <td>{entry.title}</td>
                  <td>{formatMoney(entry.amount, entry.currency)}</td>
                  <td><span className="status">{entry.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

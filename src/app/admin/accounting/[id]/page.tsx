import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/accounting";
import { getFinancialJob } from "@/lib/finance";
import { recordClientPaymentReceipt, voidClientPaymentReceipt } from "../actions";

type AccountingJobPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AccountingJobPage({ params }: AccountingJobPageProps) {
  const { id } = await params;
  const job = await getFinancialJob(id);
  if (!job) notFound();

  const received = (job.receipts ?? [])
    .filter((receipt) => receipt.status === "posted")
    .reduce((total, receipt) => total + Number(receipt.amount ?? 0), 0);

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="actions spread">
          <div>
            <span className="eyebrow">Accounting</span>
            <h2>{job.title}</h2>
            <p>
              {job.model?.stage_name || job.model?.display_name || "Modelo"} · {job.client?.company_name || "Cliente não definido"}
            </p>
          </div>
          <Link className="button secondary" href="/admin/accounting">Voltar</Link>
        </div>
        <div className="grid">
          <article>
            <span className="eyebrow">Valor devido pelo cliente</span>
            <h3>{formatMoney(job.client_amount_due, job.currency)}</h3>
          </article>
          <article>
            <span className="eyebrow">Recebido</span>
            <h3>{formatMoney(received, job.currency)}</h3>
          </article>
          <article>
            <span className="eyebrow">Líquido do modelo</span>
            <h3>{formatMoney(job.model_net_amount, job.currency)}</h3>
          </article>
          <article>
            <span className="eyebrow">Taxa agência</span>
            <h3>{formatMoney(job.agency_fee_amount, job.currency)}</h3>
          </article>
        </div>
      </section>

      <section className="panel stack">
        <h3>Registrar recebimento</h3>
        {job.financial_review_required ? (
          <p className="notice">Este lançamento precisa de revisão financeira antes de receber pagamento.</p>
        ) : null}
        <form action={recordClientPaymentReceipt} className="grid">
          <input name="financial_job_entry_id" type="hidden" value={job.id} />
          <input name="currency" type="hidden" value={job.currency} />
          <label>
            Valor
            <input name="amount" placeholder="1200,00" required />
          </label>
          <label>
            Data de recebimento
            <input name="received_on" required type="date" />
          </label>
          <label>
            Método
            <input name="payment_method" placeholder="PIX, transferência, cartão" />
          </label>
          <label>
            Referência
            <input name="payment_reference" />
          </label>
          <label className="span-2">
            Observação interna
            <textarea name="internal_note" />
          </label>
          <button className="button" type="submit">Registrar recebimento</button>
        </form>
      </section>

      <section className="panel stack">
        <h3>Histórico de recebimentos</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Valor</th>
                <th>Método</th>
                <th>Status</th>
                <th>Anular</th>
              </tr>
            </thead>
            <tbody>
              {(job.receipts ?? []).map((receipt) => (
                <tr key={receipt.id}>
                  <td>{receipt.received_on}</td>
                  <td>{formatMoney(receipt.amount, receipt.currency)}</td>
                  <td>{receipt.payment_method || "-"}</td>
                  <td><span className="status">{receipt.status === "posted" ? "Contabilizado" : "Anulado"}</span></td>
                  <td>
                    {receipt.status === "posted" ? (
                      <form action={voidClientPaymentReceipt} className="actions">
                        <input name="financial_job_entry_id" type="hidden" value={job.id} />
                        <input name="receipt_id" type="hidden" value={receipt.id} />
                        <input name="void_reason" placeholder="Motivo" required />
                        <button className="button secondary" type="submit">Anular</button>
                      </form>
                    ) : receipt.void_reason}
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

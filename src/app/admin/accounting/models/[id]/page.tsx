import Link from "next/link";
import {
  AdminDataTable,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminSelectField,
  AdminStat,
  AdminStatusPill
} from "@/components/admin/admin-ui";
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
    <AdminPage className="accounting-model-page">
      <AdminPageHeader
        actions={
          <>
            <Link className="button secondary" href={`/admin/accounting/models/${id}/pdf`} target="_blank">
              Abrir PDF
            </Link>
            <Link className="button secondary" href={`/admin/accounting/models/${id}/pdf?download=1`}>
              Baixar PDF
            </Link>
            <Link className="button secondary" href="/admin/accounting/model-accounts">Voltar</Link>
          </>
        }
        description={`Extrato individual em ${statement.currency}, sem conversão automática de moedas.`}
        eyebrow="Conta do modelo"
        title={modelLabel}
      />

      <section className="admin-stat-grid model-accounting-stats">
        <AdminStat label="Disponível para pagar" value={formatMoney(statement.summary?.available, statement.currency)} />
        <AdminStat label="Pendente de clientes" value={formatMoney(statement.summary?.pendingClient, statement.currency)} />
        <AdminStat label="Pagamentos realizados" value={formatMoney(statement.summary?.payouts, statement.currency)} />
      </section>

      <AdminSection title="Registrar pagamento ou ajuste">
        <form action={createModelAccountingEntry} className="accounting-entry-form">
          <input name="model_id" type="hidden" value={id} />
          <AdminSelectField
            label="Tipo"
            name="entry_type"
            options={[
              { label: "Pagamento ao modelo", value: "model_payout" },
              { label: "Ajuste de crédito", value: "credit_adjustment" },
              { label: "Ajuste de débito", value: "debit_adjustment" }
            ]}
          />
          <label className="admin-field">
            <span>Título</span>
            <input name="title" required />
          </label>
          <label className="admin-field">
            <span>Valor</span>
            <input name="amount" required />
          </label>
          <AdminSelectField
            defaultValue={statement.currency}
            label="Moeda"
            name="currency"
            options={[
              { label: "BRL", value: "BRL" },
              { label: "USD", value: "USD" },
              { label: "EUR", value: "EUR" }
            ]}
          />
          <label className="admin-field">
            <span>Data</span>
            <input name="occurred_on" required type="date" />
          </label>
          <label className="admin-field">
            <span>Referência</span>
            <input name="payment_reference" />
          </label>
          <label className="admin-field span-2">
            <span>Justificativa / observação</span>
            <textarea name="description" required />
          </label>
          <button className="button" type="submit">Registrar</button>
        </form>
      </AdminSection>

      <AdminSection title="Trabalhos pagos e pendentes" meta={`${statement.jobs.length} registro(s)`}>
        <AdminDataTable>
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
                <td data-label="Data">{job.job_date}</td>
                <td data-label="Trabalho">{financialJobTitle(job)}</td>
                <td data-label="Cliente">{job.client?.company_name || "—"}</td>
                <td data-label="Cliente deve">{formatMoney(job.client_amount_due, job.currency)}</td>
                <td data-label="Modelo líquido">{formatMoney(job.model_net_amount, job.currency)}</td>
              </tr>
            ))}
          </tbody>
        </AdminDataTable>
      </AdminSection>

      <AdminSection title="Despesas, pagamentos e ajustes" meta={`${statement.entries.length} lançamento(s)`}>
        <AdminDataTable>
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
                <td data-label="Data">{entry.occurred_on}</td>
                <td data-label="Tipo">{entryTypeLabel(entry.entry_type)}</td>
                <td data-label="Categoria">{categoryLabel(entry.category, entry.custom_category_label)}</td>
                <td data-label="Título">{entry.title}</td>
                <td data-label="Valor">{formatMoney(entry.amount, entry.currency)}</td>
                <td data-label="Status">
                  <AdminStatusPill tone={entry.status === "posted" ? "success" : entry.status === "void" ? "danger" : "warning"}>
                    {entry.status}
                  </AdminStatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminDataTable>
      </AdminSection>

      <style>{`
        .model-accounting-stats {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .accounting-entry-form {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .accounting-entry-form .span-2 {
          grid-column: span 2;
        }

        .accounting-entry-form button {
          align-self: end;
          min-height: 36px;
        }

        @media (max-width: 760px) {
          .model-accounting-stats,
          .accounting-entry-form {
            grid-template-columns: 1fr;
          }

          .accounting-entry-form .span-2 {
            grid-column: auto;
          }
        }
      `}</style>
    </AdminPage>
  );
}

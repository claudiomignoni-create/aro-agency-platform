import Link from "next/link";
import {
  accountingCurrencies,
  accountingExpenseCategories,
  accountingStatusLabel,
  categoryLabel,
  defaultAccountingCurrency,
  entryTypeLabel,
  formatMoney,
  listAccountingEntries,
  listModelAccountingPlans,
  type AccountingCurrency
} from "@/lib/accounting";
import { listModels } from "@/lib/models";
import {
  createModelAccountingEntry,
  createModelAccountingPlan,
  deactivateModelAccountingPlan,
  voidModelAccountingEntry
} from "../actions";

type ExpensesPageProps = {
  searchParams?: Promise<{
    currency?: string;
    from?: string;
    q?: string;
    to?: string;
  }>;
};

function selectedCurrency(value: string | undefined): AccountingCurrency {
  return accountingCurrencies.includes(value as AccountingCurrency)
    ? (value as AccountingCurrency)
    : defaultAccountingCurrency;
}

export default async function AccountingExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = (await searchParams) ?? {};
  const currency = selectedCurrency(params.currency);
  const [entries, models, plans] = await Promise.all([
    listAccountingEntries({ currency, from: params.from, q: params.q, to: params.to }),
    listModels(),
    listModelAccountingPlans({ currency, from: params.from, q: params.q, to: params.to })
  ]);

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="actions spread">
          <div>
            <span className="eyebrow">Accounting</span>
            <h2>Despesas e lançamentos de modelos</h2>
          </div>
          <Link className="button secondary" href="/admin/accounting">Voltar</Link>
        </div>
        <form className="grid" method="get">
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
              {accountingCurrencies.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Busca
            <input defaultValue={params.q ?? ""} name="q" />
          </label>
          <button className="button" type="submit">Aplicar</button>
        </form>
      </section>

      <section className="panel stack">
        <h3>Novo plano recorrente</h3>
        <form action={createModelAccountingPlan} className="grid">
          <label>
            Modelo
            <select name="model_id" required>
              <option value="">Selecionar</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.stage_name || model.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select name="entry_type" required>
              <option value="expense">Despesa</option>
              <option value="advance">Adiantamento</option>
            </select>
          </label>
          <label>
            Categoria
            <select name="category" required>
              {accountingExpenseCategories.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
          </label>
          <label>
            Categoria personalizada
            <input name="custom_category_label" />
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
            <select defaultValue={currency} name="currency">
              {accountingCurrencies.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Início
            <input name="start_date" required type="date" />
          </label>
          <label>
            Cadência
            <select name="cadence" required>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
            </select>
          </label>
          <label>
            Ocorrências
            <input defaultValue="4" max="60" min="1" name="occurrence_count" required type="number" />
          </label>
          <label>
            Contabilização
            <select name="posting_mode" required>
              <option value="schedule_per_period">Programar por período</option>
              <option value="post_all_now">Contabilizar tudo agora</option>
            </select>
          </label>
          <label className="span-2">
            Descrição
            <textarea name="description" rows={3} />
          </label>
          <button className="button" type="submit">Criar plano</button>
        </form>
      </section>

      <section className="panel stack">
        <div className="actions spread">
          <h3>Planos recorrentes</h3>
          <span className="badge">{plans.length} planos</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Plano</th>
                <th>Categoria</th>
                <th>Cadência</th>
                <th>Ocorrências</th>
                <th>Valor</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const occurrences = entries.filter((entry) => entry.source_plan_id === plan.id);

                return (
                  <tr key={plan.id}>
                    <td>{plan.model?.stage_name || plan.model?.display_name || "-"}</td>
                    <td>
                      <strong>{plan.title}</strong>
                      <br />
                      <span className="muted">{occurrences.length} ocorrência(s) no histórico visível</span>
                    </td>
                    <td>{categoryLabel(plan.category, plan.custom_category_label)}</td>
                    <td>{plan.cadence === "weekly" ? "Semanal" : "Mensal"}</td>
                    <td>{plan.occurrence_count}</td>
                    <td>{formatMoney(plan.amount, plan.currency)}</td>
                    <td><span className="status">{plan.active ? "Ativo" : "Inativo"}</span></td>
                    <td>
                      {plan.active ? (
                        <form action={deactivateModelAccountingPlan}>
                          <input name="plan_id" type="hidden" value={plan.id} />
                          <input name="model_id" type="hidden" value={plan.model_id} />
                          <button className="button secondary" type="submit">Desativar</button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel stack">
        <h3>Novo lançamento</h3>
        <form action={createModelAccountingEntry} className="grid">
          <label>
            Modelo
            <select name="model_id" required>
              <option value="">Selecionar</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.stage_name || model.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select name="entry_type" required>
              <option value="expense">Despesa</option>
              <option value="advance">Adiantamento</option>
              <option value="model_payout">Pagamento ao modelo</option>
              <option value="credit_adjustment">Ajuste de crédito</option>
              <option value="debit_adjustment">Ajuste de débito</option>
            </select>
          </label>
          <label>
            Categoria
            <select name="category">
              <option value="">Não se aplica</option>
              {accountingExpenseCategories.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
          </label>
          <label>
            Categoria personalizada
            <input name="custom_category_label" />
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
            <select defaultValue={currency} name="currency">
              {accountingCurrencies.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Data
            <input name="occurred_on" required type="date" />
          </label>
          <label>
            Status
            <select name="status">
              <option value="posted">Contabilizado</option>
              <option value="scheduled">Programado</option>
            </select>
          </label>
          <label>
            Método
            <input name="payment_method" />
          </label>
          <label>
            Referência
            <input name="payment_reference" />
          </label>
          <label className="span-2">
            Descrição / justificativa
            <textarea name="description" />
          </label>
          <button className="button" type="submit">Registrar lançamento</button>
        </form>
      </section>

      <section className="panel stack">
        <h3>Lançamentos</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Modelo</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Anular</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.occurred_on}</td>
                  <td>{entry.model?.stage_name || entry.model?.display_name || "-"}</td>
                  <td>{entryTypeLabel(entry.entry_type)}</td>
                  <td>{categoryLabel(entry.category, entry.custom_category_label)}</td>
                  <td>{formatMoney(entry.amount, entry.currency)}</td>
                  <td><span className="status">{accountingStatusLabel(entry.status)}</span></td>
                  <td>
                    {entry.status === "posted" ? (
                      <form action={voidModelAccountingEntry} className="actions">
                        <input name="entry_id" type="hidden" value={entry.id} />
                        <input name="model_id" type="hidden" value={entry.model_id} />
                        <input name="void_reason" placeholder="Motivo" required />
                        <button className="button secondary" type="submit">Anular</button>
                      </form>
                    ) : entry.void_reason}
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

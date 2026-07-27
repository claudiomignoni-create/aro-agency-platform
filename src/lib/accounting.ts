import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  accountingCurrencies,
  defaultAccountingCurrency,
  formatMoney,
  type AccountingCurrency
} from "@/lib/finance-calculations";
import {
  deriveClientPaymentStatus,
  financialJobTitle,
  listFinancialJobs,
  type FinancialJobEntry
} from "@/lib/finance";

export { accountingCurrencies, defaultAccountingCurrency, formatMoney };
export type { AccountingCurrency };

export const accountingExpenseCategories = [
  { label: "Passagem", value: "passagem" },
  { label: "Hospedagem", value: "hospedagem" },
  { label: "Transporte", value: "transporte" },
  { label: "Visto ou documentação", value: "visto_documentacao" },
  { label: "Pocket Money ou adiantamento", value: "pocket_money" },
  { label: "Test Shoot ou Portfolio", value: "test_shoot_portfolio" },
  { label: "Material ou Book", value: "material_book" },
  { label: "Alimentação", value: "alimentacao" },
  { label: "Taxas", value: "taxas" },
  { label: "Outro", value: "outro" }
] as const;

export const accountingEntryTypes = [
  { label: "Despesa", value: "expense" },
  { label: "Adiantamento", value: "advance" },
  { label: "Pagamento ao modelo", value: "model_payout" },
  { label: "Ajuste de crédito", value: "credit_adjustment" },
  { label: "Ajuste de débito", value: "debit_adjustment" }
] as const;

export type AccountingEntry = {
  amount: string | number;
  category: string | null;
  currency: AccountingCurrency;
  custom_category_label: string | null;
  description: string | null;
  entry_type: string;
  id: string;
  internal_notes: string | null;
  model: {
    display_name: string;
    id: string;
    stage_name: string | null;
  } | null;
  model_id: string;
  occurred_on: string;
  payment_method: string | null;
  payment_reference: string | null;
  status: "scheduled" | "posted" | "void";
  title: string;
  void_reason: string | null;
};

export type AccountingPeriod = {
  currency?: AccountingCurrency;
  from?: string;
  q?: string;
  to?: string;
};

export function currentAccountingMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric"
  }).format(new Date());
}

export function monthRange(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  if (!year || !monthIndex) return {};
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, monthIndex, 0)).toISOString().slice(0, 10);
  return { from: start, to: end };
}

export function modelName(model: { display_name?: string | null; stage_name?: string | null } | null) {
  return model?.stage_name || model?.display_name || "Modelo";
}

export function accountingStatusLabel(status: string) {
  const labels: Record<string, string> = {
    paid_to_model: "Pago ao modelo",
    partially_received: "Parcialmente recebido",
    pending: "Pendente",
    received: "Recebido",
    review: "Revisão necessária",
    void: "Anulado"
  };
  return labels[status] ?? status;
}

export function entryTypeLabel(type: string) {
  return accountingEntryTypes.find((entry) => entry.value === type)?.label ?? type;
}

export function categoryLabel(category: string | null, custom?: string | null) {
  if (category === "outro" && custom) return custom;
  return accountingExpenseCategories.find((item) => item.value === category)?.label ?? category ?? "-";
}

export async function getAgencyFinancialPosition(filters: AccountingPeriod = {}) {
  const currency = filters.currency ?? defaultAccountingCurrency;
  const [jobs, entries] = await Promise.all([
    listFinancialJobs({ currency, from: filters.from, q: filters.q, to: filters.to }),
    listAccountingEntries({ currency, from: filters.from, q: filters.q, to: filters.to })
  ]);

  let clientCashReceived = 0;
  let clientReceivable = 0;
  let modelPayable = 0;
  let agencyRevenue = 0;

  for (const job of jobs) {
    const due = Number(job.client_amount_due ?? 0);
    const modelNet = Number(job.model_net_amount ?? 0);
    const agencyFee = Number(job.agency_fee_amount ?? 0);
    const paid = (job.receipts ?? [])
      .filter((receipt) => receipt.status === "posted")
      .reduce((total, receipt) => total + Number(receipt.amount ?? 0), 0);

    clientCashReceived += paid;
    clientReceivable += Math.max(due - paid, 0);
    agencyRevenue += paid >= due && due > 0 ? agencyFee : 0;
    modelPayable += paid >= due && due > 0 ? modelNet : 0;
  }

  const modelCharges = entries
    .filter((entry) => entry.status === "posted" && ["expense", "advance", "debit_adjustment"].includes(entry.entry_type))
    .reduce((total, entry) => total + Number(entry.amount ?? 0), 0);
  const modelCredits = entries
    .filter((entry) => entry.status === "posted" && entry.entry_type === "credit_adjustment")
    .reduce((total, entry) => total + Number(entry.amount ?? 0), 0);
  const payouts = entries
    .filter((entry) => entry.status === "posted" && entry.entry_type === "model_payout")
    .reduce((total, entry) => total + Number(entry.amount ?? 0), 0);

  return {
    agencyAvailableCash: clientCashReceived - payouts - modelPayable,
    agencyRevenue,
    clientCashReceived,
    clientReceivable,
    currency,
    modelPayable: Math.max(modelPayable + modelCredits - modelCharges - payouts, 0),
    recoverableModelExpenses: modelCharges
  };
}

export async function listAccountingJobs(filters: AccountingPeriod & { paymentStatus?: string } = {}) {
  const jobs = await listFinancialJobs({
    currency: filters.currency ?? defaultAccountingCurrency,
    from: filters.from,
    paymentStatus: filters.paymentStatus,
    q: filters.q,
    to: filters.to
  });

  return jobs.map((job) => ({
    ...job,
    clientPaymentStatus: deriveClientPaymentStatus(job),
    title: financialJobTitle(job)
  }));
}

export async function listAccountingEntries(filters: AccountingPeriod & { modelId?: string } = {}) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  let query = supabase
    .from("model_accounting_entries")
    .select(`
      *,
      model:models (
        id,
        display_name,
        stage_name
      )
    `)
    .order("occurred_on", { ascending: false });

  if (filters.currency) query = query.eq("currency", filters.currency);
  if (filters.from) query = query.gte("occurred_on", filters.from);
  if (filters.to) query = query.lte("occurred_on", filters.to);
  if (filters.modelId) query = query.eq("model_id", filters.modelId);
  if (filters.q) query = query.or(`title.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);

  const { data, error } = await query.limit(500);
  if (error) throw error;
  return (data ?? []) as AccountingEntry[];
}

export async function listModelAccountSummaries(filters: AccountingPeriod = {}) {
  const currency = filters.currency ?? defaultAccountingCurrency;
  const [jobs, entries] = await Promise.all([
    listFinancialJobs({ currency, from: filters.from, q: filters.q, to: filters.to }),
    listAccountingEntries({ currency, from: filters.from, q: filters.q, to: filters.to })
  ]);
  const summaries = new Map<string, {
    available: number;
    expenses: number;
    model: NonNullable<FinancialJobEntry["model"]> | AccountingEntry["model"];
    paidJobs: number;
    payouts: number;
    pendingClient: number;
  }>();

  for (const job of jobs) {
    const paid = (job.receipts ?? [])
      .filter((receipt) => receipt.status === "posted")
      .reduce((total, receipt) => total + Number(receipt.amount ?? 0), 0);
    const due = Number(job.client_amount_due ?? 0);
    const current = summaries.get(job.model_id) ?? {
      available: 0,
      expenses: 0,
      model: job.model,
      paidJobs: 0,
      payouts: 0,
      pendingClient: 0
    };

    if (due > 0 && paid >= due) {
      current.paidJobs += Number(job.model_net_amount ?? 0);
      current.available += Number(job.model_net_amount ?? 0);
    } else {
      current.pendingClient += Math.max(due - paid, 0);
    }

    summaries.set(job.model_id, current);
  }

  for (const entry of entries) {
    const current = summaries.get(entry.model_id) ?? {
      available: 0,
      expenses: 0,
      model: entry.model,
      paidJobs: 0,
      payouts: 0,
      pendingClient: 0
    };
    if (entry.status === "posted") {
      if (["expense", "advance", "debit_adjustment"].includes(entry.entry_type)) {
        current.expenses += Number(entry.amount ?? 0);
        current.available -= Number(entry.amount ?? 0);
      }
      if (entry.entry_type === "credit_adjustment") current.available += Number(entry.amount ?? 0);
      if (entry.entry_type === "model_payout") {
        current.payouts += Number(entry.amount ?? 0);
        current.available -= Number(entry.amount ?? 0);
      }
    }
    summaries.set(entry.model_id, current);
  }

  return Array.from(summaries.entries()).map(([modelId, summary]) => ({
    ...summary,
    currency,
    modelId
  }));
}

export async function buildModelStatement(modelId: string, filters: AccountingPeriod = {}) {
  const currency = filters.currency ?? defaultAccountingCurrency;
  const [jobs, entries] = await Promise.all([
    listFinancialJobs({ currency, from: filters.from, modelId, to: filters.to }),
    listAccountingEntries({ currency, from: filters.from, modelId, to: filters.to })
  ]);
  const summaries = await listModelAccountSummaries({ currency, from: filters.from, to: filters.to });
  const summary = summaries.find((item) => item.modelId === modelId);

  return {
    currency,
    entries,
    from: filters.from,
    jobs,
    model: summary?.model ?? jobs[0]?.model ?? entries[0]?.model ?? null,
    summary,
    to: filters.to
  };
}

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AccountingCurrency } from "./finance-calculations";

export type FinancialReceipt = {
  amount: string | number;
  currency: AccountingCurrency;
  id: string;
  internal_note: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  received_on: string;
  status: "posted" | "void";
  void_reason: string | null;
};

export type FinancialJobEntry = {
  additional_fees_amount: string | number | null;
  agency_fee_amount: string | number | null;
  agency_fee_percent: string | number | null;
  client: { company_name: string | null; country: string | null; id: string } | null;
  client_amount_due: string | number | null;
  client_id: string | null;
  currency: AccountingCurrency;
  financial_review_required: boolean;
  financial_status: string;
  id: string;
  internal_notes: string | null;
  job: {
    brand_name: string | null;
    city: string | null;
    country: string | null;
    id: string;
    project_name: string | null;
    start_at: string;
    status: string;
    type: string;
  } | null;
  job_date: string;
  job_id: string | null;
  model: {
    display_name: string;
    id: string;
    main_image_path: string | null;
    stage_name: string | null;
  } | null;
  model_base_fee: string | number | null;
  model_deductions_amount: string | number | null;
  model_deductions_note: string | null;
  model_id: string;
  model_net_amount: string | number | null;
  receipts?: FinancialReceipt[];
  tax_amount: string | number | null;
  title: string;
};

const financialJobSelect = `
  *,
  client:clients (
    id,
    company_name,
    country
  ),
  model:models (
    id,
    display_name,
    stage_name,
    main_image_path
  ),
  job:jobs (
    id,
    type,
    status,
    project_name,
    brand_name,
    start_at,
    city,
    country
  )
`;

export type FinancialJobFilters = {
  currency?: AccountingCurrency;
  from?: string;
  modelId?: string;
  paymentStatus?: string;
  q?: string;
  to?: string;
};

export async function listFinancialJobs(filters: FinancialJobFilters = {}) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  let query = supabase
    .from("financial_job_entries")
    .select(financialJobSelect)
    .order("job_date", { ascending: false });

  if (filters.currency) query = query.eq("currency", filters.currency);
  if (filters.from) query = query.gte("job_date", filters.from);
  if (filters.to) query = query.lte("job_date", filters.to);
  if (filters.modelId) query = query.eq("model_id", filters.modelId);
  if (filters.q) {
    query = query.or(`title.ilike.%${filters.q}%,internal_notes.ilike.%${filters.q}%`);
  }

  const { data, error } = await query.limit(500);
  if (error) throw error;

  const jobs = (data ?? []) as FinancialJobEntry[];
  const receipts = await listReceipts(jobs.map((job) => job.id));

  return jobs
    .map((job) => ({ ...job, receipts: receipts.get(job.id) ?? [] }))
    .filter((job) => {
      if (!filters.paymentStatus) return true;
      if (filters.paymentStatus === "review") return job.financial_review_required;
      const status = deriveClientPaymentStatus(job);
      return filters.paymentStatus === status;
    });
}

export async function getFinancialJob(id: string) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_job_entries")
    .select(financialJobSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const receipts = await listReceipts([id]);
  return { ...data, receipts: receipts.get(id) ?? [] } as FinancialJobEntry;
}

export async function listReceipts(financialJobEntryIds: string[]) {
  const map = new Map<string, FinancialReceipt[]>();
  if (!financialJobEntryIds.length) return map;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_job_payment_receipts")
    .select("*")
    .in("financial_job_entry_id", financialJobEntryIds)
    .order("received_on", { ascending: false });

  if (error) throw error;

  for (const receipt of (data ?? []) as Array<FinancialReceipt & { financial_job_entry_id: string }>) {
    const current = map.get(receipt.financial_job_entry_id) ?? [];
    current.push(receipt);
    map.set(receipt.financial_job_entry_id, current);
  }

  return map;
}

export function deriveClientPaymentStatus(job: FinancialJobEntry) {
  const due = Number(job.client_amount_due ?? 0);
  const paid = (job.receipts ?? [])
    .filter((receipt) => receipt.status === "posted")
    .reduce((total, receipt) => total + Number(receipt.amount ?? 0), 0);

  if (due <= 0 || job.financial_review_required) return "review";
  if (paid <= 0) return "pending";
  if (paid + 0.004 < due) return "partially_received";
  return "received";
}

export function financialJobTitle(job: FinancialJobEntry) {
  return job.title || job.job?.project_name || job.job?.brand_name || "Trabalho financeiro";
}

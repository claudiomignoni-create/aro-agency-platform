"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  accountingCurrencies,
  accountingEntryTypes,
  type AccountingCurrency
} from "@/lib/accounting";
import { decimalToCents } from "@/lib/finance-calculations";
import { getFinancialJob } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

function requireText(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${key} é obrigatório.`);
  return value;
}

function requireCurrency(value: string) {
  if (!accountingCurrencies.includes(value as AccountingCurrency)) {
    throw new Error("Moeda inválida.");
  }

  return value as AccountingCurrency;
}

function requirePositiveAmount(value: string) {
  const cents = decimalToCents(value);
  if (cents <= BigInt(0)) {
    throw new Error("O valor deve ser positivo.");
  }
}

function requireOccurrenceCount(value: string) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 60) {
    throw new Error("A quantidade de ocorrências deve estar entre 1 e 60.");
  }
  return count;
}

function addPlanDate(dateKey: string, cadence: string, index: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (cadence === "weekly") {
    date.setUTCDate(date.getUTCDate() + index * 7);
  } else {
    date.setUTCMonth(date.getUTCMonth() + index);
  }

  return date.toISOString().slice(0, 10);
}

function planRequestKey(parts: Record<string, string>) {
  return createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 48);
}

function revalidateAccountingPaths(jobId?: string | null, modelId?: string | null) {
  revalidatePath("/admin/accounting");
  revalidatePath("/admin/accounting/expenses");
  revalidatePath("/admin/accounting/model-accounts");
  revalidatePath("/admin/accounting/reports");
  revalidatePath("/admin/calendar");

  if (jobId) revalidatePath(`/admin/accounting/${jobId}`);
  if (modelId) {
    revalidatePath(`/admin/accounting/models/${modelId}`);
    revalidatePath(`/admin/accounting/models/${modelId}/pdf`);
  }
}

export async function recordClientPaymentReceipt(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const financialJobEntryId = requireText(formData, "financial_job_entry_id");
  const amount = requireText(formData, "amount");
  const currency = requireCurrency(requireText(formData, "currency"));
  requirePositiveAmount(amount);

  const job = await getFinancialJob(financialJobEntryId);
  if (!job) throw new Error("Lançamento financeiro não encontrado.");
  if (job.financial_review_required) throw new Error("Revise este lançamento antes de registrar recebimento.");
  if (job.job?.status !== "confirmed" && job.job?.status !== "completed") {
    throw new Error("Somente trabalhos confirmados ou finalizados podem receber pagamento.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("financial_job_payment_receipts").insert({
    amount,
    created_by_user_id: profile.id,
    currency,
    financial_job_entry_id: financialJobEntryId,
    internal_note: optionalText(formData, "internal_note"),
    payment_method: optionalText(formData, "payment_method"),
    payment_reference: optionalText(formData, "payment_reference"),
    received_on: requireText(formData, "received_on"),
    status: "posted",
    updated_by_user_id: profile.id
  });

  if (error) throw error;

  revalidateAccountingPaths(financialJobEntryId, job.model_id);
  redirect(`/admin/accounting/${financialJobEntryId}?saved=receipt`);
}

export async function voidClientPaymentReceipt(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const receiptId = requireText(formData, "receipt_id");
  const financialJobEntryId = requireText(formData, "financial_job_entry_id");
  const reason = requireText(formData, "void_reason");

  const supabase = await createClient();
  const { error } = await supabase
    .from("financial_job_payment_receipts")
    .update({
      status: "void",
      updated_by_user_id: profile.id,
      void_reason: reason,
      voided_at: new Date().toISOString(),
      voided_by_user_id: profile.id
    })
    .eq("id", receiptId);

  if (error) throw error;

  revalidateAccountingPaths(financialJobEntryId);
  redirect(`/admin/accounting/${financialJobEntryId}?saved=receipt-void`);
}

export async function createModelAccountingEntry(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const entryType = requireText(formData, "entry_type");
  const currency = requireCurrency(requireText(formData, "currency"));
  const amount = requireText(formData, "amount");
  requirePositiveAmount(amount);

  if (!accountingEntryTypes.some((entry) => entry.value === entryType)) {
    throw new Error("Tipo de lançamento inválido.");
  }

  if (["credit_adjustment", "debit_adjustment"].includes(entryType)) {
    requireText(formData, "description");
  }

  if (["expense", "advance"].includes(entryType) && text(formData, "category") === "outro") {
    requireText(formData, "custom_category_label");
  }

  const modelId = requireText(formData, "model_id");
  const supabase = await createClient();
  const { error } = await supabase.from("model_accounting_entries").insert({
    amount,
    category: optionalText(formData, "category"),
    coverage_end_on: optionalText(formData, "coverage_end_on"),
    coverage_start_on: optionalText(formData, "coverage_start_on"),
    created_by_user_id: profile.id,
    currency,
    custom_category_label: optionalText(formData, "custom_category_label"),
    description: optionalText(formData, "description"),
    destination_city: optionalText(formData, "destination_city"),
    entry_type: entryType,
    internal_notes: optionalText(formData, "internal_notes"),
    model_id: modelId,
    occurred_on: requireText(formData, "occurred_on"),
    origin_city: optionalText(formData, "origin_city"),
    payment_method: optionalText(formData, "payment_method"),
    payment_reference: optionalText(formData, "payment_reference"),
    provider_name: optionalText(formData, "provider_name"),
    reference_code: optionalText(formData, "reference_code"),
    status: optionalText(formData, "status") ?? "posted",
    title: requireText(formData, "title"),
    updated_by_user_id: profile.id
  });

  if (error) throw error;

  revalidateAccountingPaths(null, modelId);
  redirect(`/admin/accounting/models/${modelId}?saved=entry`);
}

export async function createModelAccountingPlan(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const modelId = requireText(formData, "model_id");
  const entryType = requireText(formData, "entry_type");
  const category = requireText(formData, "category");
  const amount = requireText(formData, "amount");
  const currency = requireCurrency(requireText(formData, "currency"));
  const cadence = requireText(formData, "cadence");
  const startDate = requireText(formData, "start_date");
  const occurrenceCount = requireOccurrenceCount(requireText(formData, "occurrence_count"));
  const postingMode = requireText(formData, "posting_mode");
  const title = requireText(formData, "title");
  requirePositiveAmount(amount);

  if (!["expense", "advance"].includes(entryType)) {
    throw new Error("Planos recorrentes aceitam apenas despesa ou adiantamento.");
  }
  if (!["weekly", "monthly"].includes(cadence)) {
    throw new Error("Cadência inválida.");
  }
  if (!["post_all_now", "schedule_per_period"].includes(postingMode)) {
    throw new Error("Modo de contabilização inválido.");
  }
  if (category === "outro") {
    requireText(formData, "custom_category_label");
  }

  const requestKey = planRequestKey({
    amount,
    cadence,
    category,
    currency,
    entryType,
    modelId,
    occurrenceCount: String(occurrenceCount),
    postingMode,
    startDate,
    title
  });
  const supabase = await createClient();
  const { data: plan, error: planError } = await supabase
    .from("model_accounting_plans")
    .insert({
      amount,
      category,
      cadence,
      created_by_user_id: profile.id,
      currency,
      custom_category_label: optionalText(formData, "custom_category_label"),
      description: optionalText(formData, "description"),
      entry_type: entryType,
      model_id: modelId,
      occurrence_count: occurrenceCount,
      posting_mode: postingMode,
      request_key: requestKey,
      start_date: startDate,
      title,
      updated_by_user_id: profile.id
    })
    .select("id")
    .single();

  if (planError) throw planError;

  const entries = Array.from({ length: occurrenceCount }, (_, index) => {
    const occurrenceDate = addPlanDate(startDate, cadence, index);

    return {
      amount,
      category,
      created_by_user_id: profile.id,
      currency,
      custom_category_label: optionalText(formData, "custom_category_label"),
      description: optionalText(formData, "description"),
      entry_type: entryType,
      model_id: modelId,
      occurred_on: occurrenceDate,
      source_occurrence_date: occurrenceDate,
      source_plan_id: plan.id,
      status: postingMode === "post_all_now" ? "posted" : "scheduled",
      title,
      updated_by_user_id: profile.id
    };
  });
  const { error: entriesError } = await supabase
    .from("model_accounting_entries")
    .insert(entries);

  if (entriesError) throw entriesError;

  revalidateAccountingPaths(null, modelId);
  redirect(`/admin/accounting/expenses?saved=plan`);
}

export async function deactivateModelAccountingPlan(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const planId = requireText(formData, "plan_id");
  const modelId = requireText(formData, "model_id");
  const supabase = await createClient();
  const { error } = await supabase
    .from("model_accounting_plans")
    .update({
      active: false,
      updated_by_user_id: profile.id
    })
    .eq("id", planId);

  if (error) throw error;

  revalidateAccountingPaths(null, modelId);
  redirect("/admin/accounting/expenses?saved=plan-disabled");
}

export async function voidModelAccountingEntry(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const entryId = requireText(formData, "entry_id");
  const modelId = requireText(formData, "model_id");
  const reason = requireText(formData, "void_reason");

  const supabase = await createClient();
  const { error } = await supabase
    .from("model_accounting_entries")
    .update({
      status: "void",
      updated_by_user_id: profile.id,
      void_reason: reason,
      voided_at: new Date().toISOString(),
      voided_by_user_id: profile.id
    })
    .eq("id", entryId);

  if (error) throw error;

  revalidateAccountingPaths(null, modelId);
  redirect(`/admin/accounting/models/${modelId}?saved=entry-void`);
}

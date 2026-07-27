"use server";

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

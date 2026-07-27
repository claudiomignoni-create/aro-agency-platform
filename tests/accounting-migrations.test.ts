import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function migration(name: string) {
  return readFileSync(join(root, "supabase", "migrations", name), "utf8");
}

test("accounting backfill does not use job_models.final_amount as model base fee", () => {
  const sql = migration("011_accounting_base.sql");
  const modelBaseFeeSelect =
    sql.match(/j\.id,\s*\n\s*([^,\n]+),\s*\n\s*jm\.model_id/)?.[1] ?? "";

  assert.match(modelBaseFeeSelect, /jm\.fee_amount/);
  assert.doesNotMatch(modelBaseFeeSelect, /final_amount/);
  assert.match(sql, /jm\.fee_amount is null/);
  assert.match(sql, /financial_review_required/);
});

test("accounting receipts hard delete is blocked for every status", () => {
  const sql = migration("012_accounting_receipts_integrity.sql");
  const deleteFunction = sql.slice(sql.indexOf("create or replace function public.prevent_financial_job_payment_receipt_delete"));

  assert.match(deleteFunction, /accounting_receipts_cannot_be_deleted/);
  assert.doesNotMatch(deleteFunction, /old\.status = 'posted'/);
});

test("model accounting entries hard delete is blocked for every status", () => {
  const sql = migration("013_model_accounting_entries_plans.sql");
  const deleteFunction = sql.slice(sql.indexOf("create or replace function public.prevent_posted_accounting_entry_delete"));

  assert.match(deleteFunction, /model_accounting_entries_cannot_be_deleted/);
  assert.doesNotMatch(deleteFunction, /old\.status = 'posted'/);
  assert.match(sql, /model_accounting_plans_request_key_unique/);
});

test("release hardening includes safe backfill audit counts", () => {
  const sql = migration("015_accounting_hardening_reconciliation.sql");

  assert.match(sql, /accounting_backfill_audit/);
  assert.match(sql, /count\(\*\)/);
  assert.doesNotMatch(sql, /company_name|display_name|stage_name|legal_name/);
});

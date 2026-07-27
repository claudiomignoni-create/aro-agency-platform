import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type AccountingSchemaStatus = {
  missingClientColumns: string[];
  missingMigrations: string[];
  missingTables: string[];
  ready: boolean;
};

const accountingTables = [
  "financial_job_entries",
  "financial_job_payment_receipts",
  "model_accounting_entries",
  "model_accounting_plans"
] as const;

const essentialClientColumns = [
  "billing_person_type",
  "billing_cnpj",
  "billing_cpf",
  "intl_tax_id",
  "intl_vat_number",
  "default_currency"
] as const;

const migrationByObject: Record<string, string> = {
  default_currency: "014_clients_billing_tax_fields.sql",
  billing_cnpj: "014_clients_billing_tax_fields.sql",
  billing_cpf: "014_clients_billing_tax_fields.sql",
  billing_person_type: "014_clients_billing_tax_fields.sql",
  financial_job_entries: "011_accounting_base.sql",
  financial_job_payment_receipts: "012_accounting_receipts_integrity.sql",
  intl_tax_id: "014_clients_billing_tax_fields.sql",
  intl_vat_number: "014_clients_billing_tax_fields.sql",
  model_accounting_entries: "013_model_accounting_entries_plans.sql",
  model_accounting_plans: "013_model_accounting_entries_plans.sql"
};

export function isMissingSchemaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };

  return (
    maybeError.code === "PGRST205" ||
    maybeError.code === "42P01" ||
    maybeError.code === "42703" ||
    /Could not find the table|does not exist|schema cache/i.test(maybeError.message ?? "")
  );
}

function pendingMigrations(objects: string[]) {
  return Array.from(new Set(objects.map((object) => migrationByObject[object]).filter(Boolean)));
}

export async function getAccountingSchemaStatus(): Promise<AccountingSchemaStatus> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const missingTables: string[] = [];
  const missingClientColumns: string[] = [];

  for (const table of accountingTables) {
    const { error } = await supabase.from(table).select("id").limit(1);
    if (error && isMissingSchemaError(error)) {
      missingTables.push(table);
    } else if (error) {
      console.error("[accounting:schema-check]", {
        code: error.code,
        object: table
      });
    }
  }

  const { error: clientColumnError } = await supabase
    .from("clients")
    .select(["id", ...essentialClientColumns].join(", "))
    .limit(1);

  if (clientColumnError && isMissingSchemaError(clientColumnError)) {
    missingClientColumns.push(...essentialClientColumns);
  } else if (clientColumnError) {
    console.error("[accounting:client-schema-check]", {
      code: clientColumnError.code
    });
  }

  const missingObjects = [...missingTables, ...missingClientColumns];

  return {
    missingClientColumns,
    missingMigrations: pendingMigrations(missingObjects),
    missingTables,
    ready: missingObjects.length === 0
  };
}

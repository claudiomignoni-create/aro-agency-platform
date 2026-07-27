import assert from "node:assert/strict";
import test from "node:test";
import { isMissingClientBillingSchemaError } from "../src/lib/clients";

test("client billing schema fallback is scoped to billing columns", () => {
  assert.equal(
    isMissingClientBillingSchemaError({
      code: "42703",
      message: "column clients.billing_person_type does not exist"
    }),
    true
  );

  assert.equal(
    isMissingClientBillingSchemaError({
      code: "PGRST204",
      message:
        "Could not find the 'intl_vat_number' column of 'clients' in the schema cache"
    }),
    true
  );

  assert.equal(
    isMissingClientBillingSchemaError({
      code: "42703",
      message: "column clients.company_name does not exist"
    }),
    false
  );

  assert.equal(
    isMissingClientBillingSchemaError({
      code: "PGRST205",
      message: "Could not find the table 'public.clients' in the schema cache"
    }),
    false
  );
});

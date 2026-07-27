import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAroFinancialAmounts,
  defaultAccountingCurrency,
  formatMoney
} from "../src/lib/finance-calculations";

test("ARO agency fee is added to the client amount and does not reduce model base fee", () => {
  const result = calculateAroFinancialAmounts({
    agencyFeePercent: 20,
    modelBaseFee: 1000
  });

  assert.equal(result.agencyFeeAmount, 200);
  assert.equal(result.clientAmountDue, 1200);
  assert.equal(result.modelNetAmount, 1000);
});

test("explicit model deductions reduce model net amount only", () => {
  const result = calculateAroFinancialAmounts({
    agencyFeePercent: 20,
    deductionsAmount: 150,
    modelBaseFee: 1000
  });

  assert.equal(result.clientAmountDue, 1200);
  assert.equal(result.modelNetAmount, 850);
});

test("BRL is the default operational currency", () => {
  assert.equal(defaultAccountingCurrency, "BRL");
  assert.match(formatMoney(1200), /R\$/);
});

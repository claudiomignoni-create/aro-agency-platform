import assert from "node:assert/strict";
import test from "node:test";
import {
  modelStatementPdfFileName,
  renderModelStatementPdfDocument
} from "../src/lib/accounting-pdf-document";

const statement = {
  currency: "BRL",
  entries: [],
  from: "2026-07-01",
  jobs: [],
  model: {
    display_name: "Maria Teste",
    id: "model-1",
    stage_name: "Maria ARO"
  },
  summary: {
    available: 1000,
    currency: "BRL",
    expenses: 0,
    model: null,
    modelId: "model-1",
    paidJobs: 1000,
    payouts: 0,
    pendingClient: 0
  },
  to: "2026-07-31"
} as never;

test("model statement PDF uses AROLAB naming and BRL", () => {
  assert.equal(modelStatementPdfFileName(statement), "AROLAB-MARIA-ARO-BRL-EXTRATO.pdf");
  const pdf = renderModelStatementPdfDocument(statement).toString("utf8");

  assert.match(pdf, /^%PDF-1.4/);
  assert.match(pdf, /AROLAB/);
  assert.match(pdf, /BRL/);
  assert.equal(pdf.includes(["VE", "IN"].join("")), false);
  assert.doesNotMatch(pdf, /THB/);
});

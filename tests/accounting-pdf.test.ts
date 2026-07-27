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
};

test("model statement PDF uses AROLAB naming and BRL", () => {
  assert.equal(modelStatementPdfFileName(statement as never), "AROLAB-MARIA-ARO-BRL-EXTRATO.pdf");
  const pdf = renderModelStatementPdfDocument(statement as never).toString("utf8");

  assert.match(pdf, /^%PDF-1.4/);
  assert.match(pdf, /ARO/);
  assert.match(pdf, /LAB/);
  assert.match(pdf, /BRL/);
  assert.equal(pdf.includes(["VE", "IN"].join("")), false);
  assert.doesNotMatch(pdf, /THB/);
});

test("model statement PDF paginates without dropping long statements", () => {
  const longStatement = {
    ...statement,
    jobs: Array.from({ length: 70 }, (_, index) => ({
      client_amount_due: 1200,
      currency: "BRL",
      id: `job-${index}`,
      job_date: `2026-07-${String((index % 28) + 1).padStart(2, "0")}`,
      model_net_amount: 1000,
      receipts: [{ amount: 1200, status: "posted" }],
      title: `Trabalho ${index + 1}`
    })),
    entries: Array.from({ length: 70 }, (_, index) => ({
      amount: 100,
      currency: "BRL",
      entry_type: "expense",
      id: `entry-${index}`,
      occurred_on: `2026-07-${String((index % 28) + 1).padStart(2, "0")}`,
      status: "posted",
      title: `Despesa ${index + 1}`
    }))
  } as never;
  const pdf = renderModelStatementPdfDocument(longStatement).toString("utf8");

  assert.match(pdf, /Página 2 de/);
  assert.match(pdf, /Trabalho 70/);
  assert.match(pdf, /Despesa 70/);
});

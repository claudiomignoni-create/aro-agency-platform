import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
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

test("model statement PDF uses official ARO naming and BRL", async () => {
  assert.equal(modelStatementPdfFileName(statement as never), "ARO-EXTRATO-MARIA-ARO-2026-07-01-2026-07-31-BRL.pdf");

  const pdf = await renderModelStatementPdfDocument(statement as never);
  const rawPdf = pdf.toString("latin1");
  const pdfDoc = await PDFDocument.load(pdf);

  assert.match(rawPdf, /^%PDF-1.7/);
  assert.equal(pdfDoc.getPageCount(), 1);
  assert.equal(rawPdf.includes(["V", "E", "I", "N"].join("")), false);
  assert.equal(rawPdf.includes(["L", "A", "B"].join("")), false);
  assert.equal(rawPdf.includes(["A", "R", "O", "L", "A", "B"].join("")), false);
  assert.doesNotMatch(rawPdf, /THB/);
});

test("model statement PDF uses the real brand image and no manual string renderer", async () => {
  const source = await readFile("src/lib/accounting-pdf-document.ts", "utf8");

  assert.match(source, /embedPng/);
  assert.match(source, /public\", \"brand\", \"aro-mark-white\.png\"/);
  assert.doesNotMatch(source, /function truncate/);
  assert.doesNotMatch(source, /\\.\\.\\./);
  assert.doesNotMatch(source, /pdfEscape/);
  assert.doesNotMatch(source, /\/BaseFont/);
  assert.doesNotMatch(source, new RegExp(`text\\\\\\("ARO"[^]*text\\\\\\("${["L", "A", "B"].join("")}"`));
});

test("model statement PDF paginates 100 records without dropping long text", async () => {
  const longTitle =
    "Campanha financeira internacional com descrição longa de aprovação, produção, uso de imagem e observações operacionais completas";
  const longStatement = {
    ...statement,
    jobs: Array.from({ length: 100 }, (_, index) => ({
      client_amount_due: 1200,
      currency: "BRL",
      id: `job-${index}`,
      job_date: `2026-07-${String((index % 28) + 1).padStart(2, "0")}`,
      model_net_amount: 1000,
      receipts: [{ amount: 1200, status: "posted" }],
      title: `${longTitle} ${index + 1}`
    })),
    entries: Array.from({ length: 100 }, (_, index) => ({
      amount: 100,
      currency: "BRL",
      entry_type: "expense",
      id: `entry-${index}`,
      occurred_on: `2026-07-${String((index % 28) + 1).padStart(2, "0")}`,
      status: "posted",
      title: `Despesa operacional com texto completo e sem corte ${index + 1}`
    }))
  } as never;
  const pdf = await renderModelStatementPdfDocument(longStatement);
  const pdfDoc = await PDFDocument.load(pdf);

  assert.ok(pdfDoc.getPageCount() >= 8);
  assert.ok(pdf.byteLength > 20000);
});

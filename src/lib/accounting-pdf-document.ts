import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { formatMoney } from "@/lib/accounting";
import { financialJobTitle } from "@/lib/finance";
import type { buildModelStatement } from "@/lib/accounting";

type Statement = Awaited<ReturnType<typeof buildModelStatement>>;

type PdfRow =
  | { kind: "section"; title: string }
  | { amount: string; date: string; detail: string; kind: "row"; title: string };

type PdfFonts = {
  bold: PDFFont;
  regular: PDFFont;
};

type Cursor = {
  page: PDFPage;
  pageNumber: number;
  y: number;
};

const a4 = {
  height: 841.89,
  margin: 38,
  width: 595.28
};

const colors = {
  accent: rgb(0.22, 0.54, 0.95),
  background: rgb(0.012, 0.045, 0.12),
  border: rgb(0.24, 0.42, 0.68),
  card: rgb(0.035, 0.13, 0.29),
  header: rgb(0.025, 0.16, 0.38),
  muted: rgb(0.68, 0.78, 0.93),
  positive: rgb(0.54, 0.96, 0.72),
  text: rgb(0.96, 0.98, 1),
  white: rgb(1, 1, 1)
};

function cleanFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

function periodLabel(statement: Statement) {
  return `${statement.from ?? "INICIO"}-${statement.to ?? "HOJE"}`;
}

function modelName(statement: Statement) {
  return statement.model?.stage_name || statement.model?.display_name || "Modelo";
}

function hasFullClientPayment(job: Statement["jobs"][number]) {
  const due = Number(job.client_amount_due ?? 0);
  const paid = (job.receipts ?? [])
    .filter((receipt) => receipt.status === "posted")
    .reduce((total, receipt) => total + Number(receipt.amount ?? 0), 0);

  return due > 0 && paid >= due;
}

function entryTypeLabel(type: string) {
  const labels: Record<string, string> = {
    advance: "Adiantamento",
    credit_adjustment: "Ajuste de crédito",
    debit_adjustment: "Ajuste de débito",
    expense: "Despesa",
    model_payout: "Pagamento"
  };
  return labels[type] ?? type;
}

function rowsForStatement(statement: Statement): PdfRow[] {
  const paidJobs = statement.jobs.filter(hasFullClientPayment);
  const pendingJobs = statement.jobs.filter((job) => !hasFullClientPayment(job));
  const expenses = statement.entries.filter((entry) => entry.entry_type === "expense");
  const advances = statement.entries.filter((entry) => entry.entry_type === "advance");
  const payouts = statement.entries.filter((entry) => entry.entry_type === "model_payout");
  const adjustments = statement.entries.filter((entry) =>
    ["credit_adjustment", "debit_adjustment"].includes(entry.entry_type)
  );
  const voided = statement.entries.filter((entry) => entry.status === "void");
  const rows: PdfRow[] = [];

  function addSection(title: string, items: PdfRow[]) {
    rows.push({ kind: "section", title });
    if (items.length) {
      rows.push(...items);
    } else {
      rows.push({
        amount: "—",
        date: "—",
        detail: "Sem registros",
        kind: "row",
        title: "Nenhum item neste período"
      });
    }
  }

  addSection(
    "Trabalhos pagos",
    paidJobs.map((job) => ({
      amount: formatMoney(job.model_net_amount, job.currency),
      date: job.job_date,
      detail: `Cliente ${formatMoney(job.client_amount_due, job.currency)}`,
      kind: "row",
      title: financialJobTitle(job)
    }))
  );
  addSection(
    "Trabalhos pendentes",
    pendingJobs.map((job) => ({
      amount: formatMoney(job.model_net_amount, job.currency),
      date: job.job_date,
      detail: `Cliente ${formatMoney(job.client_amount_due, job.currency)}`,
      kind: "row",
      title: financialJobTitle(job)
    }))
  );
  addSection(
    "Despesas",
    expenses.map((entry) => ({
      amount: formatMoney(entry.amount, entry.currency),
      date: entry.occurred_on,
      detail: entry.status,
      kind: "row",
      title: entry.title
    }))
  );
  addSection(
    "Adiantamentos",
    advances.map((entry) => ({
      amount: formatMoney(entry.amount, entry.currency),
      date: entry.occurred_on,
      detail: entry.status,
      kind: "row",
      title: entry.title
    }))
  );
  addSection(
    "Pagamentos",
    payouts.map((entry) => ({
      amount: formatMoney(entry.amount, entry.currency),
      date: entry.occurred_on,
      detail: entry.status,
      kind: "row",
      title: entry.title
    }))
  );
  addSection(
    "Ajustes",
    adjustments.map((entry) => ({
      amount: formatMoney(entry.amount, entry.currency),
      date: entry.occurred_on,
      detail: entryTypeLabel(entry.entry_type),
      kind: "row",
      title: entry.title
    }))
  );
  addSection(
    "Anulados",
    voided.map((entry) => ({
      amount: formatMoney(entry.amount, entry.currency),
      date: entry.occurred_on,
      detail: entry.void_reason ?? "Sem motivo informado",
      kind: "row",
      title: entry.title
    }))
  );

  return rows;
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }

    let segment = "";
    for (const char of word) {
      const next = `${segment}${char}`;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        segment = next;
      } else {
        if (segment) lines.push(segment);
        segment = char;
      }
    }
    current = segment;
  }

  if (current) lines.push(current);
  return lines.length ? lines : ["—"];
}

function drawTextBlock(
  page: PDFPage,
  lines: string[],
  x: number,
  y: number,
  options: {
    color?: ReturnType<typeof rgb>;
    font: PDFFont;
    lineHeight?: number;
    size: number;
  }
) {
  const lineHeight = options.lineHeight ?? options.size + 4;
  lines.forEach((line, index) => {
    page.drawText(line, {
      color: options.color ?? colors.text,
      font: options.font,
      size: options.size,
      x,
      y: y - index * lineHeight
    });
  });
}

function rowHeight(row: PdfRow, fonts: PdfFonts) {
  if (row.kind === "section") return 25;

  const titleLines = wrapText(row.title, fonts.regular, 8.5, 230);
  const detailLines = wrapText(row.detail, fonts.regular, 8, 96);
  return Math.max(28, Math.max(titleLines.length, detailLines.length) * 12 + 14);
}

function drawBackground(page: PDFPage) {
  page.drawRectangle({
    color: colors.background,
    height: a4.height,
    width: a4.width,
    x: 0,
    y: 0
  });
  page.drawRectangle({
    color: colors.header,
    height: 126,
    width: a4.width,
    x: 0,
    y: a4.height - 126
  });
}

async function readLogo() {
  return readFile(path.join(process.cwd(), "public", "brand", "aro-mark-white.png"));
}

async function drawHeader(pdfDoc: PDFDocument, cursor: Cursor, statement: Statement, fonts: PdfFonts) {
  const logo = await pdfDoc.embedPng(await readLogo());
  const logoSize = 38;
  const x = a4.margin;
  const top = a4.height - a4.margin;

  cursor.page.drawImage(logo, {
    height: logoSize,
    width: logoSize,
    x,
    y: top - logoSize
  });
  cursor.page.drawText("ARO", {
    color: colors.white,
    font: fonts.bold,
    size: 16,
    x: x + logoSize + 12,
    y: top - 25
  });
  cursor.page.drawText("Extrato financeiro", {
    color: colors.muted,
    font: fonts.regular,
    size: 9,
    x: x + logoSize + 12,
    y: top - 40
  });
  cursor.page.drawText(modelName(statement), {
    color: colors.white,
    font: fonts.bold,
    size: 20,
    x,
    y: top - 78
  });
  cursor.page.drawText(`Período: ${statement.from ?? "início"} até ${statement.to ?? "hoje"}`, {
    color: colors.muted,
    font: fonts.regular,
    size: 8.5,
    x: 360,
    y: top - 24
  });
  cursor.page.drawText(`Moeda: ${statement.currency}`, {
    color: colors.muted,
    font: fonts.regular,
    size: 8.5,
    x: 360,
    y: top - 39
  });
}

function drawSummary(cursor: Cursor, statement: Statement, fonts: PdfFonts) {
  const cards = [
    ["Disponível", formatMoney(statement.summary?.available, statement.currency)],
    ["Pendente de clientes", formatMoney(statement.summary?.pendingClient, statement.currency)],
    ["Pagamentos", formatMoney(statement.summary?.payouts, statement.currency)]
  ];

  cards.forEach(([label, value], index) => {
    const x = a4.margin + index * 172;
    const y = a4.height - 182;
    cursor.page.drawRectangle({
      borderColor: colors.border,
      borderWidth: 0.7,
      color: colors.card,
      height: 46,
      width: 158,
      x,
      y
    });
    cursor.page.drawText(label, {
      color: colors.muted,
      font: fonts.bold,
      size: 7.8,
      x: x + 10,
      y: y + 28
    });
    cursor.page.drawText(value, {
      color: colors.white,
      font: fonts.bold,
      size: 12,
      x: x + 10,
      y: y + 11
    });
  });
}

function drawTableHeader(cursor: Cursor, fonts: PdfFonts) {
  cursor.page.drawRectangle({
    color: colors.card,
    height: 22,
    width: a4.width - a4.margin * 2,
    x: a4.margin,
    y: cursor.y - 5
  });
  const columns: Array<[string, number]> = [
    ["DATA", a4.margin + 10],
    ["DESCRIÇÃO", a4.margin + 82],
    ["DETALHE", a4.margin + 330],
    ["VALOR", a4.margin + 438]
  ];

  columns.forEach(([label, x]) => {
    cursor.page.drawText(label, {
      color: colors.muted,
      font: fonts.bold,
      size: 7,
      x,
      y: cursor.y + 2
    });
  });
  cursor.y -= 30;
}

function addPage(pdfDoc: PDFDocument, statement: Statement, fonts: PdfFonts, pageNumber: number) {
  const page = pdfDoc.addPage([a4.width, a4.height]);
  const cursor = {
    page,
    pageNumber,
    y: a4.height - 155
  };
  drawBackground(page);
  return cursor;
}

function drawRow(cursor: Cursor, row: PdfRow, fonts: PdfFonts) {
  const height = rowHeight(row, fonts);

  if (row.kind === "section") {
    cursor.page.drawRectangle({
      color: colors.accent,
      height: 18,
      width: a4.width - a4.margin * 2,
      x: a4.margin,
      y: cursor.y - 2
    });
    cursor.page.drawText(row.title.toUpperCase(), {
      color: colors.white,
      font: fonts.bold,
      size: 8,
      x: a4.margin + 10,
      y: cursor.y + 3
    });
    cursor.y -= height;
    return;
  }

  cursor.page.drawRectangle({
    borderColor: rgb(0.08, 0.18, 0.36),
    borderWidth: 0.5,
    color: rgb(0.012, 0.065, 0.15),
    height: height - 3,
    width: a4.width - a4.margin * 2,
    x: a4.margin,
    y: cursor.y - height + 10
  });
  cursor.page.drawText(row.date, {
    color: colors.muted,
    font: fonts.regular,
    size: 8,
    x: a4.margin + 10,
    y: cursor.y - 5
  });
  drawTextBlock(cursor.page, wrapText(row.title, fonts.regular, 8.5, 230), a4.margin + 82, cursor.y - 5, {
    color: colors.text,
    font: fonts.regular,
    lineHeight: 11,
    size: 8.5
  });
  drawTextBlock(cursor.page, wrapText(row.detail, fonts.regular, 8, 96), a4.margin + 330, cursor.y - 5, {
    color: colors.muted,
    font: fonts.regular,
    lineHeight: 10.5,
    size: 8
  });
  drawTextBlock(cursor.page, wrapText(row.amount, fonts.bold, 8.5, 78), a4.margin + 438, cursor.y - 5, {
    color: colors.positive,
    font: fonts.bold,
    lineHeight: 10.5,
    size: 8.5
  });
  cursor.y -= height;
}

function drawFooter(page: PDFPage, fonts: PdfFonts, pageNumber: number, pageCount: number) {
  page.drawText(`Página ${pageNumber} de ${pageCount}`, {
    color: colors.muted,
    font: fonts.regular,
    size: 8,
    x: a4.width - a4.margin - 74,
    y: 24
  });
  page.drawText("Documento financeiro interno. Não inclui dados fiscais pessoais.", {
    color: colors.muted,
    font: fonts.regular,
    size: 7.5,
    x: a4.margin,
    y: 24
  });
}

export function modelStatementPdfFileName(statement: Statement) {
  const safeModel = cleanFilePart(modelName(statement)) || "MODELO";
  const safePeriod = cleanFilePart(periodLabel(statement)) || "PERIODO";

  return `ARO-EXTRATO-${safeModel}-${safePeriod}-${statement.currency}.pdf`;
}

export async function renderModelStatementPdfDocument(statement: Statement) {
  const pdfDoc = await PDFDocument.create();
  const fonts = {
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica)
  };
  const rows = rowsForStatement(statement);
  let cursor = addPage(pdfDoc, statement, fonts, 1);

  await drawHeader(pdfDoc, cursor, statement, fonts);
  drawSummary(cursor, statement, fonts);
  cursor.y = a4.height - 238;
  drawTableHeader(cursor, fonts);

  for (const row of rows) {
    const nextHeight = rowHeight(row, fonts);
    if (cursor.y - nextHeight < 52) {
      cursor = addPage(pdfDoc, statement, fonts, pdfDoc.getPageCount() + 1);
      await drawHeader(pdfDoc, cursor, statement, fonts);
      cursor.y = a4.height - 166;
      drawTableHeader(cursor, fonts);
    }
    drawRow(cursor, row, fonts);
  }

  const pageCount = pdfDoc.getPageCount();
  pdfDoc.getPages().forEach((page, index) => drawFooter(page, fonts, index + 1, pageCount));

  return Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
}

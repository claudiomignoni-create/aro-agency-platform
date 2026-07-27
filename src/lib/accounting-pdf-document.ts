import { formatMoney } from "@/lib/accounting";
import { financialJobTitle } from "@/lib/finance";
import type { buildModelStatement } from "@/lib/accounting";

type Statement = Awaited<ReturnType<typeof buildModelStatement>>;

type PdfRow =
  | { kind: "section"; title: string }
  | { kind: "row"; amount: string; date: string; meta: string; title: string };

const page = {
  height: 842,
  margin: 42,
  width: 595
};

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function text(value: string, x: number, y: number, size = 9, font = "F1") {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET`;
}

function color(r: number, g: number, b: number) {
  return `${r} ${g} ${b} rg`;
}

function rect(x: number, y: number, width: number, height: number) {
  return `${x} ${y} ${width} ${height} re f`;
}

function truncate(value: string, length = 72) {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
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
      rows.push({ kind: "row", amount: "—", date: "—", meta: "Sem registros", title: "Nenhum item neste período" });
    }
  }

  addSection(
    "Trabalhos pagos",
    paidJobs.map((job) => ({
      amount: formatMoney(job.model_net_amount, job.currency),
      date: job.job_date,
      kind: "row",
      meta: `Cliente ${formatMoney(job.client_amount_due, job.currency)}`,
      title: financialJobTitle(job)
    }))
  );
  addSection(
    "Trabalhos pendentes",
    pendingJobs.map((job) => ({
      amount: formatMoney(job.model_net_amount, job.currency),
      date: job.job_date,
      kind: "row",
      meta: `Cliente ${formatMoney(job.client_amount_due, job.currency)}`,
      title: financialJobTitle(job)
    }))
  );
  addSection(
    "Despesas",
    expenses.map((entry) => ({
      amount: formatMoney(entry.amount, entry.currency),
      date: entry.occurred_on,
      kind: "row",
      meta: entry.status,
      title: entry.title
    }))
  );
  addSection(
    "Adiantamentos",
    advances.map((entry) => ({
      amount: formatMoney(entry.amount, entry.currency),
      date: entry.occurred_on,
      kind: "row",
      meta: entry.status,
      title: entry.title
    }))
  );
  addSection(
    "Pagamentos",
    payouts.map((entry) => ({
      amount: formatMoney(entry.amount, entry.currency),
      date: entry.occurred_on,
      kind: "row",
      meta: entry.status,
      title: entry.title
    }))
  );
  addSection(
    "Ajustes",
    adjustments.map((entry) => ({
      amount: formatMoney(entry.amount, entry.currency),
      date: entry.occurred_on,
      kind: "row",
      meta: entryTypeLabel(entry.entry_type),
      title: entry.title
    }))
  );
  addSection(
    "Itens anulados",
    voided.map((entry) => ({
      amount: formatMoney(entry.amount, entry.currency),
      date: entry.occurred_on,
      kind: "row",
      meta: entry.void_reason ?? "Sem motivo",
      title: entry.title
    }))
  );

  return rows;
}

function splitRows(rows: PdfRow[], size: number) {
  const pages: PdfRow[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    pages.push(rows.slice(index, index + size));
  }
  return pages.length ? pages : [[]];
}

function headerCommands(statement: Statement, model: string, emittedAt: string, pageNumber: number, pageCount: number) {
  const period = `${statement.from ?? "início"} até ${statement.to ?? "hoje"}`;

  return [
    color(0.01, 0.05, 0.14),
    rect(0, 0, page.width, page.height),
    color(0.03, 0.18, 0.42),
    rect(0, 710, page.width, 132),
    color(0.17, 0.46, 0.86),
    rect(page.margin, 765, 74, 30),
    color(1, 1, 1),
    text("ARO", page.margin + 13, 776, 16, "F2"),
    color(0.72, 0.86, 1),
    text("LAB", page.margin + 45, 776, 16, "F2"),
    color(1, 1, 1),
    text("Extrato financeiro do modelo", page.margin, 735, 15, "F2"),
    text(model, page.margin, 714, 22, "F2"),
    color(0.74, 0.84, 1),
    text(`Período: ${period}`, 330, 756, 9),
    text(`Moeda: ${statement.currency}`, 330, 740, 9),
    text(`Emitido: ${emittedAt}`, 330, 724, 9),
    color(0.58, 0.74, 1),
    text(`Página ${pageNumber} de ${pageCount}`, 474, 32, 8)
  ].join("\n");
}

function summaryCommands(statement: Statement) {
  const cards = [
    ["Disponível", formatMoney(statement.summary?.available, statement.currency)],
    ["Pendente clientes", formatMoney(statement.summary?.pendingClient, statement.currency)],
    ["Pagamentos", formatMoney(statement.summary?.payouts, statement.currency)]
  ];

  return cards
    .flatMap(([label, value], index) => {
      const x = page.margin + index * 170;
      return [
        color(0.04, 0.16, 0.34),
        rect(x, 642, 156, 48),
        color(0.45, 0.65, 0.96),
        text(label, x + 12, 672, 8, "F2"),
        color(1, 1, 1),
        text(value, x + 12, 652, 13, "F2")
      ];
    })
    .join("\n");
}

function tableHeaderCommands(y: number) {
  return [
    color(0.04, 0.16, 0.34),
    rect(page.margin, y - 6, 511, 24),
    color(0.72, 0.86, 1),
    text("DATA", page.margin + 10, y + 2, 7, "F2"),
    text("DESCRIÇÃO", page.margin + 94, y + 2, 7, "F2"),
    text("DETALHE", page.margin + 342, y + 2, 7, "F2"),
    text("VALOR", page.margin + 444, y + 2, 7, "F2")
  ].join("\n");
}

function rowCommands(row: PdfRow, y: number) {
  if (row.kind === "section") {
    return [
      color(0.12, 0.34, 0.66),
      rect(page.margin, y - 7, 511, 21),
      color(1, 1, 1),
      text(row.title.toUpperCase(), page.margin + 10, y, 8, "F2")
    ].join("\n");
  }

  return [
    color(0.015, 0.08, 0.18),
    rect(page.margin, y - 8, 511, 22),
    color(0.72, 0.82, 0.98),
    text(row.date, page.margin + 10, y, 8),
    color(1, 1, 1),
    text(truncate(row.title, 46), page.margin + 94, y, 8),
    color(0.64, 0.76, 0.95),
    text(truncate(row.meta, 22), page.margin + 342, y, 8),
    color(0.72, 1, 0.86),
    text(truncate(row.amount, 18), page.margin + 444, y, 8, "F2")
  ].join("\n");
}

export function modelStatementPdfFileName(statement: Statement) {
  const model = statement.model?.stage_name || statement.model?.display_name || "MODELO";
  const safeModel = model
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();

  return `AROLAB-${safeModel || "MODELO"}-${statement.currency}-EXTRATO.pdf`;
}

export function renderModelStatementPdfDocument(statement: Statement) {
  const model = statement.model?.stage_name || statement.model?.display_name || "Modelo";
  const emittedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date());
  const rows = rowsForStatement(statement);
  const rowPages = splitRows(rows, 24);
  const objects: string[] = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    `2 0 obj << /Type /Pages /Kids [${rowPages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${rowPages.length} >> endobj`
  ];
  const fontRegularObjectId = 3 + rowPages.length * 2;
  const fontBoldObjectId = fontRegularObjectId + 1;

  rowPages.forEach((pageRows, pageIndex) => {
    const pageObjectId = 3 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    const startY = pageIndex === 0 ? 610 : 660;
    const content = [
      headerCommands(statement, model, emittedAt, pageIndex + 1, rowPages.length),
      pageIndex === 0 ? summaryCommands(statement) : "",
      tableHeaderCommands(startY),
      ...pageRows.map((row, index) => rowCommands(row, startY - 30 - index * 22))
    ].join("\n");
    const contentLength = Buffer.byteLength(content, "utf8");

    objects.push(
      `${pageObjectId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 ${fontRegularObjectId} 0 R /F2 ${fontBoldObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >> endobj`,
      `${contentObjectId} 0 obj << /Length ${contentLength} >> stream\n${content}\nendstream endobj`
    );
  });

  objects.push(
    `${fontRegularObjectId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`,
    `${fontBoldObjectId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj`
  );
  let offset = "%PDF-1.4\n".length;
  const xref = ["0000000000 65535 f "];
  const body = `${objects
    .map((object) => {
      xref.push(`${String(offset).padStart(10, "0")} 00000 n `);
      offset += Buffer.byteLength(`${object}\n`, "utf8");
      return object;
    })
    .join("\n")}\n`;
  const xrefStart = offset;
  const trailer = `xref\n0 ${xref.length}\n${xref.join("\n")}\ntrailer << /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(`%PDF-1.4\n${body}${trailer}`, "utf8");
}

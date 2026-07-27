import { formatMoney } from "@/lib/accounting";
import { financialJobTitle } from "@/lib/finance";
import type { buildModelStatement } from "@/lib/accounting";

type Statement = Awaited<ReturnType<typeof buildModelStatement>>;

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function line(text: string, y: number, size = 10) {
  return `BT /F1 ${size} Tf 48 ${y} Td (${pdfEscape(text)}) Tj ET`;
}

function truncate(value: string, length = 92) {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

function section(title: string, rows: string[]) {
  return ["", title.toUpperCase(), ...rows];
}

function hasFullClientPayment(job: Statement["jobs"][number]) {
  const due = Number(job.client_amount_due ?? 0);
  const paid = (job.receipts ?? [])
    .filter((receipt) => receipt.status === "posted")
    .reduce((total, receipt) => total + Number(receipt.amount ?? 0), 0);

  return due > 0 && paid >= due;
}

function splitRows(rows: string[], size: number) {
  const pages: string[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    pages.push(rows.slice(index, index + size));
  }
  return pages.length ? pages : [[]];
}

function logoCommands() {
  return [
    "0.03 0.15 0.32 rg",
    "44 780 96 34 re f",
    "1 1 1 rg",
    line("ARO", 792, 18),
    "0.55 0.78 1 rg",
    line("LAB", 792, 18),
    "0 0 0 rg"
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
  const paidJobs = statement.jobs.filter(hasFullClientPayment);
  const pendingJobs = statement.jobs.filter((job) => !hasFullClientPayment(job));
  const expenses = statement.entries.filter((entry) => entry.entry_type === "expense");
  const advances = statement.entries.filter((entry) => entry.entry_type === "advance");
  const payouts = statement.entries.filter((entry) => entry.entry_type === "model_payout");
  const adjustments = statement.entries.filter((entry) =>
    ["credit_adjustment", "debit_adjustment"].includes(entry.entry_type)
  );
  const voided = statement.entries.filter((entry) => entry.status === "void");
  const rows = [
    `Extrato do modelo: ${model}`,
    `Emitido em: ${emittedAt}`,
    `Periodo: ${statement.from ?? "inicio"} ate ${statement.to ?? "hoje"}`,
    `Moeda: ${statement.currency}`,
    `Disponivel para pagamento: ${formatMoney(statement.summary?.available, statement.currency)}`,
    `Pendente de clientes: ${formatMoney(statement.summary?.pendingClient, statement.currency)}`,
    `Pagamentos realizados: ${formatMoney(statement.summary?.payouts, statement.currency)}`,
    ...section(
      "Trabalhos pagos",
      paidJobs.map((job) =>
        truncate(`${job.job_date} | ${financialJobTitle(job)} | Cliente ${formatMoney(job.client_amount_due, job.currency)} | Modelo ${formatMoney(job.model_net_amount, job.currency)}`)
      )
    ),
    ...section(
      "Trabalhos pendentes",
      pendingJobs.map((job) =>
        truncate(`${job.job_date} | ${financialJobTitle(job)} | Cliente ${formatMoney(job.client_amount_due, job.currency)} | Modelo previsto ${formatMoney(job.model_net_amount, job.currency)}`)
      )
    ),
    ...section(
      "Despesas",
      expenses.map((entry) =>
        truncate(`${entry.occurred_on} | ${entry.title} | ${formatMoney(entry.amount, entry.currency)} | ${entry.status}`)
      )
    ),
    ...section(
      "Adiantamentos",
      advances.map((entry) =>
        truncate(`${entry.occurred_on} | ${entry.title} | ${formatMoney(entry.amount, entry.currency)} | ${entry.status}`)
      )
    ),
    ...section(
      "Pagamentos",
      payouts.map((entry) =>
        truncate(`${entry.occurred_on} | ${entry.title} | ${formatMoney(entry.amount, entry.currency)} | ${entry.status}`)
      )
    ),
    ...section(
      "Ajustes",
      adjustments.map((entry) =>
        truncate(`${entry.occurred_on} | ${entry.entry_type} | ${entry.title} | ${formatMoney(entry.amount, entry.currency)} | ${entry.status}`)
      )
    ),
    ...section(
      "Itens anulados",
      voided.map((entry) =>
        truncate(`${entry.occurred_on} | ${entry.entry_type} | ${entry.title} | ${formatMoney(entry.amount, entry.currency)} | ${entry.void_reason ?? "sem motivo"}`)
      )
    )
  ];
  const pages = splitRows(rows, 42);
  const objects: string[] = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    `2 0 obj << /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >> endobj`
  ];
  const fontObjectId = 3 + pages.length * 2;

  pages.forEach((pageRows, pageIndex) => {
    const pageObjectId = 3 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    const content = [
      logoCommands(),
      ...pageRows.map((row, index) => line(row, 742 - index * 15, index === 0 && pageIndex === 0 ? 13 : 9)),
      line(`Página ${pageIndex + 1} de ${pages.length}`, 32, 8)
    ].join("\n");
    const contentLength = Buffer.byteLength(content, "utf8");

    objects.push(
      `${pageObjectId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >> endobj`,
      `${contentObjectId} 0 obj << /Length ${contentLength} >> stream\n${content}\nendstream endobj`
    );
  });

  objects.push(`${fontObjectId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);
  let offset = "%PDF-1.4\n".length;
  const xref = ["0000000000 65535 f "];
  const body = objects.map((object) => {
    xref.push(`${String(offset).padStart(10, "0")} 00000 n `);
    offset += Buffer.byteLength(`${object}\n`, "utf8");
    return object;
  }).join("\n") + "\n";
  const xrefStart = offset;
  const trailer = `xref\n0 ${xref.length}\n${xref.join("\n")}\ntrailer << /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(`%PDF-1.4\n${body}${trailer}`, "utf8");
}

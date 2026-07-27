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
  const rows = [
    "AROLAB",
    `Extrato do modelo: ${model}`,
    `Emitido em: ${emittedAt}`,
    `Periodo: ${statement.from ?? "inicio"} ate ${statement.to ?? "hoje"}`,
    `Moeda: ${statement.currency}`,
    `Disponivel para pagamento: ${formatMoney(statement.summary?.available, statement.currency)}`,
    `Pendente de clientes: ${formatMoney(statement.summary?.pendingClient, statement.currency)}`,
    "",
    "Trabalhos",
    ...statement.jobs.slice(0, 18).map((job) =>
      `${job.job_date} | ${financialJobTitle(job)} | Cliente ${formatMoney(job.client_amount_due, job.currency)} | Modelo ${formatMoney(job.model_net_amount, job.currency)}`
    ),
    "",
    "Despesas, pagamentos e ajustes",
    ...statement.entries.slice(0, 18).map((entry) =>
      `${entry.occurred_on} | ${entry.entry_type} | ${entry.title} | ${formatMoney(entry.amount, entry.currency)} | ${entry.status}`
    )
  ];

  const content = rows
    .slice(0, 46)
    .map((row, index) => line(row, 790 - index * 16, index === 0 ? 18 : 10))
    .join("\n");
  const contentLength = Buffer.byteLength(content, "utf8");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${contentLength} >> stream\n${content}\nendstream endobj`
  ];
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

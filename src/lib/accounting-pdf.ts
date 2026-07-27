import { renderModelStatementPdfDocument } from "@/lib/accounting-pdf-document";
import type { buildModelStatement } from "@/lib/accounting";

export function renderModelStatementPdf(statement: Awaited<ReturnType<typeof buildModelStatement>>) {
  return renderModelStatementPdfDocument(statement);
}

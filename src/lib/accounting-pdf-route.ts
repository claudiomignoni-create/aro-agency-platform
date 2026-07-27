import { NextResponse } from "next/server";
import { buildModelStatement } from "@/lib/accounting";
import { modelStatementPdfFileName } from "@/lib/accounting-pdf-document";
import { renderModelStatementPdf } from "@/lib/accounting-pdf";
import { requireRole } from "@/lib/auth";

export async function modelStatementPdfResponse({
  download,
  modelId,
  searchParams
}: {
  download?: boolean;
  modelId: string;
  searchParams?: URLSearchParams;
}) {
  await requireRole(["admin"]);
  const statement = await buildModelStatement(modelId, {
    currency: (searchParams?.get("currency") as never) || undefined,
    from: searchParams?.get("from") ?? undefined,
    to: searchParams?.get("to") ?? undefined
  });
  const pdf = renderModelStatementPdf(statement);
  const fileName = modelStatementPdfFileName(statement);

  return new NextResponse(pdf, {
    headers: {
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Content-Type": "application/pdf",
      "X-Accounting-PDF": "arolab-model-statement"
    }
  });
}

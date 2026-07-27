import { modelStatementPdfResponse } from "@/lib/accounting-pdf-route";

export const runtime = "nodejs";

type ModelStatementPdfRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: ModelStatementPdfRouteProps) {
  const { id } = await params;
  const url = new URL(request.url);

  return modelStatementPdfResponse({
    download: url.searchParams.get("download") === "1",
    modelId: id,
    searchParams: url.searchParams
  });
}

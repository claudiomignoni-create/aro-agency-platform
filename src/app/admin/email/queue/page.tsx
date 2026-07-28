import { EmailListPage } from "@/app/admin/email/email-list-page";

export default async function QueuePage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const query = await searchParams;
  const requested = query.status === "scheduled"
    ? ["scheduled"]
    : ["scheduled", "queued", "processing", "retry_pending", "failed"];

  return (
    <EmailListPage
      active="/admin/email/queue"
      description="Acompanhe agendamentos, processamento, tentativas futuras e falhas sanitizadas."
      page={Number(query.page) || 1}
      statuses={requested}
      title={query.status === "scheduled" ? "Agendados" : "Fila e agendamentos"}
    />
  );
}

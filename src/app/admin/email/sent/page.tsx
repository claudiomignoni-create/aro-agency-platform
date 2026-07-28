import { EmailListPage } from "@/app/admin/email/email-list-page";

export default async function SentPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const query = await searchParams;
  return (
    <EmailListPage
      active="/admin/email/sent"
      description="Histórico de mensagens concluídas. Cada destinatário permanece registrado individualmente."
      page={Number(query.page) || 1}
      statuses={["sent"]}
      title="Enviados"
    />
  );
}

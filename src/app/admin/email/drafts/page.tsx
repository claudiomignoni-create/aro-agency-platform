import { EmailListPage } from "@/app/admin/email/email-list-page";

export default async function DraftsPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const query = await searchParams;
  return (
    <EmailListPage
      active="/admin/email/drafts"
      description="Mensagens ainda não enviadas, incluindo rascunhos locais e rascunhos criados no Gmail."
      page={Number(query.page) || 1}
      statuses={["draft"]}
      title="Rascunhos"
    />
  );
}

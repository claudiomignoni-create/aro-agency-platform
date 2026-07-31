import {
  EmailWebmailPage,
  type EmailWebmailSearchParams
} from "@/app/admin/email/email-webmail-page";

export default async function GmailDraftPage({
  params,
  searchParams
}: {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<EmailWebmailSearchParams>;
}) {
  const { draftId } = await params;
  return (
    <EmailWebmailPage
      currentFolder="drafts"
      draftId={draftId}
      mode="compose"
      searchParams={await searchParams}
    />
  );
}

import {
  EmailWebmailPage,
  type EmailWebmailSearchParams
} from "@/app/admin/email/email-webmail-page";

export default async function GmailThreadPage({
  params,
  searchParams
}: {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<EmailWebmailSearchParams>;
}) {
  const { threadId } = await params;
  return (
    <EmailWebmailPage
      mode="thread"
      searchParams={await searchParams}
      threadId={threadId}
    />
  );
}

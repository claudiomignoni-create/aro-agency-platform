import {
  EmailWebmailPage,
  type EmailWebmailSearchParams
} from "@/app/admin/email/email-webmail-page";

export default async function StarredPage({
  searchParams
}: {
  searchParams: Promise<EmailWebmailSearchParams>;
}) {
  return <EmailWebmailPage currentFolder="starred" searchParams={await searchParams} />;
}

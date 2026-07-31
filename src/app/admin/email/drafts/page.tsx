import {
  EmailWebmailPage,
  type EmailWebmailSearchParams
} from "@/app/admin/email/email-webmail-page";

export default async function DraftsPage({
  searchParams
}: {
  searchParams: Promise<EmailWebmailSearchParams>;
}) {
  return <EmailWebmailPage currentFolder="drafts" searchParams={await searchParams} />;
}

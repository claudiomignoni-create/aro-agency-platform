import {
  EmailWebmailPage,
  type EmailWebmailSearchParams
} from "@/app/admin/email/email-webmail-page";

export default async function SentPage({
  searchParams
}: {
  searchParams: Promise<EmailWebmailSearchParams>;
}) {
  return <EmailWebmailPage currentFolder="sent" searchParams={await searchParams} />;
}

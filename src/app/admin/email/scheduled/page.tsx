import {
  EmailWebmailPage,
  type EmailWebmailSearchParams
} from "@/app/admin/email/email-webmail-page";

export default async function ScheduledPage({
  searchParams
}: {
  searchParams: Promise<EmailWebmailSearchParams>;
}) {
  return <EmailWebmailPage currentFolder="scheduled" searchParams={await searchParams} />;
}

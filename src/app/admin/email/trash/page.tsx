import {
  EmailWebmailPage,
  type EmailWebmailSearchParams
} from "@/app/admin/email/email-webmail-page";

export default async function TrashPage({
  searchParams
}: {
  searchParams: Promise<EmailWebmailSearchParams>;
}) {
  return <EmailWebmailPage currentFolder="trash" searchParams={await searchParams} />;
}

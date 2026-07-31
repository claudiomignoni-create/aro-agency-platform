import {
  EmailWebmailPage,
  type EmailWebmailSearchParams
} from "@/app/admin/email/email-webmail-page";

export default async function GmailLabelPage({
  params,
  searchParams
}: {
  params: Promise<{ labelId: string }>;
  searchParams: Promise<EmailWebmailSearchParams>;
}) {
  const { labelId } = await params;
  return (
    <EmailWebmailPage
      currentFolder="label"
      currentLabelId={labelId}
      searchParams={await searchParams}
    />
  );
}

import { randomUUID } from "node:crypto";
import { EmailComposer } from "@/components/admin/email-center/email-composer";
import { EmailSubnav } from "@/components/admin/email-center/email-subnav";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-ui";
import {
  listEmailRecipientOptions
} from "@/lib/communications/email-center";
import {
  listEmailTemplates,
  listPresentations
} from "@/lib/communications/data";
import { aroGoogleEmail } from "@/lib/communications/google-workspace";

export default async function ComposeEmailPage({
  searchParams
}: {
  searchParams: Promise<{ name?: string; subject?: string; template?: string; to?: string }>;
}) {
  const query = await searchParams;
  const [recipients, templates, presentations] = await Promise.all([
    listEmailRecipientOptions(),
    listEmailTemplates(),
    listPresentations()
  ]);

  return (
    <AdminPage className="email-center-subpage">
      <AdminPageHeader
        description="Crie uma comunicação individual, prepare no Gmail ou programe pela fila segura."
        eyebrow="Email Center"
        title="Novo e-mail"
      />
      <EmailSubnav active="/admin/email/compose" />
      <EmailComposer
        idempotencyKey={randomUUID()}
        initialName={query.name?.slice(0, 160)}
        initialRecipient={query.to?.slice(0, 320)}
        initialSubject={query.subject?.slice(0, 240)}
        initialTemplateId={query.template}
        presentations={presentations}
        recipients={recipients}
        sender={`Claudio Mignoni <${aroGoogleEmail}>`}
        templates={templates}
      />
    </AdminPage>
  );
}

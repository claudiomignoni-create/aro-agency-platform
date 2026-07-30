import { randomUUID } from "node:crypto";
import { EmailComposer } from "@/components/admin/email-center/email-composer";
import {
  EmailOperationalBanner,
  EmailOperationFeedback
} from "@/components/admin/email-center/email-operational-banner";
import { EmailSubnav } from "@/components/admin/email-center/email-subnav";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-ui";
import { requireRole } from "@/lib/auth";
import { emailDeliveryErrorMessage } from "@/lib/communications/email-delivery-errors";
import {
  listEmailRecipientOptions
} from "@/lib/communications/email-center";
import {
  listEmailTemplates,
  listPresentations
} from "@/lib/communications/data";
import { aroGoogleEmail } from "@/lib/communications/google-workspace";
import { getEmailOperationalState } from "@/lib/communications/operational-state-server";

function composeErrorMessage(error?: string) {
  if (error === "missing-fields") return "Preencha destinatário, assunto e corpo da mensagem.";
  if (error === "missing-schedule") return "Informe data e hora para agendar.";
  if (error === "invalid-schedule") return "O agendamento precisa estar no futuro.";
  return error ? emailDeliveryErrorMessage(error) : null;
}

export default async function ComposeEmailPage({
  searchParams
}: {
  searchParams: Promise<{
    error?: string;
    name?: string;
    subject?: string;
    template?: string;
    to?: string;
  }>;
}) {
  const query = await searchParams;
  const profile = await requireRole(["admin"]);
  const [recipients, templates, presentations, operationalState] = await Promise.all([
    listEmailRecipientOptions(),
    listEmailTemplates(),
    listPresentations(),
    getEmailOperationalState(profile.id)
  ]);
  const errorMessage = composeErrorMessage(query.error);

  return (
    <AdminPage className="email-center-subpage">
      <AdminPageHeader
        description="Crie uma comunicação individual, prepare no Gmail ou programe pela fila segura."
        eyebrow="Email Center"
        title="Novo e-mail"
      />
      <EmailSubnav active="/admin/email/compose" />
      <EmailOperationalBanner state={operationalState} />
      {errorMessage ? (
        <EmailOperationFeedback
          message={errorMessage}
          title="O e-mail não foi enviado"
        />
      ) : null}
      <EmailComposer
        idempotencyKey={randomUUID()}
        initialName={query.name?.slice(0, 160)}
        initialRecipient={query.to?.slice(0, 320)}
        initialSubject={query.subject?.slice(0, 240)}
        initialTemplateId={query.template}
        operationalState={operationalState}
        presentations={presentations}
        recipients={recipients}
        sender={`Claudio Mignoni <${aroGoogleEmail}>`}
        templates={templates}
      />
    </AdminPage>
  );
}

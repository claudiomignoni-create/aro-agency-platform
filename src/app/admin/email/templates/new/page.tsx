import Link from "next/link";
import { createEmailTemplateAction } from "@/app/admin/email/actions";
import { EmailSubnav } from "@/components/admin/email-center/email-subnav";
import { EmailTemplateForm } from "@/components/admin/email-center/email-template-form";
import { AdminPage, AdminPageHeader, AdminSection } from "@/components/admin/admin-ui";

export default function NewEmailTemplatePage() {
  return (
    <AdminPage className="email-center-subpage">
      <AdminPageHeader
        actions={<Link className="button secondary" href="/admin/email/templates">Voltar</Link>}
        description="Crie uma base reutilizável sem enviar nenhuma mensagem."
        eyebrow="Email Center"
        title="Novo template"
      />
      <EmailSubnav active="/admin/email/templates" />
      <AdminSection title="Conteúdo">
        <EmailTemplateForm action={createEmailTemplateAction} submitLabel="Criar template" />
      </AdminSection>
    </AdminPage>
  );
}

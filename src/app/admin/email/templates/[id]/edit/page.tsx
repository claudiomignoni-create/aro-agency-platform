import Link from "next/link";
import { notFound } from "next/navigation";
import { updateEmailTemplateAction } from "@/app/admin/email/actions";
import { EmailSubnav } from "@/components/admin/email-center/email-subnav";
import { EmailTemplateForm } from "@/components/admin/email-center/email-template-form";
import { AdminPage, AdminPageHeader, AdminSection } from "@/components/admin/admin-ui";
import { getEmailTemplate } from "@/lib/communications/data";

export default async function EditEmailTemplatePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const template = await getEmailTemplate(id);
  if (!template) notFound();

  return (
    <AdminPage className="email-center-subpage">
      <AdminPageHeader
        actions={<Link className="button secondary" href="/admin/email/templates">Voltar</Link>}
        description="Atualize o conteúdo reutilizável. Nenhuma mensagem existente será modificada."
        eyebrow="Email Center"
        title={template.name}
      />
      <EmailSubnav active="/admin/email/templates" />
      {query.notice ? (
        <div className="email-schema-notice" role="status">
          <span><strong>Template salvo</strong>As alterações já estão disponíveis no composer.</span>
        </div>
      ) : null}
      <AdminSection title="Conteúdo">
        <EmailTemplateForm
          action={updateEmailTemplateAction.bind(null, template.id)}
          submitLabel="Salvar alterações"
          template={template}
        />
      </AdminSection>
    </AdminPage>
  );
}

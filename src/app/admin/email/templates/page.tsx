import Link from "next/link";
import {
  archiveEmailTemplateAction,
  duplicateEmailTemplateAction,
  setDefaultEmailTemplateAction
} from "@/app/admin/email/actions";
import { EmailStatusBadge } from "@/components/admin/email-center/email-status-badge";
import { EmailSubnav } from "@/components/admin/email-center/email-subnav";
import { AdminEmptyState, AdminPage, AdminPageHeader } from "@/components/admin/admin-ui";
import { listEmailTemplates } from "@/lib/communications/data";

export default async function EmailTemplatesPage({
  searchParams
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const query = await searchParams;
  const templates = await listEmailTemplates();

  return (
    <AdminPage className="email-center-subpage">
      <AdminPageHeader
        actions={<Link className="button" href="/admin/email/templates/new">Novo template</Link>}
        description="Mensagens reutilizáveis por finalidade e idioma, com preview e controle de padrão."
        eyebrow="Email Center"
        title="Templates"
      />
      <EmailSubnav active="/admin/email/templates" />
      {query.notice ? (
        <div className="email-schema-notice" role="status">
          <span>
            <strong>Templates atualizados</strong>
            A alteração foi registrada com sucesso.
          </span>
        </div>
      ) : null}
      {templates.length ? (
        <section className="email-template-grid">
          {templates.map((template) => (
            <article className="email-template-card" key={template.id}>
              <header>
                <div>
                  <h2>{template.name}</h2>
                  <span>{template.language}</span>
                </div>
                {template.is_default ? <EmailStatusBadge status="completed">Padrão</EmailStatusBadge> : null}
              </header>
              <span>{template.category}</span>
              <strong>{template.subject}</strong>
              <p>{template.body_text}</p>
              <footer>
                <Link className="button secondary" href={`/admin/email/templates/${template.id}/edit`}>
                  Editar
                </Link>
                <Link
                  className="button secondary"
                  href={`/admin/email/compose?template=${template.id}`}
                >
                  Usar
                </Link>
                <form action={duplicateEmailTemplateAction.bind(null, template.id)}>
                  <button className="button secondary" type="submit">Duplicar</button>
                </form>
                {!template.is_default ? (
                  <form action={setDefaultEmailTemplateAction.bind(null, template.id)}>
                    <button className="button secondary" type="submit">Definir padrão</button>
                  </form>
                ) : null}
                <form action={archiveEmailTemplateAction.bind(null, template.id)}>
                  <button className="button danger" type="submit">Arquivar</button>
                </form>
              </footer>
            </article>
          ))}
        </section>
      ) : (
        <AdminEmptyState
          action={<Link className="button" href="/admin/email/templates/new">Criar template</Link>}
          description="Os templates padrão serão ativados com a migration 025. Também é possível criar um template manual."
          title="Nenhum template ativo"
        />
      )}
    </AdminPage>
  );
}

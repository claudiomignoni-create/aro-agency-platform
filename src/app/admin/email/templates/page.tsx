import Link from "next/link";
import { AdminDataTable, AdminPage, AdminPageHeader, AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { listEmailTemplates } from "@/lib/communications/data";

export default async function EmailTemplatesPage() {
  const templates = await listEmailTemplates();

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href="/admin/email">Email Center</Link>}
        description="Templates editáveis por categoria e idioma. Os padrões são criados pela migration 025."
        eyebrow="Email Center"
        title="Templates"
      />
      <AdminSection title="Templates" meta={`${templates.length} ativo(s)`}>
        <AdminDataTable>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Idioma</th>
              <th>Assunto</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id}>
                <td data-label="Nome"><strong>{template.name}</strong></td>
                <td data-label="Categoria"><AdminStatusPill>{template.category}</AdminStatusPill></td>
                <td data-label="Idioma">{template.language}</td>
                <td data-label="Assunto">{template.subject}</td>
              </tr>
            ))}
          </tbody>
        </AdminDataTable>
      </AdminSection>
    </AdminPage>
  );
}

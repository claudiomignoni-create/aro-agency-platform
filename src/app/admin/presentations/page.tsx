import Link from "next/link";
import { AdminDataTable, AdminPage, AdminPageHeader, AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { listPresentations } from "@/lib/communications/data";

export default async function PresentationsPage() {
  const presentations = await listPresentations();

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button" href="/admin/presentations/new">Nova apresentação</Link>}
        description="Seleções editoriais de modelos com link público, snapshot de versão e privacidade por padrão."
        eyebrow="Apresentações"
        title="Presentations"
      />
      <AdminSection title="Apresentações" meta={`${presentations.length} registro(s)`}>
        <AdminDataTable>
          <thead>
            <tr>
              <th>Título</th>
              <th>Idioma</th>
              <th>Status</th>
              <th>Criada em</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {presentations.map((presentation) => (
              <tr key={presentation.id}>
                <td data-label="Título">
                  <strong>{presentation.title}</strong>
                  <small>{presentation.description ?? "Sem descrição"}</small>
                </td>
                <td data-label="Idioma">{presentation.language}</td>
                <td data-label="Status"><AdminStatusPill>{presentation.status}</AdminStatusPill></td>
                <td data-label="Criada em">{new Date(presentation.created_at).toLocaleDateString("pt-BR")}</td>
                <td data-label="Ação">
                  <Link className="button secondary" href={`/admin/presentations/${presentation.id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminDataTable>
      </AdminSection>
    </AdminPage>
  );
}

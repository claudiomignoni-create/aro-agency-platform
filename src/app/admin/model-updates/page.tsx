import Link from "next/link";
import { AdminDataTable, AdminPage, AdminPageHeader, AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { listModelUpdateRequests } from "@/lib/communications/data";

export default async function ModelUpdatesPage() {
  const requests = await listModelUpdateRequests();

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button" href="/admin/model-updates/new">Solicitar atualização</Link>}
        description="Acompanhe solicitações enviadas, abertas, iniciadas e concluídas pelas modelos."
        eyebrow="Model Portal"
        title="Atualizações de perfil"
      />
      <AdminSection title="Solicitações" meta={`${requests.length} registro(s)`}>
        <AdminDataTable>
          <thead>
            <tr>
              <th>Título</th>
              <th>Status</th>
              <th>Vence em</th>
              <th>Criada em</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td data-label="Título">{request.title}</td>
                <td data-label="Status"><AdminStatusPill>{request.status}</AdminStatusPill></td>
                <td data-label="Vence em">{new Date(request.expires_at).toLocaleDateString("pt-BR")}</td>
                <td data-label="Criada em">{new Date(request.created_at).toLocaleDateString("pt-BR")}</td>
                <td data-label="Ação"><Link className="button secondary" href={`/admin/model-updates/${request.id}`}>Abrir</Link></td>
              </tr>
            ))}
          </tbody>
        </AdminDataTable>
      </AdminSection>
    </AdminPage>
  );
}

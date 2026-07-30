import Link from "next/link";
import {
  AdminDataTable,
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminStatusPill
} from "@/components/admin/admin-ui";
import { listPresentationOperationalSummaries } from "@/lib/communications/data";

export default async function PresentationsPage() {
  let result;
  try {
    result = await listPresentationOperationalSummaries();
  } catch {
    return (
      <AdminPage>
        <AdminPageHeader
          actions={<Link className="button secondary" href="/admin">Voltar ao Dashboard</Link>}
          description="A lista principal não respondeu. Nenhum dado foi alterado."
          eyebrow="Apresentações"
          title="Não foi possível carregar as apresentações"
        />
        <AdminSection>
          <AdminEmptyState
            action={
              <div className="actions">
                <Link className="button" href="/admin/presentations">Tentar novamente</Link>
                <Link className="button secondary" href="/admin">Voltar ao Dashboard</Link>
              </div>
            }
            description="Tente novamente em instantes. Se o problema continuar, informe o código PRES-LIST-001."
            title="Falha temporária"
          />
        </AdminSection>
      </AdminPage>
    );
  }

  const { presentations, unavailableMetrics } = result;

  return (
    <AdminPage>
      <AdminPageHeader
        actions={
          <>
            <Link className="button" href="/admin/presentations/new">Nova apresentação</Link>
            <Link className="button secondary" href="/admin/email">Email Center</Link>
          </>
        }
        description="Seleções editoriais de modelos com link público, snapshot de versão e privacidade por padrão."
        eyebrow="Apresentações"
        title="Presentations"
      />
      {unavailableMetrics.length ? (
        <AdminSection className="admin-notice" title="Algumas métricas estão temporariamente indisponíveis">
          <p className="muted">
            A lista e todas as ações continuam disponíveis. Os indicadores afetados aparecem como “—”.
          </p>
        </AdminSection>
      ) : null}
      <AdminSection title="Apresentações" meta={`${presentations.length} registro(s)`}>
        <AdminDataTable>
          <thead>
            <tr>
              <th>Título</th>
              <th>Status</th>
              <th>Modelos</th>
              <th>Destinatários</th>
              <th>Última entrega</th>
              <th>Seleções</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {presentations.map((presentation) => (
              <tr key={presentation.id}>
                <td data-label="Título">
                  <strong>{presentation.title}</strong>
                  <small>{presentation.description ?? "Sem descrição"}</small>
                </td>
                <td data-label="Status"><AdminStatusPill>{presentation.status}</AdminStatusPill></td>
                <td data-label="Modelos">{presentation.model_count ?? "—"}</td>
                <td data-label="Destinatários">{presentation.recipient_count ?? "—"}</td>
                <td data-label="Última entrega">
                  {presentation.last_delivery_at
                    ? new Date(presentation.last_delivery_at).toLocaleString("pt-BR")
                    : "—"}
                </td>
                <td data-label="Seleções">{presentation.selection_count ?? "—"}</td>
                <td data-label="Ações">
                  <Link className="button secondary" href={`/admin/presentations/${presentation.id}`}>Abrir</Link>
                  <Link className="button secondary" href={`/admin/presentations/${presentation.id}/preview`}>Preview</Link>
                  {["published", "sent"].includes(presentation.status) ? (
                    <Link className="button secondary" href={`/admin/presentations/${presentation.id}/email`}>Enviar</Link>
                  ) : (
                    <span className="status">Publique para enviar</span>
                  )}
                </td>
              </tr>
            ))}
            {!presentations.length ? (
              <tr>
                <td colSpan={7}>Nenhuma apresentação criada.</td>
              </tr>
            ) : null}
          </tbody>
        </AdminDataTable>
      </AdminSection>
    </AdminPage>
  );
}

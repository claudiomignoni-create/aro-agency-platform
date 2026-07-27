import Link from "next/link";
import { AdminDataTable, AdminPage, AdminPageHeader, AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  archivePresentationAction,
  publishPresentationAction,
  regeneratePresentationTokenAction,
  revokePresentationAction
} from "@/app/admin/presentations/actions";

type PresentationDetailProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ token?: string }>;
};

export default async function PresentationDetailPage({ params, searchParams }: PresentationDetailProps) {
  await requireRole(["admin"]);
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const supabase = await createClient();
  const { data: presentation, error } = await supabase
    .from("presentations")
    .select("id, title, description, language, status, expires_at, allow_downloads, published_at, revoked_at, version_number, snapshot")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  if (!presentation) {
    return (
      <AdminPage>
        <AdminPageHeader eyebrow="Presentation" title="Apresentação não encontrada" />
      </AdminPage>
    );
  }

  const publishAction = publishPresentationAction.bind(null, id);
  const revokeAction = revokePresentationAction.bind(null, id);
  const archiveAction = archivePresentationAction.bind(null, id);
  const regenerateTokenAction = regeneratePresentationTokenAction.bind(null, id);
  const snapshot = (presentation.snapshot ?? {}) as {
    models?: Array<{ display_name: string; media?: unknown[] }>;
  };

  return (
    <AdminPage>
      <AdminPageHeader
        actions={
          <>
            <Link className="button secondary" href={`/admin/presentations/${id}/edit`}>Editar</Link>
            <Link className="button secondary" href={`/admin/presentations/${id}/preview`}>Preview</Link>
            <Link className="button secondary" href={`/admin/presentations/${id}/email`}>Enviar</Link>
            <Link className="button secondary" href={`/admin/presentations/${id}/analytics`}>Analytics</Link>
          </>
        }
        description={presentation.description ?? "Sem descrição"}
        eyebrow="Presentation"
        title={presentation.title}
      />

      {query.token ? (
        <AdminSection title="Link público criado">
          <p className="muted">Copie agora. Por segurança, o token completo não fica armazenado em texto puro.</p>
          <code>{`${process.env.NEXT_PUBLIC_APP_URL ?? "https://aro-agency-platform.vercel.app"}/p/${query.token}`}</code>
        </AdminSection>
      ) : null}

      <AdminSection title="Status e publicação">
        <div className="admin-kv-grid">
          <span>Status</span>
          <strong><AdminStatusPill>{presentation.status}</AdminStatusPill></strong>
          <span>Idioma</span>
          <strong>{presentation.language}</strong>
          <span>Versão</span>
          <strong>{presentation.version_number}</strong>
          <span>Publicada em</span>
          <strong>{presentation.published_at ? new Date(presentation.published_at).toLocaleString("pt-BR") : "—"}</strong>
          <span>Expiração</span>
          <strong>{presentation.expires_at ? new Date(presentation.expires_at).toLocaleString("pt-BR") : "Sem expiração"}</strong>
          <span>Downloads</span>
          <strong>{presentation.allow_downloads ? "Permitidos" : "Bloqueados"}</strong>
        </div>
        <div className="actions">
          <form action={publishAction}>
            <button className="button" type="submit">Publicar snapshot</button>
          </form>
          <form action={regenerateTokenAction}>
            <button className="button secondary" type="submit">Gerar novo token</button>
          </form>
          {["published", "sent"].includes(presentation.status) ? (
            <form action={revokeAction}>
              <button className="button secondary" type="submit">Revogar link</button>
            </form>
          ) : null}
          <form action={archiveAction}>
            <button className="button secondary" type="submit">Arquivar</button>
          </form>
        </div>
      </AdminSection>

      <AdminSection title="Snapshot publicado" meta={`${snapshot.models?.length ?? 0} modelo(s)`}>
        {snapshot.models?.length ? (
          <AdminDataTable>
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Materiais</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.models.map((model) => (
                <tr key={model.display_name}>
                  <td data-label="Modelo"><strong>{model.display_name}</strong></td>
                  <td data-label="Materiais">{model.media?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </AdminDataTable>
        ) : (
          <p className="muted">Ainda não existe snapshot publicado. Salve modelos no editor e publique.</p>
        )}
      </AdminSection>
    </AdminPage>
  );
}

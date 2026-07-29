import Link from "next/link";
import { AdminDataTable, AdminPage, AdminPageHeader, AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { EmailOperationFeedback } from "@/components/admin/email-center/email-operational-banner";
import { PresentationPublicLinkActions } from "@/components/admin/presentation-public-link-actions";
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
  searchParams?: Promise<{ notice?: string; token?: string }>;
};

function noticeCopy(notice?: string) {
  if (notice === "sent") return "O Gmail confirmou o envio imediato.";
  if (notice === "gmail-draft-created") return "O rascunho foi criado na conta Gmail conectada.";
  if (notice === "scheduled") return "A entrega foi registrada na fila para a data escolhida.";
  if (notice === "draft-saved") return "O envio seguro foi salvo somente no sistema.";
  return null;
}

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
  const [recipientsResult, emailsResult, selectionsResult, opensResult] =
    await Promise.all([
      supabase
        .from("presentation_recipients")
        .select("id", { count: "exact", head: true })
        .eq("presentation_id", id),
      supabase
        .from("outbound_emails")
        .select("created_at, status")
        .eq("presentation_id", id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("presentation_model_selections")
        .select("decision")
        .eq("presentation_id", id)
        .limit(500),
      supabase
        .from("presentation_access_events")
        .select("id", { count: "exact", head: true })
        .eq("presentation_id", id)
        .eq("event_type", "opened")
    ]);
  if (recipientsResult.error) throw recipientsResult.error;
  if (emailsResult.error) throw emailsResult.error;
  if (selectionsResult.error) throw selectionsResult.error;
  if (opensResult.error) throw opensResult.error;

  const selectionCounts = { maybe: 0, no: 0, yes: 0 };
  for (const selection of selectionsResult.data ?? []) {
    if (selection.decision in selectionCounts) {
      selectionCounts[selection.decision as keyof typeof selectionCounts] += 1;
    }
  }
  const notice = noticeCopy(query.notice);
  const publicUrl = query.token
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? "https://aro-agency-platform.vercel.app"}/p/${query.token}`
    : null;

  return (
    <AdminPage>
      <AdminPageHeader
        actions={
          <>
            <Link className="button secondary" href="/admin/presentations">Apresentações</Link>
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

      {notice ? (
        <EmailOperationFeedback message={notice} success title="Operação concluída" />
      ) : null}

      {publicUrl ? (
        <AdminSection title="Link público criado">
          <p className="muted">Copie agora. Por segurança, o token completo não fica armazenado em texto puro.</p>
          <code>{publicUrl}</code>
          <PresentationPublicLinkActions url={publicUrl} />
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
          <span>Destinatários</span>
          <strong>{recipientsResult.count ?? 0}</strong>
          <span>Última entrega</span>
          <strong>
            {emailsResult.data?.[0]?.created_at
              ? `${new Date(emailsResult.data[0].created_at).toLocaleString("pt-BR")} · ${emailsResult.data[0].status}`
              : "—"}
          </strong>
          <span>Aberturas</span>
          <strong>{opensResult.count ?? 0}</strong>
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

      <AdminSection title="Fluxo operacional">
        <div className="admin-kv-grid">
          <span>1. Criar</span>
          <strong>Concluído</strong>
          <span>2. Adicionar modelos</span>
          <strong>{snapshot.models?.length ? "Concluído" : "Pendente"}</strong>
          <span>3. Organizar materiais</span>
          <strong>{snapshot.models?.some((model) => model.media?.length) ? "Concluído" : "Pendente"}</strong>
          <span>4. Publicar</span>
          <strong>{presentation.published_at ? "Concluído" : "Pendente"}</strong>
          <span>5. Enviar</span>
          <strong>{(recipientsResult.count ?? 0) > 0 ? "Iniciado" : "Pendente"}</strong>
          <span>6. Acompanhar</span>
          <strong>
            {(opensResult.count ?? 0) > 0 || selectionsResult.data?.length
              ? "Com atividade"
              : "Aguardando"}
          </strong>
        </div>
      </AdminSection>

      <AdminSection title="Seleções recebidas">
        <div className="admin-kv-grid">
          <span>Yes</span><strong>{selectionCounts.yes}</strong>
          <span>Maybe</span><strong>{selectionCounts.maybe}</strong>
          <span>No</span><strong>{selectionCounts.no}</strong>
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

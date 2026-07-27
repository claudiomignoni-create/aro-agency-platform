import Link from "next/link";
import {
  AdminDataTable,
  AdminModelIdentity,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminStatusPill
} from "@/components/admin/admin-ui";
import {
  applyModelUpdateSubmissionAction,
  approveModelUpdateFileAction,
  rejectModelUpdateFileAction,
  rejectModelUpdateSubmissionAction
} from "@/app/admin/model-updates/actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type ModelUpdateDetailProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; token?: string }>;
};

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}

function payloadRows(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  return Object.entries(payload as Record<string, unknown>).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value)
  }));
}

export default async function ModelUpdateDetailPage({ params, searchParams }: ModelUpdateDetailProps) {
  await requireRole(["admin"]);
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const supabase = await createClient();
  const [requestResult, fieldsResult, submissionResult, eventsResult, remindersResult] = await Promise.all([
    supabase
      .from("model_update_requests")
      .select("id, title, message, status, language, due_at, expires_at, opened_at, started_at, submitted_at, applied_at, auto_apply_safe_fields, model:models(id, display_name, stage_name, main_image_path)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("model_update_request_fields")
      .select("id, field_key, field_group, is_required, is_sensitive, allow_auto_apply, position")
      .eq("request_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("model_update_submissions")
      .select("id, status, draft_payload, submitted_payload, applied_snapshot, submitted_at, applied_at, reviewed_by, files:model_update_files(id, media_type, original_name, mime_type, size_bytes, status, created_at)")
      .eq("request_id", id)
      .maybeSingle(),
    supabase
      .from("model_update_audit_events")
      .select("id, event_type, created_at, metadata")
      .eq("request_id", id)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("model_update_reminders")
      .select("id, remind_at, status, sent_at, outbound_email_id")
      .eq("request_id", id)
      .order("remind_at", { ascending: true })
  ]);

  if (requestResult.error) throw requestResult.error;
  if (fieldsResult.error) throw fieldsResult.error;
  if (submissionResult.error) throw submissionResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (remindersResult.error) throw remindersResult.error;

  const request = requestResult.data;
  const model = Array.isArray(request?.model) ? request?.model[0] : request?.model;
  const submission = submissionResult.data;
  const fields = fieldsResult.data ?? [];
  const files = submission?.files ?? [];
  const rows = payloadRows(submission?.submitted_payload ?? submission?.draft_payload);
  const applyAction = applyModelUpdateSubmissionAction.bind(null, id);
  const rejectAction = rejectModelUpdateSubmissionAction.bind(null, id);

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href="/admin/model-updates">Voltar</Link>}
        description="Revise dados e materiais antes de sincronizar qualquer informação no Cadastro360."
        eyebrow="Model Portal"
        title={request?.title ?? "Solicitação de atualização"}
      />

      {query.token ? (
        <AdminSection title="Link seguro criado">
          <p className="muted">Copie agora. O banco guarda apenas o hash do token.</p>
          <code>{`${process.env.NEXT_PUBLIC_APP_URL ?? "https://aro-agency-platform.vercel.app"}/update/${query.token}`}</code>
        </AdminSection>
      ) : null}

      {query.error ? (
        <AdminSection title="Atenção">
          <p className="muted">{query.error}</p>
        </AdminSection>
      ) : null}

      <AdminSection meta={<AdminStatusPill>{request?.status ?? "não encontrada"}</AdminStatusPill>} title="Resumo">
        {model ? (
          <AdminModelIdentity
            href={`/admin/models/${model.id}/edit`}
            imageUrl={model.main_image_path}
            name={model.stage_name || model.display_name}
            secondary="Cadastro360"
          />
        ) : null}
        <div className="admin-kv-grid">
          <span>Modelo</span>
          <strong>{model?.stage_name || model?.display_name || "—"}</strong>
          <span>Idioma</span>
          <strong>{request?.language ?? "—"}</strong>
          <span>Vence em</span>
          <strong>{formatDateTime(request?.expires_at)}</strong>
          <span>Aberta</span>
          <strong>{formatDateTime(request?.opened_at)}</strong>
          <span>Iniciada</span>
          <strong>{formatDateTime(request?.started_at)}</strong>
          <span>Enviada</span>
          <strong>{formatDateTime(request?.submitted_at ?? submission?.submitted_at)}</strong>
          <span>Aplicação segura</span>
          <strong>{request?.auto_apply_safe_fields ? "Permitida" : "Desativada"}</strong>
        </div>
        {request?.message ? <p className="muted">{request.message}</p> : null}
        {model?.id ? <Link className="button secondary" href={`/admin/models/${model.id}/edit`}>Abrir Cadastro360</Link> : null}
      </AdminSection>

      <AdminSection title="Campos solicitados" meta={`${fields.length} campo(s)`}>
        <AdminDataTable>
          <thead>
            <tr>
              <th>Campo</th>
              <th>Grupo</th>
              <th>Obrigatório</th>
              <th>Sensível</th>
              <th>Autoaplicável</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.id}>
                <td data-label="Campo">{field.field_key}</td>
                <td data-label="Grupo">{field.field_group}</td>
                <td data-label="Obrigatório">{field.is_required ? "Sim" : "Não"}</td>
                <td data-label="Sensível">{field.is_sensitive ? "Sim" : "Não"}</td>
                <td data-label="Autoaplicável">{field.allow_auto_apply ? "Sim" : "Não"}</td>
              </tr>
            ))}
          </tbody>
        </AdminDataTable>
      </AdminSection>

      <AdminSection title="Dados enviados" meta={submission?.status ?? "sem envio"}>
        <AdminDataTable>
          <thead>
            <tr>
              <th>Campo</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td data-label="Campo">{row.key}</td>
                <td data-label="Valor">{row.value || "—"}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={2}>Nenhum dado enviado ainda.</td>
              </tr>
            ) : null}
          </tbody>
        </AdminDataTable>
        {submission?.submitted_payload ? (
          <div className="admin-form-actions">
            <form action={applyAction}>
              <button className="button" type="submit">Aplicar campos seguros</button>
            </form>
            <form action={rejectAction}>
              <button className="button secondary" type="submit">Solicitar revisão</button>
            </form>
          </div>
        ) : null}
      </AdminSection>

      <AdminSection title="Arquivos recebidos" meta={`${files.length} arquivo(s)`}>
        <AdminDataTable>
          <thead>
            <tr>
              <th>Arquivo</th>
              <th>Tipo</th>
              <th>Tamanho</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id}>
                <td data-label="Arquivo">{file.original_name}</td>
                <td data-label="Tipo">{file.media_type}</td>
                <td data-label="Tamanho">{Math.round((Number(file.size_bytes) / 1024 / 1024) * 10) / 10} MB</td>
                <td data-label="Status"><AdminStatusPill>{file.status}</AdminStatusPill></td>
                <td data-label="Ações">
                  <div className="actions">
                    <form action={approveModelUpdateFileAction.bind(null, id, file.id)}>
                      <button className="button secondary" type="submit">Aprovar</button>
                    </form>
                    <form action={rejectModelUpdateFileAction.bind(null, id, file.id)}>
                      <button className="button secondary" type="submit">Rejeitar</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {!files.length ? (
              <tr>
                <td colSpan={5}>Nenhum arquivo recebido.</td>
              </tr>
            ) : null}
          </tbody>
        </AdminDataTable>
      </AdminSection>

      <AdminSection title="Reminders">
        <AdminDataTable>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Status</th>
              <th>Enviado</th>
            </tr>
          </thead>
          <tbody>
            {(remindersResult.data ?? []).map((reminder) => (
              <tr key={reminder.id}>
                <td data-label="Quando">{formatDateTime(reminder.remind_at)}</td>
                <td data-label="Status"><AdminStatusPill>{reminder.status}</AdminStatusPill></td>
                <td data-label="Enviado">{formatDateTime(reminder.sent_at)}</td>
              </tr>
            ))}
          </tbody>
        </AdminDataTable>
      </AdminSection>

      <AdminSection title="Auditoria">
        <AdminDataTable>
          <thead>
            <tr>
              <th>Evento</th>
              <th>Quando</th>
            </tr>
          </thead>
          <tbody>
            {(eventsResult.data ?? []).map((event) => (
              <tr key={event.id}>
                <td data-label="Evento">{event.event_type}</td>
                <td data-label="Quando">{formatDateTime(event.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </AdminDataTable>
      </AdminSection>
    </AdminPage>
  );
}

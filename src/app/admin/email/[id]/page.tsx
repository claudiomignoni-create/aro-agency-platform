import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cancelOutboundEmailAction,
  duplicateOutboundEmailAction,
  updateQueuedRecipientAction
} from "@/app/admin/email/actions";
import { EmailOperationFeedback } from "@/components/admin/email-center/email-operational-banner";
import { EmailStatusBadge } from "@/components/admin/email-center/email-status-badge";
import { EmailSubnav } from "@/components/admin/email-center/email-subnav";
import {
  AdminPage,
  AdminPageHeader,
  AdminSection
} from "@/components/admin/admin-ui";
import { getEmailCenterDetail } from "@/lib/communications/email-center";
import { emailDeliveryErrorMessage } from "@/lib/communications/email-delivery-errors";

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

function noticeCopy(notice: string) {
  if (notice === "sent") {
    return {
      message: "O Gmail confirmou a entrega e o registro foi atualizado para sent.",
      title: "E-mail enviado"
    };
  }
  if (notice === "gmail-draft-created") {
    return {
      message: "O rascunho foi criado na conta Gmail conectada.",
      title: "Rascunho Gmail criado"
    };
  }
  if (notice === "scheduled") {
    return {
      message: "O envio foi registrado na fila para a data informada.",
      title: "E-mail agendado"
    };
  }
  if (notice === "draft-saved") {
    return {
      message: "A mensagem foi salva somente no sistema e não foi enviada.",
      title: "Rascunho interno salvo"
    };
  }
  if (notice === "duplicated") {
    return {
      message: "A cópia foi salva somente no sistema.",
      title: "Rascunho criado"
    };
  }
  if (notice === "recipient-updated") {
    return {
      message: "O destinatário foi atualizado sem enviar a mensagem.",
      title: "Destinatário atualizado"
    };
  }
  return {
    message: "A ação foi registrada sem enviar nenhuma mensagem automaticamente.",
    title: "Operação concluída"
  };
}

export default async function EmailDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const email = await getEmailCenterDetail(id);
  if (!email) notFound();

  const cancelable = ["draft", "scheduled", "queued", "retry_pending"].includes(email.status);
  const duplicable = email.subject !== "ARO — Código de verificação";
  const followUpQuery = new URLSearchParams({
    name: email.recipient_name ?? "",
    subject: `Re: ${email.subject}`,
    to: email.recipient_email
  });

  return (
    <AdminPage className="email-center-subpage">
      <AdminPageHeader
        actions={
          <>
            {duplicable ? (
              <Link
                className="button secondary"
                href={`/admin/email/compose?${followUpQuery.toString()}`}
              >
                Criar follow-up
              </Link>
            ) : null}
            {duplicable ? (
              <form action={duplicateOutboundEmailAction.bind(null, email.id)}>
                <button className="button secondary" type="submit">Duplicar como rascunho</button>
              </form>
            ) : null}
            {cancelable ? (
              <form action={cancelOutboundEmailAction.bind(null, email.id)}>
                <button className="button danger" type="submit">Cancelar</button>
              </form>
            ) : null}
          </>
        }
        description="Registro individual, vínculos operacionais e histórico sanitizado."
        eyebrow="Email Center"
        title={email.subject}
      />
      <EmailSubnav active="" />

      {query.notice ? (() => {
        const copy = noticeCopy(query.notice);
        return <EmailOperationFeedback message={copy.message} success title={copy.title} />;
      })() : null}
      {query.error ? (
        <EmailOperationFeedback
          message={emailDeliveryErrorMessage(query.error)}
          title="Ação não executada"
        />
      ) : null}

      <div className="email-detail-grid">
        <AdminSection
          title="Comunicação"
          meta={<EmailStatusBadge status={email.status} />}
        >
          <div className="admin-kv-grid">
            <span>Destinatário</span>
            <strong>{email.recipient_name || email.recipient_email} · {email.recipient_email}</strong>
            <span>Remetente</span>
            <strong>{email.sender_email ?? "Remetente do sistema"}</strong>
            <span>Modo</span><strong>{email.mode}</strong>
            <span>Criado</span><strong>{dateTime(email.created_at)}</strong>
            <span>Programado</span><strong>{dateTime(email.scheduled_at)}</strong>
            <span>Enviado</span><strong>{dateTime(email.sent_at)}</strong>
            <span>Falhou</span><strong>{dateTime(email.failed_at)}</strong>
            <span>Tentativas</span><strong>{email.attempt_count}</strong>
            <span>Erro sanitizado</span>
            <strong>{email.error_message_sanitized ?? "—"}</strong>
          </div>
        </AdminSection>

        <AdminSection title="Vínculos">
          <div className="admin-kv-grid">
            <span>Apresentação</span>
            <strong>
              {email.presentation ? (
                <Link href={`/admin/presentations/${email.presentation.id}`}>
                  {email.presentation.title}
                </Link>
              ) : "—"}
            </strong>
            <span>Solicitação</span>
            <strong>
              {email.model_update_request ? (
                <Link href={`/admin/model-updates/${email.model_update_request.id}`}>
                  {email.model_update_request.title}
                </Link>
              ) : "—"}
            </strong>
            <span>Destinatário da apresentação</span>
            <strong>{email.recipient ? "Vinculado" : "—"}</strong>
            <span>Abertura do link</span>
            <strong>{dateTime(email.recipient?.opened_at ?? null)}</strong>
            <span>Link revogado</span>
            <strong>{email.share_link?.revoked_at ? "Sim" : "Não"}</strong>
            <span>Expiração</span>
            <strong>{dateTime(email.share_link?.expires_at ?? null)}</strong>
            <span>Gmail</span>
            <strong>
              {email.gmail_message_id ? (
                <a
                  href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(email.gmail_message_id)}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Abrir mensagem
                </a>
              ) : email.gmail_draft_id ? "Rascunho criado" : "—"}
            </strong>
          </div>
        </AdminSection>
      </div>

      {cancelable ? (
        <AdminSection title="Editar antes do processamento">
          <form action={updateQueuedRecipientAction.bind(null, email.id)} className="admin-form-grid">
            <label className="admin-field">
              <span>Nome</span>
              <input defaultValue={email.recipient_name ?? ""} name="recipient_name" />
            </label>
            <label className="admin-field">
              <span>E-mail</span>
              <input defaultValue={email.recipient_email} name="recipient_email" required type="email" />
            </label>
            <div className="actions">
              <button className="button secondary" type="submit">Atualizar destinatário</button>
            </div>
          </form>
        </AdminSection>
      ) : null}

      <div className="email-detail-grid">
        <AdminSection title="Prévia sanitizada">
          {email.body_excerpt ? (
            <p className="email-body-preview">{email.body_excerpt}</p>
          ) : (
            <p className="muted">
              Conteúdo protegido. Mensagens de verificação não exibem código ou corpo no painel.
            </p>
          )}
        </AdminSection>
        <AdminSection title="Histórico de acesso" meta={`${email.events.length} evento(s)`}>
          {email.events.length ? (
            <ol className="email-detail-timeline">
              {email.events.map((event) => (
                <li key={event.id}>
                  <span>{event.event_type}</span>
                  <time>{dateTime(event.occurred_at)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Nenhum evento de acesso registrado.</p>
          )}
        </AdminSection>
      </div>
    </AdminPage>
  );
}

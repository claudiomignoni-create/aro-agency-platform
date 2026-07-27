import Link from "next/link";
import { AdminDataTable, AdminPage, AdminPageHeader, AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PresentationAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  const supabase = await createClient();
  const [presentationResult, recipientResult, eventResult, emailResult] = await Promise.all([
    supabase.from("presentations").select("id, title, status").eq("id", id).maybeSingle(),
    supabase
      .from("presentation_recipients")
      .select("id, recipient_email, recipient_name, sent_at, opened_at, outbound_email_id")
      .eq("presentation_id", id)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("presentation_access_events")
      .select("id, event_type, occurred_at, metadata")
      .eq("presentation_id", id)
      .order("occurred_at", { ascending: false })
      .limit(80),
    supabase
      .from("outbound_emails")
      .select("id, recipient_email, status, mode, sent_at, failed_at, error_message_sanitized")
      .eq("presentation_id", id)
      .order("created_at", { ascending: false })
      .limit(80)
  ]);

  if (presentationResult.error) throw presentationResult.error;
  if (recipientResult.error) throw recipientResult.error;
  if (eventResult.error) throw eventResult.error;
  if (emailResult.error) throw emailResult.error;

  const presentation = presentationResult.data;
  const recipients = recipientResult.data ?? [];
  const events = eventResult.data ?? [];
  const emails = emailResult.data ?? [];
  const opens = events.filter((event) => event.event_type === "opened").length;

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href={`/admin/presentations/${id}`}>Voltar</Link>}
        description="Acessos públicos, recipients e fila de e-mails vinculados à apresentação."
        eyebrow="Presentation"
        title="Analytics"
      />

      <AdminSection meta={<AdminStatusPill>{presentation?.status ?? "não encontrada"}</AdminStatusPill>} title={presentation?.title ?? "Apresentação"}>
        <div className="admin-kv-grid">
          <span>Destinatários</span>
          <strong>{recipients.length}</strong>
          <span>Aberturas registradas</span>
          <strong>{opens}</strong>
          <span>E-mails vinculados</span>
          <strong>{emails.length}</strong>
        </div>
      </AdminSection>

      <AdminSection title="Destinatários">
        <AdminDataTable>
          <thead>
            <tr>
              <th>Contato</th>
              <th>Enviado</th>
              <th>Aberto</th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((recipient) => (
              <tr key={recipient.id}>
                <td data-label="Contato">
                  <strong>{recipient.recipient_name || recipient.recipient_email}</strong>
                  <br />
                  <span className="muted">{recipient.recipient_email}</span>
                </td>
                <td data-label="Enviado">{recipient.sent_at ? new Date(recipient.sent_at).toLocaleString("pt-BR") : "—"}</td>
                <td data-label="Aberto">{recipient.opened_at ? new Date(recipient.opened_at).toLocaleString("pt-BR") : "—"}</td>
              </tr>
            ))}
            {!recipients.length ? (
              <tr>
                <td colSpan={3}>Nenhum destinatário registrado.</td>
              </tr>
            ) : null}
          </tbody>
        </AdminDataTable>
      </AdminSection>

      <AdminSection title="Fila de e-mails">
        <AdminDataTable>
          <thead>
            <tr>
              <th>Destinatário</th>
              <th>Modo</th>
              <th>Status</th>
              <th>Erro</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((email) => (
              <tr key={email.id}>
                <td data-label="Destinatário">{email.recipient_email}</td>
                <td data-label="Modo">{email.mode}</td>
                <td data-label="Status"><AdminStatusPill>{email.status}</AdminStatusPill></td>
                <td data-label="Erro">{email.error_message_sanitized || "—"}</td>
              </tr>
            ))}
            {!emails.length ? (
              <tr>
                <td colSpan={4}>Nenhum e-mail vinculado.</td>
              </tr>
            ) : null}
          </tbody>
        </AdminDataTable>
      </AdminSection>

      <AdminSection title="Eventos de acesso">
        <AdminDataTable>
          <thead>
            <tr>
              <th>Evento</th>
              <th>Quando</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td data-label="Evento">{event.event_type}</td>
                <td data-label="Quando">{new Date(event.occurred_at).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
            {!events.length ? (
              <tr>
                <td colSpan={2}>Nenhum acesso registrado.</td>
              </tr>
            ) : null}
          </tbody>
        </AdminDataTable>
      </AdminSection>
    </AdminPage>
  );
}

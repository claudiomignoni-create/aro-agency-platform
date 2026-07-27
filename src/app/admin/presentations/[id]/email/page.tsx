import Link from "next/link";
import { AdminPage, AdminPageHeader, AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { createPresentationEmailsAction } from "@/app/admin/presentations/actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type PresentationEmailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
};

function errorMessage(error?: string) {
  if (error === "missing-recipient") return "Informe ao menos um destinatário.";
  if (error === "not-published") return "Publique a apresentação antes de enviar.";
  if (error === "missing-schedule") return "Informe data e hora para agendar.";
  if (error === "invalid-schedule") return "O agendamento precisa estar no futuro.";
  return null;
}

export default async function PresentationEmailPage({ params, searchParams }: PresentationEmailPageProps) {
  await requireRole(["admin"]);
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const supabase = await createClient();
  const { data: presentation, error } = await supabase
    .from("presentations")
    .select(`
      id,
      title,
      status,
      snapshot,
      agency_id,
      client_id,
      client:clients(contact_name, company_name, email),
      agency:partner_agencies(contact_name, display_name, primary_email, secondary_email)
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  const snapshot = (presentation?.snapshot ?? {}) as { models?: unknown[] };
  const client = Array.isArray(presentation?.client) ? presentation?.client[0] : presentation?.client;
  const agency = Array.isArray(presentation?.agency) ? presentation?.agency[0] : presentation?.agency;
  const [clientContactsResult, agencyContactsResult] = await Promise.all([
    presentation?.client_id
      ? supabase
          .from("client_contacts")
          .select("id, contact_name, email, can_receive_emails")
          .eq("client_id", presentation.client_id)
          .not("email", "is", null)
          .order("is_primary", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
    presentation?.agency_id
      ? supabase
          .from("partner_agency_contacts")
          .select("id, full_name, email, contact_type")
          .eq("agency_id", presentation.agency_id)
          .not("email", "is", null)
          .order("is_primary", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (clientContactsResult.error) throw clientContactsResult.error;
  if (agencyContactsResult.error) throw agencyContactsResult.error;

  const createEmails = createPresentationEmailsAction.bind(null, id);
  const suggestedRecipients = [
    client?.email ? { email: client.email, name: client.contact_name || client.company_name, source: "Cliente" } : null,
    ...(clientContactsResult.data ?? []).map((contact) => ({
      email: contact.email,
      name: contact.contact_name,
      source: contact.can_receive_emails ? "Contato autorizado" : "Contato do cliente"
    })),
    agency?.primary_email ? { email: agency.primary_email, name: agency.contact_name || agency.display_name, source: "Agência" } : null,
    agency?.secondary_email ? { email: agency.secondary_email, name: agency.display_name, source: "Agência" } : null,
    ...(agencyContactsResult.data ?? []).map((contact) => ({
      email: contact.email,
      name: contact.full_name,
      source: contact.contact_type || "Contato da agência"
    }))
  ].filter((recipient): recipient is { email: string; name: string | null; source: string } => Boolean(recipient?.email));
  const message = errorMessage(query.error);

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href={`/admin/presentations/${id}`}>Voltar</Link>}
        description="Envio individual pela fila do Email Center, sem CC em massa e sem anexos privados."
        eyebrow="Presentation"
        title="Enviar apresentação"
      />

      {message ? (
        <AdminSection title="Atenção">
          <p className="muted">{message}</p>
        </AdminSection>
      ) : null}

      <AdminSection
        meta={<AdminStatusPill>{presentation?.status ?? "não encontrada"}</AdminStatusPill>}
        title={presentation?.title ?? "Apresentação não encontrada"}
      >
        {presentation ? (
          <div className="admin-kv-grid">
            <span>Modelos no snapshot</span>
            <strong>{snapshot.models?.length ?? 0}</strong>
            <span>Cliente sugerido</span>
            <strong>{client?.company_name || client?.contact_name || "—"}</strong>
          </div>
        ) : (
          <p className="muted">Não foi possível carregar esta apresentação.</p>
        )}
      </AdminSection>

      {presentation ? (
        <AdminSection title="Destinatários e modo de envio">
          <form action={createEmails} className="admin-form-grid">
            {suggestedRecipients.length ? (
              <div className="admin-field">
                <span>Destinatários sugeridos</span>
                {suggestedRecipients.map((recipient) => (
                  <label className="admin-checkbox-row" key={`${recipient.source}-${recipient.email}`}>
                    <input name="recipient" type="checkbox" value={recipient.email} />
                    <span>
                      {recipient.name ? `${recipient.name} · ${recipient.email}` : recipient.email}
                      <small className="muted"> {recipient.source}</small>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}

            <label className="admin-field">
              <span>E-mail manual</span>
              <input name="manual_email" placeholder="cliente@empresa.com" type="email" />
            </label>

            <label className="admin-field">
              <span>Assunto</span>
              <input name="subject" placeholder={`ARO — ${presentation.title}`} />
            </label>

            <label className="admin-field">
              <span>Modo</span>
              <select name="mode" defaultValue="system_draft">
                <option value="system_draft">Rascunho interno</option>
                <option value="gmail_draft">Criar rascunho Gmail</option>
                <option value="send_now">Enviar agora pela fila</option>
                <option value="scheduled">Agendar pela fila</option>
              </select>
            </label>

            <label className="admin-field">
              <span>Data do agendamento</span>
              <input name="scheduled_date" type="date" />
            </label>

            <label className="admin-field">
              <span>Hora</span>
              <input name="scheduled_time" type="time" />
            </label>

            <label className="admin-field">
              <span>Timezone</span>
              <input name="scheduled_timezone" defaultValue="America/Sao_Paulo" />
            </label>

            <div className="admin-form-actions">
              <button className="button" type="submit">Criar envio</button>
              <Link className="button secondary" href="/admin/email">Ver Email Center</Link>
            </div>
          </form>
          <p className="muted">
            Para envio real, a conexão Google precisa estar válida e destinatários externos continuam bloqueados pelo modo seguro.
          </p>
        </AdminSection>
      ) : null}
    </AdminPage>
  );
}

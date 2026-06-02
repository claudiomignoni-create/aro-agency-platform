import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientProfile } from "@/lib/clients";
import type { Client, ClientContact, ClientStatus, ClientType } from "@/types/database";

type AdminClientDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const clientTypeLabels: Record<ClientType, string> = {
  brand: "Brand",
  casting_director: "Casting Director",
  international_agency: "International Agency",
  other: "Other",
  partner: "Partner",
  photographer: "Photographer",
  production: "Production"
};

const statusLabels: Record<ClientStatus, string> = {
  active: "Active",
  do_not_contact: "Do Not Contact",
  inactive: "Inactive",
  lead: "Lead",
  partner: "Partner"
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return dateFormatter.format(date);
}

function fieldValue(value: string | null | undefined) {
  return value?.trim() || "-";
}

function booleanLabel(value: boolean) {
  return value ? "Sim" : "Não";
}

function getLocation(client: Client) {
  return [client.city, client.country].filter(Boolean).join(", ") || "-";
}

function tagsValue(tags: string[]) {
  return tags.length ? tags.join(", ") : "-";
}

function DetailItem({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ContactCard({ contact }: { contact: ClientContact }) {
  return (
    <article className="contact-detail-card">
      <div className="contact-detail-heading">
        <strong>{contact.contact_name}</strong>
        {contact.is_primary ? <span>Principal</span> : null}
      </div>
      <div className="detail-grid compact">
        <DetailItem label="Cargo" value={fieldValue(contact.role)} />
        <DetailItem label="Email" value={fieldValue(contact.email)} />
        <DetailItem label="Telefone" value={fieldValue(contact.phone)} />
        <DetailItem label="WhatsApp" value={fieldValue(contact.whatsapp)} />
        <DetailItem label="WeChat" value={fieldValue(contact.wechat)} />
        <DetailItem
          label="Pode receber emails futuramente"
          value={booleanLabel(contact.can_receive_emails)}
        />
        <DetailItem label="Notas" value={fieldValue(contact.notes)} />
      </div>
    </article>
  );
}

export default async function AdminClientDetailPage({
  params
}: AdminClientDetailPageProps) {
  const { id } = await params;
  const profile = await getClientProfile(id);

  if (!profile) {
    notFound();
  }

  const { client, contacts } = profile;

  return (
    <div className="client-detail-shell">
      <section className="client-detail-header">
        <div>
          <span className="eyebrow">Cliente</span>
          <h2>{client.company_name}</h2>
          <p>
            {clientTypeLabels[client.client_type]} · {statusLabels[client.status]} ·{" "}
            {getLocation(client)}
          </p>
        </div>
        <Link className="button secondary" href="/admin/clients">
          Voltar
        </Link>
      </section>

      {client.status === "do_not_contact" ? (
        <section className="client-alert">
          Este cliente está marcado como Do Not Contact e não deve entrar em
          futuras seleções de email.
        </section>
      ) : null}

      <section className="client-detail-section">
        <div>
          <span className="eyebrow">Dados do cliente</span>
          <h3>Informações principais</h3>
        </div>
        <div className="detail-grid">
          <DetailItem label="Nome da empresa" value={client.company_name} />
          <DetailItem label="Tipo" value={clientTypeLabels[client.client_type]} />
          <DetailItem label="Status" value={statusLabels[client.status]} />
          <DetailItem label="País" value={fieldValue(client.country)} />
          <DetailItem label="Cidade" value={fieldValue(client.city)} />
          <DetailItem label="Email geral" value={fieldValue(client.general_email)} />
          <DetailItem label="Telefone geral" value={fieldValue(client.general_phone)} />
          <DetailItem
            label="WhatsApp geral"
            value={fieldValue(client.general_whatsapp)}
          />
          <DetailItem label="WeChat geral" value={fieldValue(client.general_wechat)} />
          <DetailItem label="Website" value={fieldValue(client.website)} />
          <DetailItem label="Tags" value={tagsValue(client.tags)} />
          <DetailItem
            label="Último contato"
            value={formatDate(client.last_contact_at)}
          />
          <DetailItem
            label="Próximo follow-up"
            value={formatDate(client.next_follow_up_at)}
          />
        </div>
      </section>

      <section className="client-detail-section">
        <div>
          <span className="eyebrow">Pessoas de contato</span>
          <h3>Contatos vinculados</h3>
        </div>
        {contacts.length ? (
          <div className="contacts-detail-list">
            {contacts.map((contact) => (
              <ContactCard contact={contact} key={contact.id} />
            ))}
          </div>
        ) : (
          <p className="empty-copy">Nenhuma pessoa de contato cadastrada ainda.</p>
        )}
      </section>

      <section className="client-detail-section">
        <div>
          <span className="eyebrow">Observações internas</span>
          <h3>Notas e preferências</h3>
        </div>
        <div className="notes-grid">
          <DetailItem
            label="Observações de mercado"
            value={fieldValue(client.market_notes)}
          />
          <DetailItem
            label="Perfil de modelos que costuma buscar"
            value={fieldValue(client.preferred_model_profile)}
          />
          <DetailItem
            label="Observações internas"
            value={fieldValue(client.internal_notes)}
          />
        </div>
      </section>

      <style>{`
        .client-detail-shell {
          display: grid;
          gap: 1rem;
        }

        .client-detail-header,
        .client-detail-section,
        .client-alert {
          background: color-mix(in srgb, var(--panel) 92%, transparent);
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.16);
          padding: 1rem;
        }

        .client-detail-header {
          align-items: flex-start;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
        }

        .client-detail-header h2,
        .client-detail-section h3 {
          margin: 0;
        }

        .client-detail-header h2 {
          font-size: 1.45rem;
          line-height: 1.2;
        }

        .client-detail-header p {
          font-size: 0.875rem;
          line-height: 1.45;
          margin: 0.35rem 0 0;
        }

        .client-alert {
          border-color: color-mix(in srgb, var(--danger) 72%, var(--line));
          color: var(--danger);
          font-size: 0.86rem;
          line-height: 1.45;
        }

        .client-detail-section {
          display: grid;
          gap: 1rem;
        }

        .client-detail-section h3 {
          font-size: 1rem;
        }

        .detail-grid,
        .notes-grid {
          display: grid;
          gap: 0.75rem;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .detail-grid.compact {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .detail-item {
          border: 1px solid var(--line);
          border-radius: 8px;
          display: grid;
          gap: 0.3rem;
          min-height: 4.15rem;
          padding: 0.75rem;
        }

        .detail-item span {
          color: var(--muted-strong);
          font-size: 0.68rem;
          line-height: 1.25;
          text-transform: uppercase;
        }

        .detail-item strong {
          color: var(--foreground);
          font-size: 0.82rem;
          font-weight: 800;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .contacts-detail-list {
          display: grid;
          gap: 0.85rem;
        }

        .contact-detail-card {
          border: 1px solid var(--line);
          border-radius: 8px;
          display: grid;
          gap: 0.85rem;
          padding: 0.85rem;
        }

        .contact-detail-heading {
          align-items: center;
          display: flex;
          gap: 0.6rem;
          justify-content: space-between;
        }

        .contact-detail-heading strong {
          font-size: 0.9rem;
        }

        .contact-detail-heading span {
          border: 1px solid color-mix(in srgb, var(--success) 54%, transparent);
          border-radius: 999px;
          color: var(--success);
          font-size: 0.68rem;
          line-height: 1;
          padding: 0.3rem 0.5rem;
        }

        .empty-copy {
          margin: 0;
        }

        @media (max-width: 960px) {
          .detail-grid,
          .notes-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .client-detail-header {
            flex-direction: column;
          }

          .detail-grid,
          .detail-grid.compact,
          .notes-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

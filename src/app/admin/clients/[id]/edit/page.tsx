import Link from "next/link";
import { notFound } from "next/navigation";
import { updateClientAction } from "../../actions";
import { BillingFields } from "../../billing-fields";
import { ChannelFields } from "../../channel-fields";
import { ContactFields } from "../../new/contact-fields";
import { getClientProfile } from "@/lib/clients";
import type { ClientStatus, ClientType } from "@/types/database";

type EditClientPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const clientTypeOptions: Array<{ label: string; value: ClientType }> = [
  { label: "International Agency", value: "international_agency" },
  { label: "Brand", value: "brand" },
  { label: "Production", value: "production" },
  { label: "Photographer", value: "photographer" },
  { label: "Casting Director", value: "casting_director" },
  { label: "Partner", value: "partner" },
  { label: "Other", value: "other" }
];

const statusOptions: Array<{ label: string; value: ClientStatus }> = [
  { label: "Lead", value: "lead" },
  { label: "Active", value: "active" },
  { label: "Partner", value: "partner" },
  { label: "Inactive", value: "inactive" },
  { label: "Do Not Contact", value: "do_not_contact" }
];

function dateInputValue(value: string | null) {
  return value?.slice(0, 10) ?? "";
}

export default async function EditClientPage({ params }: EditClientPageProps) {
  const { id } = await params;
  const profile = await getClientProfile(id);

  if (!profile) {
    notFound();
  }

  const { channels, client, contacts } = profile;

  return (
    <div className="client-form-shell">
      <section className="client-form-header">
        <div>
          <span className="eyebrow">Admin</span>
          <h2>Editar cliente</h2>
          <p>
            Atualize os dados da empresa e as pessoas de contato vinculadas a
            este cliente.
          </p>
        </div>
      </section>

      <form action={updateClientAction.bind(null, client.id)} className="client-form">
        <section className="client-form-section">
          <div>
            <span className="eyebrow">Dados principais</span>
            <h3>Empresa</h3>
          </div>
          <div className="client-form-grid">
            <label className="wide-field">
              Nome da empresa / cliente
              <input
                autoComplete="organization"
                defaultValue={client.company_name}
                name="company_name"
                required
              />
            </label>
            <label>
              Tipo de cliente
              <select defaultValue={client.client_type} name="client_type">
                {clientTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select defaultValue={client.status} name="status">
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              País
              <input
                autoComplete="country-name"
                defaultValue={client.country ?? ""}
                name="country"
              />
            </label>
            <label>
              Cidade
              <input
                autoComplete="address-level2"
                defaultValue={client.city ?? ""}
                name="city"
              />
            </label>
          </div>
        </section>

        <section className="client-form-section">
          <div>
            <span className="eyebrow">Contatos gerais da empresa</span>
            <h3>Canais institucionais</h3>
          </div>
          <div className="client-form-grid">
            <label>
              Email geral
              <input
                autoComplete="email"
                defaultValue={client.general_email ?? ""}
                name="general_email"
                type="email"
              />
            </label>
            <label>
              Telefone geral
              <input
                autoComplete="tel"
                defaultValue={client.general_phone ?? ""}
                name="general_phone"
              />
            </label>
            <label>
              WhatsApp geral
              <input
                defaultValue={client.general_whatsapp ?? ""}
                name="general_whatsapp"
              />
            </label>
            <label>
              WeChat geral
              <input
                defaultValue={client.general_wechat ?? ""}
                name="general_wechat"
              />
            </label>
            <label className="wide-field">
              Website
              <input
                autoComplete="url"
                defaultValue={client.website ?? ""}
                name="website"
                type="url"
              />
            </label>
          </div>
        </section>

        <ChannelFields initialChannels={channels} />
        <BillingFields client={client} />

        <section className="client-form-section">
          <div>
            <span className="eyebrow">Organização interna</span>
            <h3>Segmentação e follow-up</h3>
          </div>
          <div className="client-form-grid">
            <label className="wide-field">
              Tags
              <input defaultValue={client.tags.join(", ")} name="tags" />
            </label>
            <label>
              Último contato
              <input
                defaultValue={dateInputValue(client.last_contact_at)}
                name="last_contact_at"
                type="date"
              />
            </label>
            <label>
              Próximo follow-up
              <input
                defaultValue={dateInputValue(client.next_follow_up_at)}
                name="next_follow_up_at"
                type="date"
              />
            </label>
            <label className="wide-field">
              Observações de mercado
              <textarea
                defaultValue={client.market_notes ?? ""}
                name="market_notes"
                rows={4}
              />
            </label>
            <label className="wide-field">
              Perfil de modelos que costuma buscar
              <textarea
                defaultValue={client.preferred_model_profile ?? ""}
                name="preferred_model_profile"
                rows={4}
              />
            </label>
            <label className="wide-field">
              Observações internas
              <textarea
                defaultValue={client.internal_notes ?? ""}
                name="internal_notes"
                rows={4}
              />
            </label>
          </div>
        </section>

        <ContactFields initialContacts={contacts} />

        <div className="client-form-actions">
          <Link className="button secondary" href={`/admin/clients/${client.id}`}>
            Cancelar
          </Link>
          <button className="button" type="submit">
            Salvar alterações
          </button>
        </div>
      </form>

      <style>{`
        .client-form-shell {
          display: grid;
          gap: 1rem;
          max-width: 100%;
          min-width: 0;
        }

        .client-form-header,
        .client-form-section {
          background:
            linear-gradient(180deg, rgba(10, 30, 55, 0.88), rgba(13, 38, 68, 0.72)),
            color-mix(in srgb, #102a4a 86%, var(--panel));
          border: 1px solid color-mix(in srgb, #6eb6ff 20%, transparent);
          border-radius: 8px;
          box-shadow: 0 16px 42px rgba(0, 0, 0, 0.14);
          max-width: 100%;
          min-width: 0;
          padding: 1rem;
        }

        .client-form-header h2,
        .client-form-section h3 {
          margin: 0;
        }

        .client-form-header h2 {
          font-size: 1.35rem;
          line-height: 1.2;
        }

        .client-form-header p {
          font-size: 0.875rem;
          line-height: 1.45;
          margin: 0.35rem 0 0;
          max-width: 44rem;
        }

        .client-form {
          display: grid;
          gap: 1rem;
        }

        .client-form-section {
          display: grid;
          gap: 0.85rem;
        }

        .client-section-heading {
          align-items: flex-start;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
        }

        .client-form-section h3 {
          color: color-mix(in srgb, #e8f4ff 92%, white);
          font-size: 1rem;
          font-weight: 680;
          letter-spacing: 0;
        }

        .client-form-section p {
          color: color-mix(in srgb, #aacfe8 86%, white);
          font-size: 0.78rem;
          line-height: 1.45;
          margin: 0.35rem 0 0;
          max-width: 42rem;
        }

        .client-form-grid {
          display: grid;
          gap: 0.85rem;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          min-width: 0;
        }

        .client-form-grid label {
          color: color-mix(in srgb, #aacfe8 88%, white);
          font-size: 0.82rem;
          font-weight: 650;
          line-height: 1.35;
          min-width: 0;
        }

        .client-form-grid input,
        .client-form-grid select,
        .client-form-grid textarea {
          margin-top: 0.3rem;
          min-width: 0;
          resize: vertical;
        }

        .wide-field {
          grid-column: 1 / -1;
        }

        .contact-list {
          display: grid;
          gap: 0.85rem;
        }

        .contact-card {
          background: rgba(6, 22, 42, 0.28);
          border: 1px solid rgba(126, 196, 255, 0.14);
          border-radius: 8px;
          display: grid;
          gap: 0.85rem;
          padding: 0.85rem;
        }

        .contact-card-header {
          align-items: center;
          display: flex;
          gap: 0.75rem;
          justify-content: space-between;
        }

        .contact-card-header strong {
          color: color-mix(in srgb, #eef8ff 92%, white);
          font-size: 0.88rem;
        }

        .checkbox-field {
          align-items: center;
          display: inline-flex;
          gap: 0.45rem;
          min-height: 2.5rem;
        }

        .checkbox-field input {
          margin: 0;
          width: auto;
        }

        .client-form-actions {
          align-items: center;
          display: flex;
          gap: 0.65rem;
          justify-content: flex-end;
        }

        @media (max-width: 720px) {
          .client-form-header,
          .client-form-section {
            padding: 0.8rem;
          }

          .client-section-heading {
            flex-direction: column;
          }

          .client-form-grid {
            grid-template-columns: 1fr;
          }

          .client-form-actions {
            align-items: stretch;
            flex-direction: column;
            justify-content: flex-start;
          }

          .contact-card-header {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        @media (max-width: 390px) {
          .client-form-header,
          .client-form-section,
          .contact-card {
            padding: 0.72rem;
          }
        }
      `}</style>
    </div>
  );
}

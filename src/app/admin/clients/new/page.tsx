import Link from "next/link";
import { createClientAction } from "../actions";
import { ChannelFields } from "../channel-fields";
import { ContactFields } from "./contact-fields";
import type { ClientStatus, ClientType } from "@/types/database";

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

export default function NewClientPage() {
  return (
    <div className="client-form-shell">
      <section className="client-form-header">
        <div>
          <span className="eyebrow">Admin</span>
          <h2>Novo cliente</h2>
          <p>
            Cadastre uma empresa, agência, marca, produtora ou parceiro
            internacional da AROLAB.
          </p>
        </div>
      </section>

      <form action={createClientAction} className="client-form">
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
                name="company_name"
                placeholder="Elite Bangkok"
                required
              />
            </label>
            <label>
              Tipo de cliente
              <select defaultValue="other" name="client_type">
                {clientTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select defaultValue="lead" name="status">
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              País
              <input autoComplete="country-name" name="country" placeholder="Thailand" />
            </label>
            <label>
              Cidade
              <input autoComplete="address-level2" name="city" placeholder="Bangkok" />
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
                name="general_email"
                placeholder="info@elitebangkok.com"
                type="email"
              />
            </label>
            <label>
              Telefone geral
              <input autoComplete="tel" name="general_phone" placeholder="+66..." />
            </label>
            <label>
              WhatsApp geral
              <input name="general_whatsapp" placeholder="+66..." />
            </label>
            <label>
              WeChat geral
              <input name="general_wechat" placeholder="WeChat oficial" />
            </label>
            <label className="wide-field">
              Website
              <input
                autoComplete="url"
                name="website"
                placeholder="https://..."
                type="url"
              />
            </label>
          </div>
        </section>

        <ChannelFields />

        <section className="client-form-section">
          <div>
            <span className="eyebrow">Organização interna</span>
            <h3>Segmentação e follow-up</h3>
          </div>
          <div className="client-form-grid">
            <label className="wide-field">
              Tags
              <input name="tags" placeholder="Asia, Fashion, Commercial" />
            </label>
            <label>
              Último contato
              <input name="last_contact_at" type="date" />
            </label>
            <label>
              Próximo follow-up
              <input name="next_follow_up_at" type="date" />
            </label>
            <label className="wide-field">
              Observações de mercado
              <textarea name="market_notes" rows={4} />
            </label>
            <label className="wide-field">
              Perfil de modelos que costuma buscar
              <textarea name="preferred_model_profile" rows={4} />
            </label>
            <label className="wide-field">
              Observações internas
              <textarea name="internal_notes" rows={4} />
            </label>
          </div>
        </section>

        <ContactFields />

        <div className="client-form-actions">
          <Link className="button secondary" href="/admin/clients">
            Cancelar
          </Link>
          <button className="button" type="submit">
            Salvar cliente
          </button>
        </div>
      </form>

      <style>{`
        .client-form-shell {
          display: grid;
          gap: 1rem;
        }

        .client-form-header,
        .client-form-section {
          background: color-mix(in srgb, var(--panel) 92%, transparent);
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.16);
          padding: 1rem;
        }

        .client-form-header h2,
        .client-form-section h3 {
          margin: 0;
        }

        .client-form-header h2 {
          font-size: 1.45rem;
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
          gap: 1rem;
        }

        .client-section-heading {
          align-items: flex-start;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
        }

        .client-form-section h3 {
          font-size: 1rem;
        }

        .client-form-section p {
          font-size: 0.82rem;
          line-height: 1.45;
          margin: 0.35rem 0 0;
          max-width: 42rem;
        }

        .client-form-grid {
          display: grid;
          gap: 0.85rem;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .client-form-grid label {
          color: var(--muted-strong);
          font-size: 0.75rem;
          line-height: 1.35;
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
          border: 1px solid var(--line);
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
          font-size: 0.86rem;
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
          .client-section-heading {
            flex-direction: column;
          }

          .client-form-grid {
            grid-template-columns: 1fr;
          }

          .client-form-actions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}

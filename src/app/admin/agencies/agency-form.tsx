import Link from "next/link";
import { agencyStatusOptions, agencyTypeOptions } from "@/lib/agencies";
import type { PartnerAgency } from "@/types/database";

type AgencyFormProps = {
  action: (formData: FormData) => Promise<void>;
  agency?: PartnerAgency;
  submitLabel: string;
};

function value(value: string | number | null | undefined) {
  return value ?? "";
}

export function AgencyForm({ action, agency, submitLabel }: AgencyFormProps) {
  return (
    <form action={action} className="aro-glass-card agency-form">
      <div className="agency-form-grid">
        <label>
          Nome visivel
          <input defaultValue={value(agency?.display_name)} name="display_name" required />
        </label>
        <label>
          Razao social
          <input defaultValue={value(agency?.legal_name)} name="legal_name" />
        </label>
        <label>
          Tipo
          <select defaultValue={agency?.agency_type ?? "partner_agency"} name="agency_type">
            {agencyTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select defaultValue={agency?.status ?? "prospect"} name="status">
            {agencyStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pais
          <input defaultValue={value(agency?.country)} name="country" />
        </label>
        <label>
          Codigo do pais
          <input defaultValue={value(agency?.country_code)} maxLength={2} name="country_code" />
        </label>
        <label>
          Cidade
          <input defaultValue={value(agency?.city)} name="city" />
        </label>
        <label>
          Estado/regiao
          <input defaultValue={value(agency?.state_region)} name="state_region" />
        </label>
        <label>
          Timezone
          <input defaultValue={value(agency?.timezone)} name="timezone" />
        </label>
        <label>
          Website
          <input defaultValue={value(agency?.website_url)} name="website_url" type="url" />
        </label>
        <label>
          Instagram
          <input defaultValue={value(agency?.instagram_url)} name="instagram_url" type="url" />
        </label>
        <label>
          E-mail principal
          <input defaultValue={value(agency?.primary_email)} name="primary_email" type="email" />
        </label>
        <label>
          E-mail secundario
          <input defaultValue={value(agency?.secondary_email)} name="secondary_email" type="email" />
        </label>
        <label>
          Telefone
          <input defaultValue={value(agency?.phone)} name="phone" />
        </label>
        <label>
          WhatsApp
          <input defaultValue={value(agency?.whatsapp)} name="whatsapp" />
        </label>
        <label>
          Contato principal
          <input defaultValue={value(agency?.contact_name)} name="contact_name" />
        </label>
        <label>
          Cargo do contato
          <input defaultValue={value(agency?.contact_role)} name="contact_role" />
        </label>
        <label>
          Moeda padrao
          <input defaultValue={value(agency?.default_currency)} name="default_currency" />
        </label>
        <label>
          Prazo de pagamento
          <input
            defaultValue={value(agency?.default_payment_terms_days)}
            min={0}
            name="default_payment_terms_days"
            type="number"
          />
        </label>
        <label className="span-2">
          Observacoes internas
          <textarea defaultValue={value(agency?.notes)} name="notes" rows={5} />
        </label>
      </div>
      <div className="actions">
        <Link className="button secondary" href={agency ? `/admin/agencies/${agency.id}` : "/admin/agencies"}>
          Cancelar
        </Link>
        <button className="button" type="submit">
          {submitLabel}
        </button>
      </div>

      <style>{`
        .agency-form {
          padding: 18px;
        }

        .agency-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .agency-form label {
          display: grid;
          gap: 7px;
          color: var(--admin-muted);
          font-size: 12px;
          font-weight: 800;
        }

        .agency-form input,
        .agency-form select,
        .agency-form textarea {
          border: 1px solid var(--admin-border);
          border-radius: 10px;
          background: rgba(2, 18, 50, 0.34);
          color: var(--admin-text);
          min-height: 42px;
          padding: 0 11px;
        }

        .agency-form textarea {
          padding: 11px;
          resize: vertical;
        }

        .agency-form .span-2 {
          grid-column: span 2;
        }

        @media (max-width: 760px) {
          .agency-form-grid {
            grid-template-columns: 1fr;
          }

          .agency-form .span-2 {
            grid-column: auto;
          }
        }
      `}</style>
    </form>
  );
}

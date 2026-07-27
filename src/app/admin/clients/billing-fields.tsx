import type { Client } from "@/types/database";

type BillingFieldsProps = {
  client?: Client;
};

function value(client: Client | undefined, key: keyof Client) {
  return client?.[key] ? String(client[key]) : "";
}

export function BillingFields({ client }: BillingFieldsProps) {
  return (
    <>
      <section className="client-form-section">
        <div>
          <span className="eyebrow">Faturamento Brasil</span>
          <h3>Dados fiscais</h3>
        </div>
        <div className="client-form-grid">
          <label>
            Pessoa
            <select defaultValue={value(client, "billing_person_type")} name="billing_person_type">
              <option value="">Não informado</option>
              <option value="pj">PJ</option>
              <option value="pf">PF</option>
              <option value="international">Internacional</option>
            </select>
          </label>
          <label>
            Moeda padrão
            <select defaultValue={value(client, "default_currency") || "BRL"} name="default_currency">
              <option>BRL</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </label>
          <label>
            Nome fantasia
            <input defaultValue={value(client, "billing_trade_name")} name="billing_trade_name" />
          </label>
          <label>
            Razão social
            <input defaultValue={value(client, "billing_legal_name")} name="billing_legal_name" />
          </label>
          <label>
            CNPJ
            <input defaultValue={value(client, "billing_cnpj")} name="billing_cnpj" />
          </label>
          <label>
            CPF
            <input defaultValue={value(client, "billing_cpf")} name="billing_cpf" />
          </label>
          <label>
            Inscrição estadual
            <input defaultValue={value(client, "billing_state_registration")} name="billing_state_registration" />
          </label>
          <label>
            Inscrição municipal
            <input defaultValue={value(client, "billing_municipal_registration")} name="billing_municipal_registration" />
          </label>
          <label>
            Regime tributário
            <input defaultValue={value(client, "billing_tax_regime")} name="billing_tax_regime" />
          </label>
          <label>
            CEP
            <input defaultValue={value(client, "billing_postal_code")} name="billing_postal_code" />
          </label>
          <label className="wide-field">
            Endereço fiscal
            <input defaultValue={value(client, "billing_address_line")} name="billing_address_line" />
          </label>
          <label>
            Número
            <input defaultValue={value(client, "billing_address_number")} name="billing_address_number" />
          </label>
          <label>
            Complemento
            <input defaultValue={value(client, "billing_address_complement")} name="billing_address_complement" />
          </label>
          <label>
            Bairro
            <input defaultValue={value(client, "billing_neighborhood")} name="billing_neighborhood" />
          </label>
          <label>
            Cidade
            <input defaultValue={value(client, "billing_city")} name="billing_city" />
          </label>
          <label>
            Estado
            <input defaultValue={value(client, "billing_state")} name="billing_state" />
          </label>
          <label>
            País
            <input defaultValue={value(client, "billing_country")} name="billing_country" />
          </label>
          <label>
            Contato financeiro
            <input defaultValue={value(client, "billing_contact_name")} name="billing_contact_name" />
          </label>
          <label>
            E-mail de cobrança
            <input defaultValue={value(client, "billing_email")} name="billing_email" type="email" />
          </label>
          <label>
            Telefone financeiro
            <input defaultValue={value(client, "billing_phone")} name="billing_phone" />
          </label>
          <label>
            Prazo de pagamento
            <input defaultValue={value(client, "payment_terms")} name="payment_terms" />
          </label>
          <label className="wide-field">
            Observações para nota fiscal
            <textarea defaultValue={value(client, "invoice_notes")} name="invoice_notes" rows={3} />
          </label>
          <label className="wide-field">
            Observações fiscais
            <textarea defaultValue={value(client, "tax_notes")} name="tax_notes" rows={3} />
          </label>
        </div>
      </section>

      <section className="client-form-section">
        <div>
          <span className="eyebrow">International billing</span>
          <h3>Tax and invoice data</h3>
        </div>
        <div className="client-form-grid">
          <label>
            Trading name
            <input defaultValue={value(client, "intl_trading_name")} name="intl_trading_name" />
          </label>
          <label>
            Legal company name
            <input defaultValue={value(client, "intl_legal_company_name")} name="intl_legal_company_name" />
          </label>
          <label>
            Country
            <input defaultValue={value(client, "intl_country")} name="intl_country" />
          </label>
          <label>
            Tax ID
            <input defaultValue={value(client, "intl_tax_id")} name="intl_tax_id" />
          </label>
          <label>
            VAT Number
            <input defaultValue={value(client, "intl_vat_number")} name="intl_vat_number" />
          </label>
          <label>
            Company registration number
            <input defaultValue={value(client, "intl_company_registration_number")} name="intl_company_registration_number" />
          </label>
          <label className="wide-field">
            Billing address
            <input defaultValue={value(client, "intl_billing_address")} name="intl_billing_address" />
          </label>
          <label>
            Billing city
            <input defaultValue={value(client, "intl_billing_city")} name="intl_billing_city" />
          </label>
          <label>
            Billing state
            <input defaultValue={value(client, "intl_billing_state")} name="intl_billing_state" />
          </label>
          <label>
            Billing postal code
            <input defaultValue={value(client, "intl_billing_postal_code")} name="intl_billing_postal_code" />
          </label>
          <label>
            Billing country
            <input defaultValue={value(client, "intl_billing_country")} name="intl_billing_country" />
          </label>
          <label>
            Billing contact
            <input defaultValue={value(client, "intl_billing_contact")} name="intl_billing_contact" />
          </label>
          <label>
            Billing email
            <input defaultValue={value(client, "intl_billing_email")} name="intl_billing_email" type="email" />
          </label>
          <label>
            Payment terms
            <input defaultValue={value(client, "intl_payment_terms")} name="intl_payment_terms" />
          </label>
          <label className="wide-field">
            Invoice notes
            <textarea defaultValue={value(client, "intl_invoice_notes")} name="intl_invoice_notes" rows={3} />
          </label>
          <label className="wide-field">
            Tax notes
            <textarea defaultValue={value(client, "intl_tax_notes")} name="intl_tax_notes" rows={3} />
          </label>
        </div>
      </section>
    </>
  );
}

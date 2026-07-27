import Link from "next/link";
import {
  flightStatusOptions,
  tripReasonOptions,
  tripStatusOptions,
  type TravelTripWithRelations
} from "@/lib/travel";
import type { Model } from "@/types/database";

type TravelFormProps = {
  action: (formData: FormData) => Promise<void>;
  models: Model[];
  submitLabel: string;
  trip?: TravelTripWithRelations | null;
};

function dateTimeLocal(value: string | null | undefined) {
  return value ? value.slice(0, 16) : "";
}

export function TravelForm({ action, models, submitLabel, trip }: TravelFormProps) {
  const segment = trip?.flight_segments?.[0] ?? null;

  return (
    <form action={action} className="travel-form">
      <section className="aro-glass-card travel-form-section">
        <header>
          <span className="eyebrow">Travel</span>
          <h2>Dados da viagem</h2>
        </header>
        <div className="travel-form-grid">
          <label>
            Modelo
            <select defaultValue={trip?.model_id ?? ""} name="model_id" required>
              <option value="">Selecione</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.stage_name || model.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Título
            <input defaultValue={trip?.title ?? ""} name="title" required />
          </label>
          <label>
            Motivo
            <select defaultValue={trip?.reason ?? "international_season"} name="reason">
              {tripReasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select defaultValue={trip?.status ?? "planned"} name="status">
              {tripStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Data inicial
            <input defaultValue={trip?.starts_on ?? ""} name="starts_on" type="date" />
          </label>
          <label>
            Data final
            <input defaultValue={trip?.ends_on ?? ""} name="ends_on" type="date" />
          </label>
          <label>
            Cidade de origem
            <input defaultValue={trip?.origin_city ?? ""} name="origin_city" />
          </label>
          <label>
            País de origem
            <input defaultValue={trip?.origin_country ?? ""} name="origin_country" />
          </label>
          <label>
            Cidade de destino
            <input defaultValue={trip?.destination_city ?? ""} name="destination_city" />
          </label>
          <label>
            País de destino
            <input defaultValue={trip?.destination_country ?? ""} name="destination_country" />
          </label>
          <label>
            Latitude do destino
            <input
              defaultValue={trip?.destination_latitude ?? ""}
              name="destination_latitude"
              step="0.000001"
              type="number"
            />
          </label>
          <label>
            Longitude do destino
            <input
              defaultValue={trip?.destination_longitude ?? ""}
              name="destination_longitude"
              step="0.000001"
              type="number"
            />
          </label>
          <label>
            Agência
            <input defaultValue={trip?.agency_name ?? ""} name="agency_name" />
          </label>
          <label className="span-2">
            Observações internas
            <textarea defaultValue={trip?.internal_notes ?? ""} name="internal_notes" />
          </label>
        </div>
      </section>

      <section className="aro-glass-card travel-form-section">
        <header>
          <span className="eyebrow">Flight</span>
          <h2>Primeiro trecho de voo</h2>
          <p>Novos trechos adicionais podem ser registrados no detalhe da viagem em uma próxima etapa.</p>
        </header>
        <div className="travel-form-grid">
          <label>
            Companhia aérea
            <input defaultValue={segment?.airline_name ?? ""} name="airline_name" />
          </label>
          <label>
            Código da companhia
            <input defaultValue={segment?.airline_code ?? ""} name="airline_code" />
          </label>
          <label>
            Número do voo
            <input defaultValue={segment?.flight_number ?? ""} name="flight_number" />
          </label>
          <label>
            PNR
            <input defaultValue={segment?.pnr ?? ""} name="pnr" />
          </label>
          <label>
            Número do ticket
            <input defaultValue={segment?.ticket_number ?? ""} name="ticket_number" />
          </label>
          <label>
            Status do voo
            <select defaultValue={segment?.status ?? "planned"} name="flight_status">
              {flightStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Aeroporto de partida
            <input defaultValue={segment?.departure_airport ?? ""} name="departure_airport" />
          </label>
          <label>
            IATA partida
            <input defaultValue={segment?.departure_iata ?? ""} name="departure_iata" />
          </label>
          <label>
            Cidade partida
            <input defaultValue={segment?.departure_city ?? ""} name="departure_city" />
          </label>
          <label>
            País partida
            <input defaultValue={segment?.departure_country ?? ""} name="departure_country" />
          </label>
          <label>
            Data/hora partida
            <input
              defaultValue={dateTimeLocal(segment?.departure_at)}
              name="departure_at"
              type="datetime-local"
            />
          </label>
          <label>
            Timezone partida
            <input defaultValue={segment?.departure_timezone ?? ""} name="departure_timezone" />
          </label>
          <label>
            Terminal partida
            <input defaultValue={segment?.departure_terminal ?? ""} name="departure_terminal" />
          </label>
          <label>
            Portão
            <input defaultValue={segment?.departure_gate ?? ""} name="departure_gate" />
          </label>
          <label>
            Aeroporto de chegada
            <input defaultValue={segment?.arrival_airport ?? ""} name="arrival_airport" />
          </label>
          <label>
            IATA chegada
            <input defaultValue={segment?.arrival_iata ?? ""} name="arrival_iata" />
          </label>
          <label>
            Cidade chegada
            <input defaultValue={segment?.arrival_city ?? ""} name="arrival_city" />
          </label>
          <label>
            País chegada
            <input defaultValue={segment?.arrival_country ?? ""} name="arrival_country" />
          </label>
          <label>
            Data/hora chegada
            <input
              defaultValue={dateTimeLocal(segment?.arrival_at)}
              name="arrival_at"
              type="datetime-local"
            />
          </label>
          <label>
            Timezone chegada
            <input defaultValue={segment?.arrival_timezone ?? ""} name="arrival_timezone" />
          </label>
          <label>
            Terminal chegada
            <input defaultValue={segment?.arrival_terminal ?? ""} name="arrival_terminal" />
          </label>
          <label>
            Assento
            <input defaultValue={segment?.seat ?? ""} name="seat" />
          </label>
          <label>
            Bagagem
            <input defaultValue={segment?.baggage ?? ""} name="baggage" />
          </label>
          <label>
            Classe
            <input defaultValue={segment?.cabin_class ?? ""} name="cabin_class" />
          </label>
          <label>
            URL de check-in
            <input defaultValue={segment?.check_in_url ?? ""} name="check_in_url" type="url" />
          </label>
          <label>
            Custo
            <input defaultValue={segment?.cost_amount ?? ""} name="cost_amount" step="0.01" type="number" />
          </label>
          <label>
            Moeda
            <select defaultValue={segment?.currency ?? "BRL"} name="currency">
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label className="span-2">
            Observações internas do voo
            <textarea defaultValue={segment?.internal_notes ?? ""} name="flight_internal_notes" />
          </label>
        </div>
      </section>

      <div className="actions">
        <button className="button" type="submit">
          {submitLabel}
        </button>
        <Link className="button secondary" href="/admin/travel">
          Cancelar
        </Link>
      </div>

      <style>{`
        .travel-form {
          display: grid;
          gap: 14px;
        }

        .travel-form-section {
          display: grid;
          gap: 16px;
          padding: 18px;
        }

        .travel-form-section h2 {
          margin: 0 0 6px;
          font-size: 22px;
        }

        .travel-form-section p {
          margin: 0;
          color: var(--admin-muted);
        }

        .travel-form-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .travel-form-grid label {
          display: grid;
          gap: 7px;
          color: var(--admin-muted);
          font-size: 12px;
          font-weight: 800;
        }

        .travel-form-grid input,
        .travel-form-grid select,
        .travel-form-grid textarea {
          width: 100%;
          min-height: 42px;
          border: 1px solid var(--admin-border);
          border-radius: 10px;
          background: rgba(2, 18, 50, 0.34);
          color: var(--admin-text);
          padding: 0 11px;
        }

        .travel-form-grid textarea {
          min-height: 110px;
          padding: 11px;
          resize: vertical;
        }

        .travel-form-grid .span-2 {
          grid-column: span 2;
        }

        @media (max-width: 1024px) {
          .travel-form-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .travel-form-grid {
            grid-template-columns: 1fr;
          }

          .travel-form-grid .span-2 {
            grid-column: auto;
          }
        }
      `}</style>
    </form>
  );
}

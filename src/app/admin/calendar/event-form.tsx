/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import {
  currentDateKey,
  dateKeyFromIso
} from "@/lib/calendar";
import {
  jobStatusOptions,
  jobTypeLabel,
  jobTypeOptions,
  modelDisplayName,
  modelInitials,
  type JobWithRelations
} from "@/lib/jobs";
import type {
  Client,
  JobStatus,
  JobType,
  Model,
  ModelCalendarBlock
} from "@/types/database";

type CalendarEventFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  clients: Client[];
  conflicts: ModelCalendarBlock[];
  event?: JobWithRelations;
  initialDate?: string;
  initialModelId?: string;
  initialType?: JobType;
  modelImageUrls: Record<string, string>;
  models: Model[];
  submitLabel: string;
};

function timeInputValue(value: string | null | undefined, fallback = "") {
  if (!value) {
    return fallback;
  }

  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  });
}

function selectedModelIds(event: JobWithRelations | undefined, initialModelId?: string) {
  const ids = new Set(
    event?.job_models.map((jobModel) => jobModel.model_id).filter(Boolean) ?? []
  );

  if (initialModelId) {
    ids.add(initialModelId);
  }

  return ids;
}

function eventDate(event: JobWithRelations | undefined, initialDate?: string) {
  if (event?.start_at) {
    return dateKeyFromIso(event.start_at);
  }

  return initialDate || currentDateKey();
}

export function CalendarEventForm({
  action,
  clients,
  conflicts,
  event,
  initialDate,
  initialModelId,
  initialType,
  modelImageUrls,
  models,
  submitLabel
}: CalendarEventFormProps) {
  const date = eventDate(event, initialDate);
  const selectedIds = selectedModelIds(event, initialModelId);
  const conflictByModel = new Map(
    conflicts
      .filter((block) => block.job_id !== event?.id)
      .map((block) => [block.model_id, block])
  );
  const type = event?.type ?? initialType ?? "job";
  const status: JobStatus = event?.status ?? "booker_review";

  return (
    <form action={action} className="panel form wide-form calendar-event-form">
      <section className="form-section">
        <h3>Dados principais</h3>
        <div className="form-grid">
          <label>
            Título
            <input
              defaultValue={event?.project_name ?? ""}
              name="project_name"
              placeholder="Campanha, casting ou compromisso"
            />
          </label>
          <label>
            Marca
            <input defaultValue={event?.brand_name ?? ""} name="brand_name" />
          </label>
          <label>
            Tipo
            <select defaultValue={type} name="type" required>
              {jobTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select defaultValue={status} name="status" required>
              {jobStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Data
            <input defaultValue={date} name="date" required type="date" />
          </label>
          <label>
            Horário de chegada ou início
            <input
              defaultValue={timeInputValue(event?.call_time ?? event?.start_at, "09:00")}
              name="start_time"
              required
              type="time"
            />
          </label>
          <label>
            Horário de término
            <input defaultValue={timeInputValue(event?.end_at)} name="end_time" type="time" />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h3>Cliente</h3>
        <div className="form-grid">
          <label className="span-2">
            Cliente existente
            <select defaultValue={event?.client_id ?? ""} name="client_id">
              <option value="">Sem cliente vinculado</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company_name}
                </option>
              ))}
            </select>
          </label>
          <p className="notice">
            Para remover o cliente deste evento, selecione “Sem cliente vinculado”.
            A criacao rapida de cliente fica para uma etapa segura do CRM.
          </p>
        </div>
      </section>

      <section className="form-section">
        <h3>Local e contato</h3>
        <div className="form-grid">
          <label>
            Nome do local
            <input defaultValue={event?.location_name ?? ""} name="location_name" />
          </label>
          <label className="span-2">
            Endereço
            <input defaultValue={event?.address_line ?? ""} name="address_line" />
          </label>
          <label>
            Cidade
            <input defaultValue={event?.city ?? ""} name="city" />
          </label>
          <label>
            País
            <input defaultValue={event?.country ?? ""} name="country" />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h3>Modelos vinculados</h3>
        <p className="muted">
          Conflitos consideram bloqueios, trabalhos confirmados, opções e
          solicitações ativas na data selecionada.
        </p>
        <div className="model-card-grid">
          {models.map((model) => {
            const conflict = conflictByModel.get(model.id);
            const name = modelDisplayName(model);

            return (
              <label className="model-card-option" key={model.id}>
                <input
                  className="model-card-checkbox"
                  defaultChecked={selectedIds.has(model.id)}
                  name="model_ids"
                  type="checkbox"
                  value={model.id}
                />
                <span className="model-card-frame">
                  <span className="model-card-check" aria-hidden="true" />
                  {modelImageUrls[model.id] ? (
                    <img alt={name} src={modelImageUrls[model.id]} />
                  ) : (
                    <span className="model-card-placeholder">
                      {modelInitials(model)}
                    </span>
                  )}
                  <span className="model-card-name">
                    <strong>{name}</strong>
                    <small>
                      {conflict
                        ? `Conflito: ${jobTypeLabel(conflict.type)}`
                        : "Disponível na data"}
                    </small>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="form-section">
        <h3>Briefing</h3>
        <div className="form-grid">
          <label className="span-3">
            Briefing geral
            <textarea defaultValue={event?.brief ?? ""} name="brief" />
          </label>
          <label>
            Recomendações
            <textarea
              defaultValue={event?.model_recommendations ?? ""}
              name="model_recommendations"
            />
          </label>
          <label>
            O que levar
            <textarea defaultValue={event?.model_must_bring ?? ""} name="model_must_bring" />
          </label>
          <label>
            Styling
            <textarea defaultValue={event?.styling_notes ?? ""} name="styling_notes" />
          </label>
          <label>
            Beauty
            <textarea defaultValue={event?.beauty_notes ?? ""} name="beauty_notes" />
          </label>
          <label>
            Alimentação
            <textarea defaultValue={event?.food_notes ?? ""} name="food_notes" />
          </label>
          <label>
            Transporte
            <textarea defaultValue={event?.transport_notes ?? ""} name="transport_notes" />
          </label>
          <label className="span-3">
            Observações internas
            <textarea defaultValue={event?.internal_notes ?? ""} name="internal_notes" />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h3>Utilização</h3>
        <div className="form-grid">
          <label>
            Prazo
            <select
              defaultValue={event?.usage_term_months ? String(event.usage_term_months) : ""}
              name="usage_term_months"
            >
              <option value="">Não definido</option>
              <option value="6">6 meses</option>
              <option value="12">12 meses</option>
              <option value="24">24 meses</option>
            </select>
          </label>
          <label>
            Praça
            <select defaultValue={event?.usage_scope ?? ""} name="usage_scope">
              <option value="">Não definida</option>
              <option value="regional">Regional</option>
              <option value="national">Nacional</option>
              <option value="international">Internacional</option>
            </select>
          </label>
          <label>
            Países
            <input
              defaultValue={event?.usage_countries.join(", ") ?? ""}
              name="usage_countries"
            />
          </label>
          <label className="span-3">
            Descrição de uso
            <textarea defaultValue={event?.usage_description ?? ""} name="usage_description" />
          </label>
        </div>
      </section>

      <section className="notice stack">
        <h3>Financeiro futuro</h3>
        <p>Os dados financeiros deste trabalho serão administrados no módulo Financeiro.</p>
        <p>Valores atuais da ARO foram preservados e não há novos campos de comissão nesta etapa.</p>
      </section>

      <div className="actions">
        <button className="button" type="submit">
          {submitLabel}
        </button>
        <Link className="button secondary" href="/admin/calendar">
          Cancelar
        </Link>
      </div>
      <style>{`
        .calendar-event-form {
          max-width: none;
        }

        .form-section {
          border-bottom: 1px solid var(--line);
          display: grid;
          gap: 0.85rem;
          padding-bottom: 1rem;
        }

        .form-section h3,
        .notice h3 {
          margin: 0;
        }

        .form-grid {
          display: grid;
          gap: 0.85rem;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .span-2 {
          grid-column: span 2;
        }

        .span-3 {
          grid-column: span 3;
        }

        .model-card-grid {
          display: grid;
          gap: 0.85rem;
          grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
        }

        .model-card-option {
          border-radius: 8px;
          cursor: pointer;
          display: block;
          min-width: 0;
          position: relative;
        }

        .model-card-checkbox {
          height: 1px;
          left: 0;
          margin: 0;
          min-height: 0;
          opacity: 0;
          padding: 0;
          pointer-events: none;
          position: absolute;
          top: 0;
          width: 1px;
        }

        .model-card-frame {
          aspect-ratio: 2 / 3;
          background:
            linear-gradient(145deg, rgba(8, 38, 87, 0.92), rgba(3, 18, 47, 0.82)),
            radial-gradient(circle at 20% 12%, rgba(134, 200, 255, 0.18), transparent 36%);
          border: 1px solid color-mix(in srgb, #86c8ff 18%, var(--line));
          border-radius: 8px;
          display: block;
          overflow: hidden;
          position: relative;
        }

        .model-card-frame img,
        .model-card-placeholder {
          height: 100%;
          inset: 0;
          position: absolute;
          width: 100%;
        }

        .model-card-frame img {
          object-fit: cover;
        }

        .model-card-check {
          background: rgba(3, 18, 47, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.72);
          border-radius: 6px;
          height: 22px;
          position: absolute;
          right: 12px;
          top: 12px;
          width: 22px;
          z-index: 3;
        }

        .model-card-checkbox:checked + .model-card-frame {
          border-color: #86c8ff;
          box-shadow: 0 0 0 2px rgba(134, 200, 255, 0.28);
        }

        .model-card-checkbox:checked + .model-card-frame .model-card-check {
          background: #86c8ff;
        }

        .model-card-checkbox:checked + .model-card-frame .model-card-check::after {
          color: #05214f;
          content: "✓";
          display: block;
          font-size: 14px;
          font-weight: 800;
          line-height: 20px;
          text-align: center;
        }

        .model-card-placeholder {
          align-items: center;
          background: rgba(255, 255, 255, 0.04);
          color: var(--muted-strong);
          display: flex;
          font-size: 1.8rem;
          font-weight: 800;
          justify-content: center;
        }

        .model-card-name {
          align-items: start;
          background: linear-gradient(to top, rgba(0, 8, 24, 0.78), transparent 70%);
          bottom: 0;
          color: #ffffff;
          display: grid;
          gap: 0.2rem;
          inset-inline: 0;
          min-height: 45%;
          padding: 2.3rem 0.75rem 0.75rem;
          position: absolute;
        }

        .model-card-name strong,
        .model-card-name small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .model-card-name small {
          color: var(--muted-strong);
          font-size: 0.72rem;
        }

        @media (max-width: 780px) {
          .form-grid {
            grid-template-columns: 1fr;
          }

          .span-2,
          .span-3 {
            grid-column: auto;
          }

          .model-card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 360px) {
          .model-card-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </form>
  );
}

import Link from "next/link";
import {
  listAvailableModelsByDate,
  modelDisplayName,
  modelInitials
} from "@/lib/jobs";
import { createModelMainImageUrlsByIds } from "@/lib/models";
import type { JobType } from "@/types/database";
import { createClientJobAction } from "../actions";

type ClientNewJobPageProps = {
  searchParams?: Promise<{
    date?: string;
    error?: string;
    modelId?: string;
    quote?: string;
  }>;
};

const clientJobTypes: { label: string; value: JobType }[] = [
  { label: "Trabalho", value: "job" },
  { label: "Casting", value: "casting" },
  { label: "Ensaio", value: "shoot" },
  { label: "Opção", value: "option" }
];

export default async function ClientNewJobPage({
  searchParams
}: ClientNewJobPageProps) {
  const params = (await searchParams) ?? {};
  const selectedDate = params.date ?? "2026-06-13";
  const availableModels = await listAvailableModelsByDate(selectedDate);
  const modelImageUrls = await createModelMainImageUrlsByIds(
    availableModels.map((model) => model.id)
  );

  return (
    <div className="stack">
      <section className="panel">
        <div className="actions spread">
          <div>
            <span className="eyebrow">Cliente</span>
            <h2>Nova solicitação</h2>
            <p>Escolha uma data, veja modelos disponíveis e envie para revisão.</p>
          </div>
          <Link className="button secondary" href="/client/jobs">
            Voltar
          </Link>
        </div>
      </section>

      {params.error ? <p className="notice error">{params.error}</p> : null}

      <section className="panel">
        <form className="date-filter" method="get">
          <label>
            Data da agenda
            <input defaultValue={selectedDate} name="date" type="date" />
          </label>
          {params.modelId ? (
            <input name="modelId" type="hidden" value={params.modelId} />
          ) : null}
          {params.quote ? <input name="quote" type="hidden" value={params.quote} /> : null}
          <button className="button secondary" type="submit">
            Ver modelos disponíveis
          </button>
        </form>
      </section>

      <form action={createClientJobAction} className="panel form wide-form client-job-form">
        <input name="date" type="hidden" value={selectedDate} />
        <section className="form-section">
          <h3>Dados da solicitação</h3>
          <div className="form-grid">
            <label>
              Tipo
              <select defaultValue="casting" name="type">
                {clientJobTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Horário de chegada
              <input defaultValue="09:00" name="start_time" required type="time" />
            </label>
            <label>
              Horário previsto de término
              <input name="end_time" type="time" />
            </label>
            <label>
              Projeto ou marca
              <input name="project_name" />
            </label>
            <label className="span-2">
              Endereço
              <input name="address_line" />
            </label>
            <label>
              Cidade
              <input name="city" />
            </label>
            <label>
              País
              <input name="country" />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h3>Modelos disponíveis em {selectedDate}</h3>
          <div className="model-card-grid">
            {availableModels.map((model) => (
              <label className="model-card-option" key={model.id}>
                <input
                  className="model-card-checkbox"
                  defaultChecked={model.id === params.modelId}
                  name="model_ids"
                  type="checkbox"
                  value={model.id}
                />
                <span className="model-card-frame">
                  <span className="model-card-check" aria-hidden="true" />
                  {modelImageUrls[model.id] ? (
                    <img
                      alt={modelDisplayName(model)}
                      src={modelImageUrls[model.id]}
                    />
                  ) : (
                    <span className="model-card-placeholder">
                      {modelInitials(model)}
                    </span>
                  )}
                  <span className="model-card-name">
                    {modelDisplayName(model)}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {availableModels.length === 0 ? (
            <p>Nenhum modelo disponível para esta data.</p>
          ) : null}
        </section>

        <section className="form-section">
          <h3>Briefing e utilização</h3>
          <div className="form-grid">
            <label className="span-3">
              Briefing
              <textarea name="brief" required />
            </label>
            <label className="span-3">
              Utilização
              <textarea name="usage_description" />
            </label>
            <label>
              Praça
              <select name="usage_scope">
                <option value="">Não definida</option>
                <option value="regional">Regional</option>
                <option value="national">Nacional</option>
                <option value="international">Internacional</option>
              </select>
            </label>
            <label>
              Tempo de uso
              <select name="usage_term_months">
                <option value="">Não definido</option>
                <option value="6">6 meses</option>
                <option value="12">12 meses</option>
                <option value="24">24 meses</option>
              </select>
            </label>
            <label>
              Países, se internacional
              <input name="usage_countries" />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h3>Valor e orientações</h3>
          <div className="form-grid">
            <label>
              Valor
              <input min="0" name="client_budget" step="0.01" type="number" />
            </label>
            <label className="checkbox-line">
              <input
                defaultChecked={params.quote === "1"}
                name="quote_requested"
                type="checkbox"
              />
              <span>Ainda não tenho valor definido, quero solicitar orçamento</span>
            </label>
            <label>
              Recomendações para o modelo
              <textarea name="model_recommendations" />
            </label>
            <label>
              O que o modelo precisa levar
              <textarea name="model_must_bring" />
            </label>
          </div>
        </section>

        <section className="notice stack">
          <p>A diária considera até 8 horas, contando a partir do horário combinado de chegada do modelo no set.</p>
          <p>Acima de 8 horas, será cobrado adicional de 10% de hora extra sobre o valor do trabalho.</p>
          <p>Transporte e alimentação são responsabilidade do cliente.</p>
          <p>A taxa da agência é de +20% sobre o valor informado.</p>
        </section>

        <div className="actions">
          <button className="button" type="submit">
            Enviar solicitação
          </button>
          <Link className="button secondary" href="/client/jobs">
            Cancelar
          </Link>
        </div>
      </form>

      <style>{`
        .date-filter {
          align-items: end;
          display: flex;
          flex-wrap: wrap;
          gap: 0.8rem;
        }

        .date-filter label {
          color: var(--muted-strong);
          display: grid;
          font-size: 0.78rem;
          font-weight: 800;
          gap: 0.4rem;
        }

        .date-filter input {
          background: rgba(1, 16, 42, 0.36);
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          color: var(--foreground);
          min-height: 2.65rem;
          padding: 0 0.75rem;
        }

        .form-section {
          border-bottom: 1px solid var(--line);
          display: grid;
          gap: 0.85rem;
          padding-bottom: 1rem;
        }

        .form-section h3 {
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

        .checkbox-line {
          align-content: center;
          align-items: center;
          display: flex;
          gap: 0.55rem;
          padding-top: 1.35rem;
        }

        .checkbox-line input {
          min-height: auto;
          width: auto;
        }

        .model-card-grid {
          display: grid;
          gap: 0.85rem;
          grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
        }

        .model-card-option {
          border-radius: var(--radius);
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
          transition:
            border-color 180ms ease,
            box-shadow 180ms ease,
            transform 180ms ease;
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
          background: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.88);
          border-radius: 6px;
          box-shadow: 0 8px 22px rgba(0, 8, 24, 0.26);
          height: 22px;
          position: absolute;
          right: 12px;
          top: 12px;
          width: 22px;
          z-index: 3;
        }

        .model-card-checkbox:checked + .model-card-frame .model-card-check {
          background: #86c8ff;
          border-color: #ffffff;
          box-shadow:
            0 0 0 3px rgba(134, 200, 255, 0.22),
            0 8px 22px rgba(0, 8, 24, 0.28);
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
          font-size: clamp(1.6rem, 5vw, 2.4rem);
          font-weight: 800;
          justify-content: center;
        }

        .model-card-name {
          align-items: end;
          background: linear-gradient(to top, rgba(0, 8, 24, 0.72), transparent 58%);
          bottom: 0;
          color: #ffffff;
          display: flex;
          font-size: 0.95rem;
          font-weight: 800;
          inset-inline: 0;
          min-height: 42%;
          padding: 2.6rem 0.75rem 0.75rem;
          position: absolute;
          text-shadow: 0 1px 12px rgba(0, 0, 0, 0.38);
        }

        .model-card-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .model-card-option:hover .model-card-frame {
          border-color: color-mix(in srgb, #86c8ff 52%, var(--line));
          transform: translateY(-2px);
        }

        .model-card-checkbox:checked + .model-card-frame {
          border-color: #86c8ff;
          box-shadow:
            0 0 0 2px rgba(134, 200, 255, 0.28),
            0 18px 42px rgba(0, 0, 0, 0.24);
        }

        .model-card-checkbox:checked + .model-card-frame::after {
          background: rgba(134, 200, 255, 0.16);
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
        }

        .notice p {
          margin: 0;
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

        @media (max-width: 340px) {
          .model-card-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

import Link from "next/link";
import {
  listAvailableModelsByDate,
  modelDisplayName,
  modelInitials,
  modelLocation,
  modelMeasurements
} from "@/lib/jobs";
import { createModelMainImageUrlsByIds } from "@/lib/models";
import type { JobType } from "@/types/database";
import { createClientJobAction } from "../actions";

type ClientNewJobPageProps = {
  searchParams?: Promise<{
    date?: string;
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
              <input name="project_name" required />
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
          <div className="model-check-grid">
            {availableModels.map((model) => (
              <label className="model-check" key={model.id}>
                <input
                  defaultChecked={model.id === params.modelId}
                  name="model_ids"
                  type="checkbox"
                  value={model.id}
                />
                {modelImageUrls[model.id] ? (
                  <img alt={modelDisplayName(model)} src={modelImageUrls[model.id]} />
                ) : (
                  <span className="model-check-placeholder">
                    {modelInitials(model)}
                  </span>
                )}
                <span className="model-check-copy">
                  <strong>{modelDisplayName(model)}</strong>
                  <small>{modelLocation(model) || "Disponível"}</small>
                  <small>{modelMeasurements(model) || "Medidas não informadas"}</small>
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

        .model-check-grid {
          display: grid;
          gap: 0.65rem;
          grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
        }

        .model-check {
          align-items: center;
          border: 1px solid var(--line);
          border-radius: var(--radius);
          display: flex;
          gap: 0.65rem;
          padding: 0.7rem;
        }

        .model-check input {
          min-height: auto;
          width: auto;
        }

        .model-check img,
        .model-check-placeholder {
          border: 1px solid color-mix(in srgb, #86c8ff 18%, var(--line));
          border-radius: 8px;
          flex: 0 0 auto;
          height: 3.2rem;
          width: 3.2rem;
        }

        .model-check img {
          object-fit: cover;
        }

        .model-check-placeholder {
          align-items: center;
          background: rgba(255, 255, 255, 0.06);
          color: var(--muted-strong);
          display: inline-flex;
          font-size: 0.78rem;
          font-weight: 800;
          justify-content: center;
        }

        .model-check-copy {
          display: grid;
          gap: 0.2rem;
          min-width: 0;
        }

        .model-check small {
          color: var(--muted);
          font-size: 0.74rem;
        }

        .model-check strong,
        .model-check small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
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
        }
      `}</style>
    </div>
  );
}

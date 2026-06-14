import Link from "next/link";
import { listClients } from "@/lib/clients";
import { listModels } from "@/lib/models";
import type { JobType } from "@/types/database";
import { createAdminJobAction } from "../actions";

type NewAdminJobPageProps = {
  searchParams?: Promise<{
    modelId?: string;
    type?: string;
  }>;
};

const jobTypes: { label: string; value: JobType }[] = [
  { label: "Trabalho", value: "job" },
  { label: "Casting", value: "casting" },
  { label: "Ensaio fotográfico", value: "shoot" },
  { label: "Opção", value: "option" },
  { label: "Bloqueio manual de agenda", value: "manual_block" }
];

export default async function NewAdminJobPage({
  searchParams
}: NewAdminJobPageProps) {
  const params = (await searchParams) ?? {};
  const [clients, models] = await Promise.all([listClients(), listModels()]);
  const selectedType = jobTypes.some((type) => type.value === params.type)
    ? params.type
    : "job";

  return (
    <div className="stack">
      <section className="panel">
        <div className="actions spread">
          <div>
            <span className="eyebrow">Agenda + Trabalhos</span>
            <h2>Novo trabalho</h2>
            <p>Crie trabalho, casting, ensaio, opção ou bloqueio de agenda.</p>
          </div>
          <Link className="button secondary" href="/admin/jobs">
            Voltar
          </Link>
        </div>
      </section>

      <form action={createAdminJobAction} className="panel form wide-form job-form">
        <section className="form-section">
          <h3>Dados principais</h3>
          <div className="form-grid">
            <label>
              Tipo
              <select defaultValue={selectedType} name="type" required>
                {jobTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cliente
              <select name="client_id">
                <option value="">Sem cliente definido</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Projeto ou marca
              <input name="project_name" placeholder="Campanha verão" />
            </label>
            <label>
              Marca
              <input name="brand_name" placeholder="Nome da marca" />
            </label>
            <label>
              Data
              <input defaultValue="2026-06-13" name="date" required type="date" />
            </label>
            <label>
              Horário de chegada
              <input defaultValue="09:00" name="start_time" required type="time" />
            </label>
            <label>
              Término previsto
              <input name="end_time" type="time" />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h3>Local</h3>
          <div className="form-grid">
            <label>
              Nome do local
              <input name="location_name" />
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
          <h3>Modelos selecionados</h3>
          <div className="model-check-grid">
            {models.map((model) => (
              <label className="model-check" key={model.id}>
                <input
                  defaultChecked={model.id === params.modelId}
                  name="model_ids"
                  type="checkbox"
                  value={model.id}
                />
                <span>
                  <strong>{model.stage_name || model.display_name}</strong>
                  <small>
                    {[model.current_city, model.current_country]
                      .filter(Boolean)
                      .join(", ") || "Sem praça"}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="form-section">
          <h3>Briefing para o modelo</h3>
          <div className="form-grid">
            <label className="span-3">
              Briefing
              <textarea name="brief" />
            </label>
            <label>
              Recomendações
              <textarea name="model_recommendations" />
            </label>
            <label>
              O que levar
              <textarea name="model_must_bring" />
            </label>
            <label>
              Styling / roupa
              <textarea name="styling_notes" />
            </label>
            <label>
              Beleza / cabelo / maquiagem
              <textarea name="beauty_notes" />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h3>Valores e utilização</h3>
          <div className="form-grid">
            <label>
              Valor
              <input min="0" name="client_budget" step="0.01" type="number" />
            </label>
            <label className="checkbox-line">
              <input name="quote_requested" type="checkbox" />
              <span>Solicitar orçamento</span>
            </label>
            <label>
              Tempo de utilização
              <select name="usage_term_months">
                <option value="">Não definido</option>
                <option value="6">6 meses</option>
                <option value="12">12 meses</option>
                <option value="24">24 meses</option>
              </select>
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
            <label className="span-2">
              Países, se internacional
              <input name="usage_countries" placeholder="Brasil, Portugal, EUA" />
            </label>
            <label className="span-3">
              Utilização em texto livre
              <textarea name="usage_description" />
            </label>
          </div>
          <p className="notice">
            O valor final será calculado com +20% de agência quando houver valor
            informado.
          </p>
        </section>

        <section className="form-section">
          <h3>Operação</h3>
          <div className="form-grid">
            <label>
              Transporte
              <textarea name="transport_notes" />
            </label>
            <label>
              Alimentação
              <textarea name="food_notes" />
            </label>
            <label className="span-3">
              Observações internas
              <textarea name="internal_notes" />
            </label>
          </div>
        </section>

        <div className="actions">
          <button className="button" type="submit">
            Criar trabalho
          </button>
          <Link className="button secondary" href="/admin/jobs">
            Cancelar
          </Link>
        </div>
      </form>

      <style>{`
        .job-form {
          max-width: none;
        }

        .form-section {
          border-bottom: 1px solid var(--line);
          display: grid;
          gap: 0.85rem;
          padding-bottom: 1rem;
        }

        .form-section:last-of-type {
          border-bottom: 0;
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

        .model-check span {
          display: grid;
          gap: 0.2rem;
        }

        .model-check small {
          color: var(--muted);
          font-size: 0.74rem;
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

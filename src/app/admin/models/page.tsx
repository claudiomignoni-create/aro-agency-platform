import Link from "next/link";
import { listModels } from "@/lib/models";
import type { Model, ModelStatus } from "@/types/database";
import { updateModelStatusAction } from "./actions";

type AdminModelsPageProps = {
  searchParams?: Promise<{
    incomplete?: string;
    published?: string;
    q?: string;
    status?: string;
  }>;
};

const statusOptions: Array<{ label: string; value: ModelStatus | "all" }> = [
  { label: "Todos os status", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Pendente", value: "pending_review" },
  { label: "Aprovado", value: "approved" },
  { label: "Arquivado", value: "archived" }
];

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isRecent(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const updatedAt = new Date(value).getTime();
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;

  return Number.isFinite(updatedAt) && Date.now() - updatedAt <= fourteenDays;
}

function isStale(value: string | null | undefined) {
  if (!value) {
    return true;
  }

  const updatedAt = new Date(value).getTime();
  const sixMonths = 180 * 24 * 60 * 60 * 1000;

  return Number.isFinite(updatedAt) && Date.now() - updatedAt > sixMonths;
}

function getModelIndicators(model: Model) {
  const profileIncomplete = [
    model.stage_name ?? model.display_name,
    model.legal_name,
    model.birth_date,
    model.nationality,
    model.current_city ?? model.location
  ].some((value) => !value);

  const measurementsIncomplete = [
    model.height_cm,
    model.bust_cm,
    model.waist_cm,
    model.hips_cm,
    model.shoe_size_br ?? model.shoe_size,
    model.hair_color,
    model.eye_color
  ].some((value) => !value);

  const noEmail = !model.email;
  const mediaStale = isStale(model.last_media_update_at);
  const recentlyUpdated = isRecent(model.updated_at);
  const incomplete = profileIncomplete || noEmail || measurementsIncomplete;

  return {
    incomplete,
    mediaStale,
    measurementsIncomplete,
    noEmail,
    profileIncomplete,
    recentlyUpdated
  };
}

function matchesSearch(model: Model, query: string) {
  if (!query) {
    return true;
  }

  return [
    model.stage_name,
    model.display_name,
    model.legal_name,
    model.email,
    model.current_city,
    model.location,
    model.nationality
  ].some((value) => normalize(value).includes(query));
}

function getLocation(model: Model) {
  return (
    [model.current_city, model.current_country].filter(Boolean).join(", ") ||
    model.location ||
    "-"
  );
}

function getDisplayName(model: Model) {
  return model.stage_name ?? model.display_name ?? model.legal_name ?? "Modelo";
}

function getInitials(model: Model) {
  const initials = getDisplayName(model)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return initials.toUpperCase() || "AR";
}

function formatMeasurements(model: Model) {
  const shoeSize = model.shoe_size_br ?? model.shoe_size;

  return [
    model.height_cm ? `${model.height_cm} cm` : null,
    model.bust_cm ? `Busto ${model.bust_cm}` : null,
    model.waist_cm ? `Cintura ${model.waist_cm}` : null,
    model.hips_cm ? `Quadril ${model.hips_cm}` : null,
    shoeSize ? `Sapato ${shoeSize}` : null
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Sem registro";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

export default async function AdminModelsPage({
  searchParams
}: AdminModelsPageProps) {
  const models = await listModels();
  const filters = (await searchParams) ?? {};
  const query = normalize(filters.q);
  const statusFilter = filters.status ?? "all";
  const publishedFilter = filters.published ?? "all";
  const incompleteFilter = filters.incomplete ?? "all";

  const modelsWithIndicators = models.map((model) => ({
    indicators: getModelIndicators(model),
    model
  }));

  const filteredModels = modelsWithIndicators.filter(({ indicators, model }) => {
    const statusMatches = statusFilter === "all" || model.status === statusFilter;
    const publishedMatches =
      publishedFilter === "all" ||
      (publishedFilter === "published" && model.is_published) ||
      (publishedFilter === "unpublished" && !model.is_published);
    const incompleteMatches =
      incompleteFilter === "all" ||
      (incompleteFilter === "incomplete" && indicators.incomplete) ||
      (incompleteFilter === "complete" && !indicators.incomplete);

    return (
      statusMatches &&
      publishedMatches &&
      incompleteMatches &&
      matchesSearch(model, query)
    );
  });

  const counters = {
    approved: models.filter((model) => model.status === "approved").length,
    archived: models.filter((model) => model.status === "archived").length,
    drafts: models.filter((model) => model.status === "draft").length,
    incomplete: modelsWithIndicators.filter(({ indicators }) => indicators.incomplete)
      .length,
    pending: models.filter((model) => model.status === "pending_review").length,
    total: models.length
  };

  return (
    <div className="models-gallery-shell">
      <section className="models-gallery-header">
        <div>
          <span className="eyebrow">Admin</span>
          <h2>Modelos</h2>
          <p className="muted">
            {filteredModels.length} de {models.length} modelos na visualização atual.
          </p>
        </div>
        <div className="models-gallery-header-actions">
          <details className="models-toolbar-panel">
            <summary className="button secondary">Busca e filtros</summary>
            <form className="models-filter-form" method="get">
              <label>
                Busca
                <input
                  defaultValue={filters.q ?? ""}
                  name="q"
                  placeholder="Nome, e-mail, cidade ou nacionalidade"
                />
              </label>
              <label>
                Status
                <select defaultValue={statusFilter} name="status">
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Publicado
                <select defaultValue={publishedFilter} name="published">
                  <option value="all">Todos</option>
                  <option value="published">Publicado</option>
                  <option value="unpublished">Não publicado</option>
                </select>
              </label>
              <label>
                Cadastro
                <select defaultValue={incompleteFilter} name="incomplete">
                  <option value="all">Todos</option>
                  <option value="incomplete">Incompleto</option>
                  <option value="complete">Completo</option>
                </select>
              </label>
              <div className="models-filter-actions">
                <button className="button" type="submit">
                  Aplicar
                </button>
                <Link className="button secondary" href="/admin/models">
                  Limpar
                </Link>
              </div>
            </form>
          </details>

          <details className="models-toolbar-panel">
            <summary className="button secondary">Resumo</summary>
            <div className="models-summary-chips">
              <span>Total {counters.total}</span>
              <span>Aprovados {counters.approved}</span>
              <span>Pendentes {counters.pending}</span>
              <span>Drafts {counters.drafts}</span>
              <span>Arquivados {counters.archived}</span>
              <span>Incompletos {counters.incomplete}</span>
            </div>
          </details>

          <Link className="button" href="/admin/models/new">
            Criar modelo
          </Link>
        </div>
      </section>

      <section className="models-bulk-actions">
        <label>
          <input aria-label="Selecionar todos os modelos" type="checkbox" /> Selecionar
        </label>
        <button className="button secondary" disabled type="button">
          Solicitar atualização
        </button>
        <button className="button secondary" disabled type="button">
          Exportar seleção
        </button>
        <button className="button secondary" disabled type="button">
          Criar shortlist
        </button>
        <span className="muted">Ações em breve, sem envio real nesta etapa.</span>
      </section>

      <section className="models-gallery-grid" aria-label="Galeria de modelos">
        {filteredModels.map(({ indicators, model }) => (
          <article className="model-gallery-card" key={model.id}>
            <input
              aria-label={`Selecionar ${getDisplayName(model)}`}
              className="model-card-checkbox"
              type="checkbox"
            />

            <Link
              aria-label={`Editar Cadastro360 de ${getDisplayName(model)}`}
              className="model-card-link"
              href={`/admin/models/${model.id}/edit`}
            >
              <div className="model-card-placeholder">
                <span>{getInitials(model)}</span>
              </div>
              <div className="model-card-caption">
                <strong>{getDisplayName(model)}</strong>
                <span>{getLocation(model)}</span>
              </div>
            </Link>

            <details className="model-card-menu">
              <summary aria-label={`Mais informações de ${getDisplayName(model)}`}>
                Mais
              </summary>
              <div className="model-card-menu-panel">
                <dl>
                  <div>
                    <dt>Status</dt>
                    <dd>{model.status}</dd>
                  </div>
                  <div>
                    <dt>Publicado</dt>
                    <dd>{model.is_published ? "Sim" : "Não"}</dd>
                  </div>
                  <div>
                    <dt>Cadastro</dt>
                    <dd>{indicators.incomplete ? "Incompleto" : "Completo"}</dd>
                  </div>
                  <div>
                    <dt>E-mail</dt>
                    <dd>{model.email ?? "Sem e-mail"}</dd>
                  </div>
                  <div>
                    <dt>Medidas</dt>
                    <dd>{formatMeasurements(model) || "Medidas incompletas"}</dd>
                  </div>
                  <div>
                    <dt>Atualização</dt>
                    <dd>{formatDate(model.updated_at)}</dd>
                  </div>
                </dl>
                <div className="model-card-flags">
                  {indicators.profileIncomplete ? <span>Perfil incompleto</span> : null}
                  {indicators.noEmail ? <span>Sem e-mail</span> : null}
                  {indicators.measurementsIncomplete ? (
                    <span>Medidas incompletas</span>
                  ) : null}
                  {indicators.mediaStale ? (
                    <span>
                      {model.last_media_update_at
                        ? "Mídia desatualizada"
                        : "Sem atualização de mídia"}
                    </span>
                  ) : null}
                  {indicators.recentlyUpdated ? <span>Atualizado recentemente</span> : null}
                </div>
                <div className="model-card-menu-actions">
                  <Link
                    className="button secondary"
                    href={`/admin/models/${model.id}/edit`}
                  >
                    Editar
                  </Link>
                  <Link
                    className="button secondary"
                    href={`/admin/models/${model.id}`}
                  >
                    Abrir perfil
                  </Link>
                </div>
                <div className="model-card-status-actions">
                  <form
                    action={updateModelStatusAction.bind(
                      null,
                      model.id,
                      "approved"
                    )}
                  >
                    <button className="button secondary" type="submit">
                      Aprovar
                    </button>
                  </form>
                  <form
                    action={updateModelStatusAction.bind(null, model.id, "draft")}
                  >
                    <button className="button secondary" type="submit">
                      Draft
                    </button>
                  </form>
                  <form
                    action={updateModelStatusAction.bind(
                      null,
                      model.id,
                      "archived"
                    )}
                  >
                    <button className="button secondary" type="submit">
                      Arquivar
                    </button>
                  </form>
                </div>
              </div>
            </details>
          </article>
        ))}
      </section>

      {filteredModels.length === 0 ? (
        <section className="panel">
          <p>Nenhum modelo encontrado com os filtros atuais.</p>
        </section>
      ) : null}

      <style>{`
        .models-gallery-shell {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .models-gallery-header,
        .models-bulk-actions {
          align-items: flex-start;
          background: color-mix(in srgb, var(--panel) 92%, transparent);
          border: 1px solid var(--border);
          border-radius: 8px;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
          padding: 1rem;
        }

        .models-gallery-header h2 {
          font-size: 1.45rem;
          line-height: 1.2;
          margin: 0;
        }

        .models-gallery-header p {
          font-size: 0.875rem;
          line-height: 1.45;
          margin: 0.35rem 0 0;
        }

        .models-gallery-header-actions,
        .models-bulk-actions,
        .models-filter-actions,
        .model-card-menu-actions,
        .model-card-status-actions,
        .model-card-flags,
        .models-summary-chips {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .models-toolbar-panel {
          position: relative;
        }

        .models-toolbar-panel summary {
          list-style: none;
        }

        .models-toolbar-panel summary::-webkit-details-marker,
        .model-card-menu summary::-webkit-details-marker {
          display: none;
        }

        .models-filter-form,
        .models-summary-chips {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          box-shadow: 0 18px 48px rgba(15, 23, 42, 0.14);
          display: grid;
          gap: 0.75rem;
          margin-top: 0.65rem;
          min-width: min(42rem, calc(100vw - 2rem));
          padding: 1rem;
          position: absolute;
          right: 0;
          z-index: 10;
        }

        .models-filter-form {
          grid-template-columns: repeat(4, minmax(8rem, 1fr));
        }

        .models-filter-form label {
          font-size: 0.75rem;
          line-height: 1.35;
        }

        .models-filter-form input,
        .models-filter-form select {
          margin-top: 0.3rem;
        }

        .models-filter-actions {
          grid-column: 1 / -1;
        }

        .models-summary-chips {
          display: flex;
          min-width: min(34rem, calc(100vw - 2rem));
        }

        .models-summary-chips span,
        .model-card-flags span {
          border: 1px solid var(--border);
          border-radius: 999px;
          font-size: 0.72rem;
          line-height: 1;
          padding: 0.35rem 0.55rem;
          white-space: nowrap;
        }

        .models-bulk-actions {
          font-size: 0.75rem;
          padding: 0.75rem 1rem;
        }

        .models-bulk-actions .button {
          font-size: 0.72rem;
          min-height: 2rem;
          padding: 0.35rem 0.65rem;
        }

        .models-gallery-grid {
          display: grid;
          gap: 0.85rem;
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .model-gallery-card {
          aspect-ratio: 2 / 3;
          border-radius: 8px;
          overflow: hidden;
          position: relative;
        }

        .model-card-link {
          color: inherit;
          display: block;
          height: 100%;
          position: relative;
          text-decoration: none;
        }

        .model-card-placeholder {
          align-items: center;
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--panel) 70%, transparent), color-mix(in srgb, var(--muted) 14%, var(--panel))),
            radial-gradient(circle at 20% 10%, color-mix(in srgb, var(--foreground) 16%, transparent), transparent 34%);
          border: 1px solid var(--border);
          border-radius: 8px;
          display: flex;
          height: 100%;
          justify-content: center;
        }

        .model-card-placeholder span {
          align-items: center;
          backdrop-filter: blur(14px);
          background: color-mix(in srgb, var(--panel) 76%, transparent);
          border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
          border-radius: 999px;
          display: inline-flex;
          font-size: clamp(1.6rem, 4vw, 2.6rem);
          font-weight: 800;
          height: 5rem;
          justify-content: center;
          line-height: 1;
          width: 5rem;
        }

        .model-card-caption {
          background: linear-gradient(to top, rgba(0, 0, 0, 0.58), transparent);
          bottom: 0;
          color: #fff;
          display: grid;
          gap: 0.2rem;
          left: 0;
          padding: 3.25rem 0.8rem 0.8rem;
          position: absolute;
          right: 0;
        }

        .model-card-caption strong {
          font-size: 1rem;
          line-height: 1.15;
          overflow-wrap: anywhere;
        }

        .model-card-caption span {
          font-size: 0.875rem;
          line-height: 1.25;
          opacity: 0.9;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .model-card-checkbox {
          left: 0.65rem;
          position: absolute;
          top: 0.65rem;
          z-index: 3;
        }

        .model-card-menu {
          position: absolute;
          right: 0.55rem;
          top: 0.55rem;
          z-index: 4;
        }

        .model-card-menu summary {
          backdrop-filter: blur(16px);
          background: rgba(255, 255, 255, 0.76);
          border: 1px solid rgba(255, 255, 255, 0.58);
          border-radius: 999px;
          color: #111827;
          cursor: pointer;
          font-size: 0.72rem;
          font-weight: 700;
          line-height: 1;
          list-style: none;
          padding: 0.45rem 0.6rem;
          text-transform: uppercase;
        }

        .model-card-menu-panel {
          backdrop-filter: blur(18px);
          background: color-mix(in srgb, var(--panel) 92%, transparent);
          border: 1px solid var(--border);
          border-radius: 8px;
          box-shadow: 0 18px 48px rgba(15, 23, 42, 0.2);
          color: var(--foreground);
          display: grid;
          gap: 0.65rem;
          margin-top: 0.5rem;
          max-height: calc(100vh - 10rem);
          overflow: auto;
          padding: 0.8rem;
          position: absolute;
          right: 0;
          width: min(20rem, calc(100vw - 2rem));
        }

        .model-card-menu-panel dl {
          display: grid;
          gap: 0.5rem;
          margin: 0;
        }

        .model-card-menu-panel dl div {
          display: grid;
          gap: 0.1rem;
        }

        .model-card-menu-panel dt {
          color: var(--muted);
          font-size: 0.68rem;
          line-height: 1.2;
          text-transform: uppercase;
        }

        .model-card-menu-panel dd {
          font-size: 0.78rem;
          line-height: 1.35;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .model-card-menu-actions .button,
        .model-card-status-actions .button {
          font-size: 0.72rem;
          min-height: 2rem;
          padding: 0.35rem 0.6rem;
        }

        @media (max-width: 1180px) {
          .models-gallery-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 820px) {
          .models-gallery-header {
            flex-direction: column;
          }

          .models-gallery-header-actions {
            align-items: flex-start;
            width: 100%;
          }

          .models-filter-form {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            left: 0;
            right: auto;
          }

          .models-gallery-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 520px) {
          .models-gallery-grid {
            gap: 0.7rem;
          }

          .model-card-caption {
            padding: 2.75rem 0.65rem 0.65rem;
          }

          .model-card-caption strong {
            font-size: 0.92rem;
          }

          .model-card-caption span {
            font-size: 0.78rem;
          }

          .models-filter-form {
            grid-template-columns: 1fr;
          }

          .models-bulk-actions .muted {
            flex-basis: 100%;
          }
        }

        @media (max-width: 390px) {
          .models-gallery-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

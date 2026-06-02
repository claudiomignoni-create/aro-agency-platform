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

function getInitials(model: Model) {
  const name = model.stage_name ?? model.display_name ?? model.legal_name ?? "?";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return initials.toUpperCase() || "?";
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
    <div className="stack">
      <section className="panel">
        <div className="actions spread">
          <div>
            <span className="eyebrow">Admin</span>
            <h2>Modelos</h2>
            <p className="muted">
              {filteredModels.length} de {models.length} modelos na visualização atual.
            </p>
          </div>
          <Link className="button" href="/admin/models/new">
            Criar modelo
          </Link>
        </div>
      </section>

      <details className="panel stack">
        <summary className="button secondary">Resumo da lista</summary>
        <section className="grid">
          <div className="mini-panel">
            <span className="eyebrow">Total</span>
            <strong>{counters.total}</strong>
          </div>
          <div className="mini-panel">
            <span className="eyebrow">Aprovados</span>
            <strong>{counters.approved}</strong>
          </div>
          <div className="mini-panel">
            <span className="eyebrow">Pendentes</span>
            <strong>{counters.pending}</strong>
          </div>
          <div className="mini-panel">
            <span className="eyebrow">Drafts</span>
            <strong>{counters.drafts}</strong>
          </div>
          <div className="mini-panel">
            <span className="eyebrow">Arquivados</span>
            <strong>{counters.archived}</strong>
          </div>
          <div className="mini-panel">
            <span className="eyebrow">Incompletos</span>
            <strong>{counters.incomplete}</strong>
          </div>
        </section>
      </details>

      <section className="panel stack">
        <form className="form wide-form" method="get">
          <div className="grid">
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
          </div>
          <div className="actions">
            <button className="button" type="submit">
              Aplicar filtros
            </button>
            <Link className="button secondary" href="/admin/models">
              Limpar
            </Link>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="actions spread">
          <div>
            <span className="eyebrow">Seleção em massa</span>
            <p className="muted">Estrutura visual preparada. Ações reais entram em etapa futura.</p>
          </div>
          <div className="actions">
            <label className="badge">
              <input aria-label="Selecionar todos os modelos" type="checkbox" /> Todos
            </label>
            <button className="button secondary" disabled type="button">
              Solicitar atualização - Em breve
            </button>
            <button className="button secondary" disabled type="button">
              Exportar seleção - Em breve
            </button>
            <button className="button secondary" disabled type="button">
              Criar shortlist interna - Em breve
            </button>
          </div>
        </div>
      </section>

      <section className="grid">
        {filteredModels.map(({ indicators, model }) => (
          <article className="panel stack" key={model.id}>
            <div className="actions spread">
              <div className="mini-panel" aria-label="Foto protegida por placeholder">
                <strong>{getInitials(model)}</strong>
              </div>
              <input
                aria-label={`Selecionar ${model.stage_name ?? model.display_name}`}
                type="checkbox"
              />
            </div>

            <div>
              <h3>{model.stage_name ?? model.display_name}</h3>
              <p className="muted">
                {getLocation(model)}
                {model.nationality ? ` · ${model.nationality}` : ""}
              </p>
            </div>

            <div className="actions">
              <span className="status">{model.status}</span>
              {model.is_published ? <span className="status">Publicado</span> : null}
              {indicators.incomplete ? (
                <span className="badge">Cadastro incompleto</span>
              ) : (
                <span className="status">Completo</span>
              )}
            </div>

            <details className="stack">
              <summary className="button secondary">+ Detalhes</summary>
              <div className="stack">
                <div>
                  <span className="eyebrow">Medidas</span>
                  <p className="muted">{formatMeasurements(model) || "Medidas incompletas"}</p>
                </div>
                <div>
                  <span className="eyebrow">Contato</span>
                  <p className="muted">
                    {model.whatsapp ?? "Sem WhatsApp"} · {model.email ?? "Sem e-mail"}
                  </p>
                </div>
                <div>
                  <span className="eyebrow">Base</span>
                  <p className="muted">{getLocation(model)}</p>
                </div>
                <div className="actions">
                  {indicators.profileIncomplete ? (
                    <span className="badge">Perfil incompleto</span>
                  ) : null}
                  {indicators.noEmail ? <span className="badge">Sem e-mail</span> : null}
                  {indicators.measurementsIncomplete ? (
                    <span className="badge">Medidas incompletas</span>
                  ) : null}
                  {indicators.mediaStale ? (
                    <span className="badge">
                      {model.last_media_update_at
                        ? "Mídia desatualizada"
                        : "Sem atualização de mídia"}
                    </span>
                  ) : null}
                  {indicators.recentlyUpdated ? (
                    <span className="status">Atualizado recentemente</span>
                  ) : null}
                </div>
                <div className="actions">
                  <Link
                    className="button secondary"
                    href={`/admin/models/${model.id}/edit`}
                  >
                    Editar Cadastro360
                  </Link>
                  <button className="button secondary" disabled type="button">
                    Agenda - Em breve
                  </button>
                </div>
                <div className="actions">
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
        {filteredModels.length === 0 ? (
          <p>Nenhum modelo encontrado com os filtros atuais.</p>
        ) : null}
      </section>
    </div>
  );
}

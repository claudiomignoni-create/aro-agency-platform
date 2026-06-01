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

      <section className="grid">
        <div className="panel">
          <span className="eyebrow">Total</span>
          <h2>{counters.total}</h2>
        </div>
        <div className="panel">
          <span className="eyebrow">Aprovados</span>
          <h2>{counters.approved}</h2>
        </div>
        <div className="panel">
          <span className="eyebrow">Pendentes</span>
          <h2>{counters.pending}</h2>
        </div>
        <div className="panel">
          <span className="eyebrow">Drafts</span>
          <h2>{counters.drafts}</h2>
        </div>
        <div className="panel">
          <span className="eyebrow">Arquivados</span>
          <h2>{counters.archived}</h2>
        </div>
        <div className="panel">
          <span className="eyebrow">Incompletos</span>
          <h2>{counters.incomplete}</h2>
        </div>
      </section>

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

      <section className="panel table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>
                <input aria-label="Selecionar todos os modelos" type="checkbox" />
              </th>
              <th>Nome</th>
              <th>Status</th>
              <th>Publicado</th>
              <th>Cadastro</th>
              <th>Atualizações</th>
              <th>Local</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredModels.map(({ indicators, model }) => (
              <tr key={model.id}>
                <td>
                  <input
                    aria-label={`Selecionar ${model.stage_name ?? model.display_name}`}
                    type="checkbox"
                  />
                </td>
                <td>
                  <strong>{model.stage_name ?? model.display_name}</strong>
                  <br />
                  <span className="muted">
                    {model.legal_name ? `${model.legal_name} · ` : ""}
                    {model.email ?? "Sem e-mail"}
                  </span>
                </td>
                <td>
                  <span className="status">{model.status}</span>
                </td>
                <td>{model.is_published ? "Sim" : "Não"}</td>
                <td>
                  <div className="actions">
                    {indicators.profileIncomplete ? (
                      <span className="badge">Perfil incompleto</span>
                    ) : null}
                    {indicators.noEmail ? <span className="badge">Sem e-mail</span> : null}
                    {indicators.measurementsIncomplete ? (
                      <span className="badge">Medidas incompletas</span>
                    ) : null}
                    {!indicators.incomplete ? <span className="status">Completo</span> : null}
                  </div>
                </td>
                <td>
                  <div className="actions">
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
                </td>
                <td>
                  {getLocation(model)}
                  <br />
                  <span className="muted">{model.nationality ?? "-"}</span>
                </td>
                <td>
                  <div className="actions">
                    <Link
                      className="button secondary"
                      href={`/admin/models/${model.id}/edit`}
                    >
                      Editar
                    </Link>
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
                      action={updateModelStatusAction.bind(
                        null,
                        model.id,
                        "draft"
                      )}
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredModels.length === 0 ? (
          <p>Nenhum modelo encontrado com os filtros atuais.</p>
        ) : null}
      </section>
    </div>
  );
}

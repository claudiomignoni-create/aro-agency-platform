/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import {
  AdminEmptyState,
  AdminFilterActions,
  AdminFilterBar,
  AdminPage,
  AdminPageHeader,
  AdminSearchField,
  AdminSection,
  AdminSelectField,
  AdminStatusPill,
  AdminToolbar
} from "@/components/admin/admin-ui";
import { createModelMainImageUrls, listModels } from "@/lib/models";
import type { Model, ModelStatus } from "@/types/database";

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

const publishedOptions = [
  { label: "Todos", value: "all" },
  { label: "Publicado", value: "published" },
  { label: "Não publicado", value: "unpublished" }
];

const incompleteOptions = [
  { label: "Todos", value: "all" },
  { label: "Incompleto", value: "incomplete" },
  { label: "Completo", value: "complete" }
];

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isRecent(value: string | null | undefined) {
  if (!value) return false;
  const updatedAt = new Date(value).getTime();
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  return Number.isFinite(updatedAt) && Date.now() - updatedAt <= fourteenDays;
}

function isStale(value: string | null | undefined) {
  if (!value) return true;
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
  if (!query) return true;

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
  return [model.current_city, model.current_country].filter(Boolean).join(", ") || model.location || "—";
}

function getDisplayName(model: Model) {
  return model.stage_name ?? model.display_name ?? model.legal_name ?? "Modelo";
}

function getInitials(model: Model) {
  return (
    getDisplayName(model)
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "AR"
  );
}

function statusLabel(status: ModelStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function statusTone(status: ModelStatus) {
  if (status === "approved") return "success";
  if (status === "archived") return "danger";
  if (status === "pending_review") return "warning";
  return "neutral";
}

export default async function AdminModelsPage({ searchParams }: AdminModelsPageProps) {
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

    return statusMatches && publishedMatches && incompleteMatches && matchesSearch(model, query);
  });

  const counters = {
    approved: models.filter((model) => model.status === "approved").length,
    archived: models.filter((model) => model.status === "archived").length,
    drafts: models.filter((model) => model.status === "draft").length,
    incomplete: modelsWithIndicators.filter(({ indicators }) => indicators.incomplete).length,
    pending: models.filter((model) => model.status === "pending_review").length,
    total: models.length
  };
  const mainImageUrls = await createModelMainImageUrls(filteredModels.map(({ model }) => model));

  return (
    <AdminPage className="models-admin-page">
      <AdminPageHeader
        actions={<Link className="button" href="/admin/models/new">Criar modelo</Link>}
        description={`${filteredModels.length} de ${models.length} modelos na visualização atual.`}
        eyebrow="Admin"
        title="Modelos"
      />

      <AdminSection className="models-count-section">
        <div className="models-count-strip">
          <AdminStatusPill>Total {counters.total}</AdminStatusPill>
          <AdminStatusPill tone="success">Aprovados {counters.approved}</AdminStatusPill>
          <AdminStatusPill tone="warning">Pendentes {counters.pending}</AdminStatusPill>
          <AdminStatusPill>Drafts {counters.drafts}</AdminStatusPill>
          <AdminStatusPill tone="danger">Arquivados {counters.archived}</AdminStatusPill>
          <AdminStatusPill tone={counters.incomplete ? "warning" : "success"}>
            Incompletos {counters.incomplete}
          </AdminStatusPill>
        </div>
      </AdminSection>

      <AdminToolbar>
        <AdminFilterBar>
          <AdminSearchField
            defaultValue={filters.q}
            placeholder="Nome, e-mail, cidade ou nacionalidade"
          />
          <AdminSelectField
            defaultValue={statusFilter}
            label="Status"
            name="status"
            options={statusOptions.map((option) => ({ label: option.label, value: option.value }))}
          />
          <AdminSelectField
            defaultValue={publishedFilter}
            label="Publicado"
            name="published"
            options={publishedOptions}
          />
          <AdminSelectField
            defaultValue={incompleteFilter}
            label="Cadastro"
            name="incomplete"
            options={incompleteOptions}
          />
          <AdminFilterActions resetHref="/admin/models" />
        </AdminFilterBar>
      </AdminToolbar>

      <AdminSection className="models-planned-section" title="Ações de atualização" meta="Portal do modelo">
        <div className="models-planned-actions">
          <label>
            <input aria-label="Selecionar todos os modelos" type="checkbox" /> Selecionar visualmente
          </label>
          <Link className="button secondary" href="/admin/model-updates/new">Solicitar atualização</Link>
          <Link className="button secondary" href="/admin/model-updates">Histórico de atualizações</Link>
          <Link className="button secondary" href="/model">Visualizar como modelo</Link>
          <button className="button secondary" disabled type="button">Exportar seleção</button>
          <button className="button secondary" disabled type="button">Criar shortlist</button>
        </div>
      </AdminSection>

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
              {mainImageUrls[model.id] ? (
                <img alt={getDisplayName(model)} className="model-card-image" src={mainImageUrls[model.id]} />
              ) : (
                <div className="model-card-placeholder">
                  <span>{getInitials(model)}</span>
                </div>
              )}
              <div className="model-card-caption">
                <strong>{getDisplayName(model)}</strong>
                <span>{getLocation(model)}</span>
                <div className="model-card-badges">
                  <AdminStatusPill tone={statusTone(model.status)}>{statusLabel(model.status)}</AdminStatusPill>
                  {indicators.incomplete ? <AdminStatusPill tone="warning">Incompleto</AdminStatusPill> : null}
                  {indicators.recentlyUpdated ? <AdminStatusPill tone="success">Atualizado</AdminStatusPill> : null}
                </div>
              </div>
            </Link>
          </article>
        ))}
      </section>

      {filteredModels.length === 0 ? (
        <AdminEmptyState
          description="Ajuste os filtros ou cadastre um novo modelo para continuar."
          title="Nenhum modelo encontrado."
        />
      ) : null}

      <style>{`
        .models-count-section {
          padding: 9px 10px;
        }

        .models-count-strip,
        .models-planned-actions,
        .model-card-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          align-items: center;
        }

        .models-planned-section {
          padding: 10px;
        }

        .models-planned-actions label {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--admin-muted);
          font-size: var(--admin-font-label);
          font-weight: 800;
        }

        .models-gallery-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          min-width: 0;
        }

        .model-gallery-card {
          aspect-ratio: 2 / 3;
          overflow: hidden;
          position: relative;
          border: 1px solid rgba(153, 202, 255, 0.18);
          border-radius: 10px;
          background: rgba(2, 18, 50, 0.38);
        }

        .model-card-link {
          display: block;
          height: 100%;
          color: inherit;
          text-decoration: none;
        }

        .model-card-placeholder {
          display: flex;
          height: 100%;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(circle at 30% 18%, rgba(105, 180, 255, 0.22), transparent 36%),
            linear-gradient(145deg, rgba(8, 38, 87, 0.76), rgba(3, 18, 47, 0.92));
        }

        .model-card-placeholder span {
          display: inline-flex;
          width: 4.2rem;
          height: 4.2rem;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--admin-border);
          border-radius: 999px;
          background: rgba(2, 18, 50, 0.42);
          font-size: 1.5rem;
          font-weight: 800;
          backdrop-filter: blur(14px);
        }

        .model-card-image {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .model-card-caption {
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          display: grid;
          gap: 5px;
          padding: 3rem 10px 10px;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.72), transparent);
          color: #fff;
        }

        .model-card-caption strong {
          overflow-wrap: anywhere;
          font-size: 13px;
          line-height: 1.15;
        }

        .model-card-caption span {
          overflow: hidden;
          color: rgba(255, 255, 255, 0.82);
          font-size: 11px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .model-card-badges .admin-status-pill {
          border-color: rgba(255, 255, 255, 0.26);
          background: rgba(2, 18, 50, 0.24);
          color: rgba(255, 255, 255, 0.88);
        }

        .model-card-checkbox {
          position: absolute;
          top: 8px;
          left: 8px;
          z-index: 3;
          width: 16px;
          height: 16px;
        }

        @media (max-width: 1180px) {
          .models-gallery-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .models-gallery-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 390px) {
          .models-gallery-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AdminPage>
  );
}

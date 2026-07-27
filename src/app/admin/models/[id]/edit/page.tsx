import { notFound } from "next/navigation";
import Link from "next/link";
import { currentDateKey, dateKeyFromIso, formatDatePtBr } from "@/lib/calendar";
import { jobTypeLabel, listModelCalendar } from "@/lib/jobs";
import { createModelMainImageUrls, getModelProfile } from "@/lib/models";
import type { Model } from "@/types/database";
import {
  ModelProfileEditor,
  type ModelProfileTab
} from "../../model-form";
import {
  archiveModelAction,
  deleteModelAction,
  updateModelStatusAction
} from "../../actions";

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

function locationLabel(model: Model) {
  return (
    [model.current_city, model.current_country].filter(Boolean).join(", ") ||
    model.location ||
    "-"
  );
}

function valueOrDash(value: string | number | null | undefined, suffix = "") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return `${value}${suffix}`;
}

function modelCategories(model: Model) {
  return Array.isArray(model.categories) ? model.categories : [];
}

const modelProfileTabIds: ModelProfileTab[] = [
  "basic",
  "documents",
  "media",
  "skills",
  "work",
  "health",
  "representation",
  "international",
  "internal",
  "history"
];

function isModelProfileTab(tab: string): tab is ModelProfileTab {
  return modelProfileTabIds.includes(tab as ModelProfileTab);
}

type EditModelPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    saved?: string;
    tab?: string;
  }>;
};

export default async function EditModelPage({
  params,
  searchParams
}: EditModelPageProps) {
  const { id } = await params;
  const { saved, tab } = (await searchParams) ?? {};
  const activeTab: ModelProfileTab =
    tab && isModelProfileTab(tab) ? tab : "basic";
  const profile = await getModelProfile(id);
  const calendarBlocks = await listModelCalendar(id);

  if (!profile) {
    notFound();
  }

  const model = profile.model;
  const modelName = getDisplayName(model);
  const mainImageUrls = await createModelMainImageUrls([model]);
  const mainImageUrl = mainImageUrls[model.id];
  const categories = modelCategories(model);
  const heroFactRows = [
    [
      { label: "Status", value: model.status },
      { label: "Base atual", value: locationLabel(model) },
      { label: "Nacionalidade", value: valueOrDash(model.nationality) }
    ],
    [
      { label: "Altura", value: valueOrDash(model.height_cm, " cm") },
      { label: "Busto", value: valueOrDash(model.bust_cm, " cm") },
      { label: "Cintura", value: valueOrDash(model.waist_cm, " cm") },
      { label: "Quadril", value: valueOrDash(model.hips_cm, " cm") },
      {
        label: "Sapato",
        value: valueOrDash(model.shoe_size_br ?? model.shoe_size)
      },
      {
        label: "Categorias",
        value: categories.length ? categories.join(", ") : "-"
      }
    ]
  ];
  const quickLinks = [
    { href: `/admin/models/${model.id}/edit?tab=media`, label: "Ver mídia" },
    {
      href: `/admin/models/${model.id}/edit?tab=basic`,
      label: "Editar informações"
    },
    { href: `/admin/models/${model.id}/edit?tab=history`, label: "Histórico" },
    { href: "/admin/models", label: "Voltar para modelos" }
  ];
  const agendaActions = [
    [
      "Criar trabalho para este modelo",
      `/admin/calendar/new?modelId=${model.id}&type=job`
    ],
    ["Criar casting", `/admin/calendar/new?modelId=${model.id}&type=casting`],
    ["Criar ensaio", `/admin/calendar/new?modelId=${model.id}&type=shoot`],
    ["Colocar em opção", `/admin/calendar/new?modelId=${model.id}&type=option`],
    ["Bloquear agenda", `/admin/calendar/new?modelId=${model.id}&type=manual_block`]
  ] as const;
  const today = currentDateKey();
  const upcomingAgenda = calendarBlocks
    .filter((block) => dateKeyFromIso(block.start_at) >= today)
    .slice(0, 5);

  return (
    <div className="stack">
      {saved ? <p className="toast">Alteração salva com sucesso.</p> : null}
      <section className="model-profile-hero">
        <div className="model-profile-photo">
          {mainImageUrl ? (
            <img alt={modelName} src={mainImageUrl} />
          ) : (
            <div className="model-profile-photo-placeholder">
              <span>{getInitials(model)}</span>
            </div>
          )}
        </div>
        <div className="model-profile-summary">
          <div>
            <span className="eyebrow">Cadastro360</span>
            <h2>{modelName}</h2>
            {model.legal_name ? <p>{model.legal_name}</p> : null}
          </div>

          <div className="model-profile-facts">
            {heroFactRows.map((row, index) => (
              <div
                className={`model-profile-fact-row row-${index + 1}`}
                key={index}
              >
                {row.map((fact) => (
                  <div className="model-profile-fact" key={fact.label}>
                    <span>{fact.label}</span>
                    <strong>{fact.value}</strong>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="model-profile-links">
            {quickLinks.map((link) => (
              <Link className="button secondary" href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </div>

          <div className="model-profile-admin-actions">
            <form action={updateModelStatusAction.bind(null, model.id, "approved")}>
              <button className="button secondary" type="submit">
                Aprovar
              </button>
            </form>
            <form action={updateModelStatusAction.bind(null, model.id, "draft")}>
              <button className="button secondary" type="submit">
                Marcar draft
              </button>
            </form>
            <form action={archiveModelAction.bind(null, model.id)}>
              <button className="button secondary" type="submit">
                Arquivar
              </button>
            </form>
            <form action={deleteModelAction.bind(null, model.id)}>
              <button className="button danger" type="submit">
                Excluir
              </button>
            </form>
          </div>
        </div>
      </section>
      <section className="model-agenda-panel">
        <div className="model-agenda-copy">
          <span className="eyebrow">Agenda</span>
          <h3>Agenda do modelo</h3>
          <p>Próximas atividades, histórico resumido e ações rápidas.</p>
          <div className="model-profile-links">
            {agendaActions.map(([label, href]) => (
              <Link className="button secondary" href={href} key={href}>
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="model-agenda-list">
          {upcomingAgenda.map((block) => (
            <div className="model-agenda-row" key={block.id}>
              <div>
                <strong>{jobTypeLabel(block.type)}</strong>
                <span>{formatDatePtBr(dateKeyFromIso(block.start_at))}</span>
              </div>
              <span className="status">{block.status}</span>
            </div>
          ))}
          {upcomingAgenda.length === 0 ? (
            <p>Nenhuma atividade futura na agenda.</p>
          ) : null}
          <p className="model-agenda-history">
            Histórico resumido: {calendarBlocks.length} atividade(s) registradas.
          </p>
        </div>
      </section>
      <ModelProfileEditor activeTab={activeTab} profile={profile} />
      <style>{`
        .model-agenda-panel {
          background:
            linear-gradient(180deg, rgba(10, 30, 55, 0.88), rgba(13, 38, 68, 0.72)),
            color-mix(in srgb, #102a4a 86%, var(--panel));
          border: 1px solid color-mix(in srgb, #6eb6ff 20%, transparent);
          border-radius: 8px;
          display: grid;
          gap: 1rem;
          grid-template-columns: minmax(0, 0.9fr) minmax(18rem, 1fr);
          padding: 1rem;
        }

        .model-agenda-copy,
        .model-agenda-list {
          min-width: 0;
        }

        .model-agenda-list {
          display: grid;
          gap: 0.55rem;
        }

        .model-agenda-row {
          align-items: center;
          border: 1px solid color-mix(in srgb, #86c8ff 16%, var(--line));
          border-radius: 8px;
          display: flex;
          gap: 0.75rem;
          justify-content: space-between;
          padding: 0.7rem;
        }

        .model-agenda-row div {
          display: grid;
          gap: 0.2rem;
        }

        .model-agenda-row span:not(.status),
        .model-agenda-history {
          color: var(--muted);
          font-size: 0.82rem;
        }

        .model-profile-hero {
          align-items: stretch;
          background:
            linear-gradient(180deg, rgba(10, 30, 55, 0.88), rgba(13, 38, 68, 0.72)),
            color-mix(in srgb, #102a4a 86%, var(--panel));
          border: 1px solid color-mix(in srgb, #6eb6ff 20%, transparent);
          border-radius: 8px;
          display: grid;
          gap: 1rem;
          grid-template-columns: minmax(11rem, 18rem) 1fr;
          max-width: 100%;
          overflow: hidden;
          padding: 1rem;
        }

        .model-profile-photo {
          aspect-ratio: 2 / 3;
          border-radius: 8px;
          min-height: 20rem;
          overflow: hidden;
          position: relative;
        }

        .model-profile-photo img,
        .model-profile-photo-placeholder {
          border: 1px solid color-mix(in srgb, #86c8ff 18%, var(--line));
          border-radius: 8px;
          height: 100%;
          width: 100%;
        }

        .model-profile-photo img {
          display: block;
          object-fit: cover;
        }

        .model-profile-photo-placeholder {
          align-items: center;
          background: color-mix(in srgb, var(--muted) 12%, var(--panel));
          display: flex;
          justify-content: center;
        }

        .model-profile-photo-placeholder span {
          align-items: center;
          backdrop-filter: blur(14px);
          background: color-mix(in srgb, var(--panel) 76%, transparent);
          border: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
          border-radius: 999px;
          display: inline-flex;
          font-size: clamp(1.8rem, 4vw, 3rem);
          font-weight: 800;
          height: 5.5rem;
          justify-content: center;
          line-height: 1;
          width: 5.5rem;
        }

        .model-profile-summary {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          justify-content: center;
          min-width: 0;
          padding: 0.35rem 0.25rem;
        }

        .model-profile-summary h2 {
          font-size: clamp(2rem, 4vw, 4rem);
          letter-spacing: 0;
          line-height: 0.98;
          margin: 0.15rem 0 0;
        }

        .model-profile-summary p {
          color: var(--muted);
          font-size: 0.95rem;
          margin: 0.35rem 0 0;
        }

        .model-profile-links,
        .model-profile-admin-actions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .model-profile-facts {
          display: grid;
          gap: 0.55rem;
          min-width: 0;
        }

        .model-profile-fact-row {
          display: grid;
          gap: 0.55rem;
        }

        .model-profile-fact-row.row-1 {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .model-profile-fact-row.row-2 {
          grid-template-columns: repeat(6, minmax(0, 1fr));
        }

        .model-profile-fact {
          border: 1px solid color-mix(in srgb, #86c8ff 16%, var(--line));
          border-radius: 8px;
          min-height: 4.15rem;
          min-width: 0;
          padding: 0.65rem 0.7rem;
        }

        .model-profile-fact span {
          color: var(--muted);
          display: block;
          font-size: 0.67rem;
          letter-spacing: 0;
          line-height: 1;
          margin-bottom: 0.38rem;
          text-transform: uppercase;
        }

        .model-profile-fact strong {
          border: 1px solid var(--line);
          border-color: transparent;
          color: var(--foreground);
          display: block;
          font-size: 0.88rem;
          font-weight: 700;
          line-height: 1.2;
        }

        .model-profile-links .button,
        .model-profile-admin-actions .button {
          font-size: 0.76rem;
          min-height: 2.1rem;
          padding: 0.38rem 0.7rem;
        }

        .model-profile-admin-actions {
          border-top: 1px solid color-mix(in srgb, #86c8ff 16%, var(--line));
          padding-top: 0.85rem;
        }

        @media (max-width: 760px) {
          .model-agenda-panel,
          .model-profile-hero {
            grid-template-columns: 1fr;
          }

          .model-profile-photo {
            max-width: 18rem;
            min-height: auto;
            width: 100%;
          }

          .model-profile-summary h2 {
            font-size: 2.2rem;
          }

          .model-profile-fact-row.row-1,
          .model-profile-fact-row.row-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 430px) {
          .model-profile-hero {
            padding: 0.75rem;
          }

          .model-profile-photo {
            max-width: min(100%, 14rem);
          }

          .model-profile-summary h2 {
            font-size: 1.9rem;
          }

          .model-profile-fact-row.row-1,
          .model-profile-fact-row.row-2 {
            grid-template-columns: 1fr;
          }

          .model-profile-links,
          .model-profile-admin-actions {
            align-items: stretch;
            flex-direction: column;
          }

          .model-profile-admin-actions form {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

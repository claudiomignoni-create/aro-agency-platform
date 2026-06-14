import Link from "next/link";
import { notFound } from "next/navigation";
import {
  dateKeyFromIso,
  formatDatePtBr,
  generateMonthDays,
  monthTitlePtBr
} from "@/lib/calendar";
import {
  listClientVisibleModelCalendar,
  publicAvailabilityStatus
} from "@/lib/jobs";
import { listClientModelProfiles } from "@/lib/models";

type ClientModelDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ClientModelDetailPage({
  params
}: ClientModelDetailPageProps) {
  const { id } = await params;
  const [models, blocks] = await Promise.all([
    listClientModelProfiles(),
    listClientVisibleModelCalendar(id)
  ]);
  const model = models.find((item) => item.id === id);

  if (!model) {
    notFound();
  }

  const days = generateMonthDays("2026-06-13");
  const upcoming = blocks
    .filter((block) => dateKeyFromIso(block.start_at) >= "2026-06-13")
    .slice(0, 6);

  return (
    <div className="stack">
      <section className="panel model-public-hero">
        <div>
          <span className="eyebrow">Modelo</span>
          <h2>{model.stage_name}</h2>
          <p>
            {[model.current_city, model.current_country].filter(Boolean).join(", ") ||
              "Praça não informada"}
          </p>
        </div>
        <div className="actions">
          <Link
            className="button"
            href={`/client/jobs/new?modelId=${model.id}&date=2026-06-13`}
          >
            Solicitar trabalho
          </Link>
          <Link
            className="button secondary"
            href={`/client/jobs/new?modelId=${model.id}&quote=1&date=2026-06-13`}
          >
            Solicitar orçamento
          </Link>
        </div>
      </section>

      <section className="grid">
        <article className="panel stack">
          <span className="eyebrow">Dados básicos</span>
          <div className="compact-list">
            <span>{model.model_type ?? "Modelo"}</span>
            <span>{model.categories.join(", ") || "Sem categoria"}</span>
            <span>
              {[model.base_city, model.base_country].filter(Boolean).join(", ") ||
                "Base não informada"}
            </span>
          </div>
        </article>
        <article className="panel stack">
          <span className="eyebrow">Medidas principais</span>
          <div className="compact-list">
            <span>{model.height_cm ? `${model.height_cm} cm` : "-"}</span>
            <span>
              {[model.bust_cm, model.waist_cm, model.hips_cm]
                .filter(Boolean)
                .join(" / ") || "-"}
            </span>
            <span>{model.shoe_size_br ? `BR ${model.shoe_size_br}` : "-"}</span>
          </div>
        </article>
      </section>

      <section className="panel stack">
        <div>
          <span className="eyebrow">Calendário</span>
          <h3>{monthTitlePtBr("2026-06-13")}</h3>
        </div>
        <div className="calendar-grid">
          {days.map((day) => (
            <div
              className={`calendar-day${day.isCurrentMonth ? "" : " muted-day"}${
                day.isToday ? " today" : ""
              }`}
              key={day.date}
            >
              <span>{day.dayOfMonth}</span>
              <small>{publicAvailabilityStatus(blocks, day.date)}</small>
            </div>
          ))}
        </div>
        <div className="calendar-list">
          {days
            .filter((day) => day.isCurrentMonth)
            .map((day) => (
              <div className="calendar-list-row" key={day.date}>
                <strong>{formatDatePtBr(day.date)}</strong>
                <span>{publicAvailabilityStatus(blocks, day.date)}</span>
              </div>
            ))}
        </div>
      </section>

      <section className="panel stack">
        <span className="eyebrow">Últimas atividades públicas da agenda</span>
        {upcoming.map((block) => (
          <div className="activity-row" key={block.id}>
            <strong>{formatDatePtBr(dateKeyFromIso(block.start_at))}</strong>
            <span>{block.title}</span>
          </div>
        ))}
        {upcoming.length === 0 ? <p>Nenhuma atividade pública futura.</p> : null}
      </section>

      <style>{`
        .model-public-hero {
          align-items: center;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
        }

        .calendar-grid {
          display: grid;
          gap: 0.45rem;
          grid-template-columns: repeat(7, minmax(0, 1fr));
        }

        .calendar-day {
          background: rgba(1, 16, 42, 0.32);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          display: grid;
          min-height: 5.2rem;
          padding: 0.55rem;
        }

        .calendar-day span {
          font-weight: 800;
        }

        .calendar-day small {
          align-self: end;
          color: var(--muted-strong);
          font-size: 0.68rem;
        }

        .muted-day {
          opacity: 0.42;
        }

        .today {
          border-color: rgba(255, 255, 255, 0.72);
        }

        .calendar-list {
          display: none;
        }

        .calendar-list-row,
        .activity-row {
          align-items: center;
          border: 1px solid var(--line);
          border-radius: var(--radius);
          display: flex;
          gap: 0.75rem;
          justify-content: space-between;
          padding: 0.75rem;
        }

        @media (max-width: 760px) {
          .model-public-hero {
            align-items: stretch;
            flex-direction: column;
          }

          .calendar-grid {
            display: none;
          }

          .calendar-list {
            display: grid;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}

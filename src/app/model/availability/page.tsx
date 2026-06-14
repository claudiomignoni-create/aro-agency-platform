import {
  dateKeyFromIso,
  formatDatePtBr,
  generateMonthDays,
  monthTitlePtBr
} from "@/lib/calendar";
import {
  jobTitle,
  jobTypeLabel,
  listCurrentModelAssignments,
  listCurrentModelCalendar
} from "@/lib/jobs";
import {
  acceptModelJobAction,
  declineModelJobAction
} from "./actions";

export default async function ModelAvailabilityPage() {
  const [blocks, assignments] = await Promise.all([
    listCurrentModelCalendar(),
    listCurrentModelAssignments()
  ]);
  const days = generateMonthDays("2026-06-13");
  const upcomingBlocks = blocks
    .filter((block) => dateKeyFromIso(block.start_at) >= "2026-06-13")
    .slice(0, 8);
  const openOptions = assignments.filter((item) => item.status === "option");
  const castings = assignments.filter((item) => item.job?.type === "casting");
  const confirmed = assignments.filter((item) => item.status === "confirmed");
  const shoots = assignments.filter((item) => item.job?.type === "shoot");
  const waitingAgency = assignments.filter(
    (item) => item.job?.status === "booker_review"
  );

  return (
    <div className="stack">
      <section className="panel">
        <span className="eyebrow">Modelo</span>
        <h2>Agenda</h2>
        <p>Solicitações, opções, castings, ensaios e trabalhos confirmados.</p>
      </section>

      <section className="grid stats-grid">
        <article className="mini-panel">
          <span className="eyebrow">Opções em aberto</span>
          <strong>{openOptions.length}</strong>
        </article>
        <article className="mini-panel">
          <span className="eyebrow">Castings</span>
          <strong>{castings.length}</strong>
        </article>
        <article className="mini-panel">
          <span className="eyebrow">Confirmados</span>
          <strong>{confirmed.length}</strong>
        </article>
        <article className="mini-panel">
          <span className="eyebrow">Ensaios</span>
          <strong>{shoots.length}</strong>
        </article>
      </section>

      <section className="panel stack">
        <div>
          <span className="eyebrow">Calendário mensal</span>
          <h3>{monthTitlePtBr("2026-06-13")}</h3>
        </div>
        <div className="calendar-grid">
          {days.map((day) => {
            const dayBlocks = blocks.filter(
              (block) => dateKeyFromIso(block.start_at) === day.date
            );

            return (
              <div
                className={`calendar-day${day.isCurrentMonth ? "" : " muted-day"}${
                  day.isToday ? " today" : ""
                }`}
                key={day.date}
              >
                <span>{day.dayOfMonth}</span>
                {dayBlocks.slice(0, 2).map((block) => (
                  <small key={block.id}>{jobTypeLabel(block.type)}</small>
                ))}
              </div>
            );
          })}
        </div>
        <div className="calendar-list">
          {upcomingBlocks.map((block) => (
            <div className="calendar-list-row" key={block.id}>
              <strong>{formatDatePtBr(dateKeyFromIso(block.start_at))}</strong>
              <span>{jobTypeLabel(block.type)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <span className="eyebrow">Próximos compromissos</span>
        {assignments.map((assignment) => {
          const job = assignment.job;

          if (!job) {
            return null;
          }

          const canRespond =
            assignment.status === "waiting_model" &&
            assignment.model_response_status === "waiting";

          return (
            <article className="agenda-row" key={assignment.id}>
              <div>
                <strong>{jobTitle(job)}</strong>
                <p>
                  {formatDatePtBr(dateKeyFromIso(job.start_at))} ·{" "}
                  {jobTypeLabel(job.type)} · {assignment.status}
                </p>
                {job.status === "booker_review" ? (
                  <p>Solicitação em revisão pela agência.</p>
                ) : null}
              </div>
              {canRespond ? (
                <div className="actions">
                  <form action={acceptModelJobAction.bind(null, assignment.id)}>
                    <button className="button" type="submit">
                      Aceitar
                    </button>
                  </form>
                  <form action={declineModelJobAction.bind(null, assignment.id)}>
                    <button className="button secondary" type="submit">
                      Recusar
                    </button>
                  </form>
                </div>
              ) : (
                <span className="status">{assignment.model_response_status}</span>
              )}
            </article>
          );
        })}
        {assignments.length === 0 ? <p>Nenhuma atividade vinculada à agenda.</p> : null}
      </section>

      <section className="panel stack">
        <span className="eyebrow">Solicitações aguardando liberação da agência</span>
        {waitingAgency.map((assignment) => (
          <div className="agenda-row" key={assignment.id}>
            <strong>{assignment.job ? jobTitle(assignment.job) : "Solicitação"}</strong>
            <span>Solicitação em revisão pela agência.</span>
          </div>
        ))}
        {waitingAgency.length === 0 ? <p>Nenhuma solicitação aguardando liberação.</p> : null}
      </section>

      <style>{`
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
          gap: 0.3rem;
          min-height: 5.2rem;
          padding: 0.55rem;
        }

        .calendar-day span {
          font-weight: 800;
        }

        .calendar-day small {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid var(--line);
          border-radius: 999px;
          color: var(--muted-strong);
          font-size: 0.65rem;
          padding: 0.15rem 0.35rem;
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
        .agenda-row {
          align-items: center;
          border: 1px solid var(--line);
          border-radius: var(--radius);
          display: flex;
          gap: 0.75rem;
          justify-content: space-between;
          padding: 0.75rem;
        }

        .agenda-row p {
          margin: 0.25rem 0 0;
        }

        @media (max-width: 760px) {
          .calendar-grid {
            display: none;
          }

          .calendar-list {
            display: grid;
            gap: 0.5rem;
          }

          .agenda-row {
            align-items: stretch;
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

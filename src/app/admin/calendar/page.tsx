/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  addDays,
  addMonths,
  currentDateKey,
  dateKeyFromIso,
  formatDatePtBr,
  generateMonthDays,
  isValidDateKey,
  monthStartDateKey,
  monthTitlePtBr,
  safeDateKey
} from "@/lib/calendar";
import { listClientOptions } from "@/lib/clients";
import {
  jobModelStatusLabel,
  jobStatusLabel,
  jobStatusOptions,
  jobTitle,
  jobTypeLabel,
  jobTypeOptions,
  listAdminJobs,
  modelDisplayName,
  modelInitials,
  type JobWithRelations
} from "@/lib/jobs";
import { createModelMainImageUrls, listModels } from "@/lib/models";

type AdminCalendarPageProps = {
  searchParams?: Promise<{
    client?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    model?: string;
    navMonth?: string;
    navYear?: string;
    q?: string;
    status?: string;
    type?: string;
    view?: string;
  }>;
};

const views = ["month", "week", "list"] as const;
const monthOptions = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
] as const;

function selectedView(value: string | undefined) {
  return views.includes(value as (typeof views)[number])
    ? (value as (typeof views)[number])
    : "month";
}

function hrefWith(
  filters: Awaited<NonNullable<AdminCalendarPageProps["searchParams"]>>,
  updates: Record<string, string | undefined>
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries({ ...filters, ...updates })) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return `/admin/calendar${query ? `?${query}` : ""}`;
}

function hrefWithAnchorDate(
  filters: Awaited<NonNullable<AdminCalendarPageProps["searchParams"]>>,
  date: string,
  view: (typeof views)[number]
) {
  return hrefWith(filters, {
    date,
    dateFrom: undefined,
    dateTo: undefined,
    navMonth: undefined,
    navYear: undefined,
    view
  });
}

function monthDateKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function isValidPickerYear(year: number) {
  return Number.isInteger(year) && year >= 2000 && year <= 2100;
}

function selectedPickerMonth(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
}

function monthRange(dateKey: string) {
  const monthKey = dateKey.slice(0, 7);
  const start = monthStartDateKey(monthKey);
  const end = addDays(monthStartDateKey(addMonths(monthKey, 1)), -1);

  return { end, start };
}

function filterCount(filters: Awaited<NonNullable<AdminCalendarPageProps["searchParams"]>>) {
  return [
    filters.q,
    filters.client,
    filters.model,
    filters.type,
    filters.status,
    filters.dateFrom,
    filters.dateTo
  ].filter(Boolean).length;
}

function eventDate(job: JobWithRelations) {
  return dateKeyFromIso(job.start_at);
}

function eventTime(job: JobWithRelations) {
  return new Date(job.call_time ?? job.start_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  });
}

export default async function AdminCalendarPage({
  searchParams
}: AdminCalendarPageProps) {
  const filters = (await searchParams) ?? {};
  const today = currentDateKey();
  const view = selectedView(filters.view);
  const requestedPickerMonth = selectedPickerMonth(filters.navMonth);
  const requestedPickerYear = filters.navYear ? Number(filters.navYear) : null;
  const hasPickerRequest = Boolean(filters.navMonth || filters.navYear);
  const hasInvalidPickerRequest =
    hasPickerRequest &&
    (!requestedPickerMonth ||
      requestedPickerYear === null ||
      !isValidPickerYear(requestedPickerYear));

  if (
    requestedPickerMonth &&
    requestedPickerYear !== null &&
    isValidPickerYear(requestedPickerYear)
  ) {
    redirect(
      hrefWith(
        {
          client: filters.client,
          model: filters.model,
          q: filters.q,
          status: filters.status,
          type: filters.type,
          view
        },
        { date: monthDateKey(requestedPickerYear, requestedPickerMonth) }
      )
    );
  }

  const anchorDate = safeDateKey(filters.date, today);
  const anchorMonth = Number(anchorDate.slice(5, 7));
  const anchorYear = Number(anchorDate.slice(0, 4));
  const range =
    view === "week"
      ? { end: addDays(anchorDate, 6), start: anchorDate }
      : monthRange(anchorDate);
  const dateFrom = isValidDateKey(filters.dateFrom)
    ? filters.dateFrom
    : view === "list"
      ? range.start
      : range.start;
  const dateTo = isValidDateKey(filters.dateTo)
    ? filters.dateTo
    : view === "list"
      ? range.end
      : range.end;
  const [jobs, clients, models] = await Promise.all([
    listAdminJobs({
      clientId: filters.client,
      dateFrom,
      dateTo,
      limit: 250,
      modelId: filters.model,
      q: filters.q,
      status: filters.status,
      type: filters.type
    }),
    listClientOptions(),
    listModels()
  ]);
  const modelImageUrls = await createModelMainImageUrls(
    jobs
      .flatMap((job) => job.job_models.map((jobModel) => jobModel.model))
      .filter((model): model is NonNullable<typeof model> => Boolean(model))
  );
  const monthDays = generateMonthDays(monthStartDateKey(anchorDate.slice(0, 7)), today);
  const weekDates = Array.from({ length: 7 }, (_, index) =>
    addDays(anchorDate, index)
  );
  const previousDate =
    view === "week"
      ? addDays(anchorDate, -7)
      : monthStartDateKey(addMonths(anchorDate.slice(0, 7), -1));
  const nextDate =
    view === "week"
      ? addDays(anchorDate, 7)
      : monthStartDateKey(addMonths(anchorDate.slice(0, 7), 1));
  const activeFilters = filterCount(filters);

  return (
    <div className="stack">
      <section className="panel calendar-hero">
        <div>
          <span className="eyebrow">Agenda</span>
          <h2>Agenda</h2>
          <p>Trabalhos, castings, opções, fittings, viagens, reuniões e bloqueios.</p>
        </div>
        <div className="actions">
          <Link className="button" href={`/admin/calendar/new?date=${anchorDate}`}>
            Novo evento
          </Link>
        </div>
      </section>

      <section className="panel stack calendar-toolbar">
        <div className="calendar-nav">
          <Link
            className="button secondary"
            href={hrefWithAnchorDate(filters, previousDate, view)}
          >
            Anterior
          </Link>
          <details className="calendar-title-picker" open={hasInvalidPickerRequest}>
            <summary className="calendar-title">
              <span className="eyebrow">
                {view === "month"
                  ? "Mês"
                  : view === "week"
                    ? "Semana"
                    : "Lista"}
              </span>
              <h3>{monthTitlePtBr(anchorDate)}</h3>
            </summary>
            <div className="month-picker-panel">
              <form className="month-picker-form" method="get">
                <input name="date" type="hidden" value={anchorDate} />
                <input name="view" type="hidden" value={view} />
                {filters.q ? <input name="q" type="hidden" value={filters.q} /> : null}
                {filters.client ? (
                  <input name="client" type="hidden" value={filters.client} />
                ) : null}
                {filters.model ? (
                  <input name="model" type="hidden" value={filters.model} />
                ) : null}
                {filters.type ? <input name="type" type="hidden" value={filters.type} /> : null}
                {filters.status ? (
                  <input name="status" type="hidden" value={filters.status} />
                ) : null}
                <label>
                  Mês
                  <select defaultValue={String(anchorMonth)} name="navMonth">
                    {monthOptions.map((month, index) => (
                      <option key={month} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ano
                  <span className="month-picker-year">
                    <Link
                      aria-label="Voltar um ano"
                      className="button secondary mini-button"
                      href={hrefWithAnchorDate(
                        filters,
                        monthDateKey(Math.max(2000, anchorYear - 1), anchorMonth),
                        view
                      )}
                    >
                      -
                    </Link>
                    <input
                      defaultValue={anchorYear}
                      inputMode="numeric"
                      max="2100"
                      min="2000"
                      name="navYear"
                      step="1"
                      type="number"
                    />
                    <Link
                      aria-label="Avançar um ano"
                      className="button secondary mini-button"
                      href={hrefWithAnchorDate(
                        filters,
                        monthDateKey(Math.min(2100, anchorYear + 1), anchorMonth),
                        view
                      )}
                    >
                      +
                    </Link>
                  </span>
                </label>
                {hasInvalidPickerRequest ? (
                  <p className="month-picker-error">Use um mês válido e um ano entre 2000 e 2100.</p>
                ) : (
                  <p className="muted">
                    O período personalizado será limpo para mostrar o mês escolhido.
                  </p>
                )}
                <div className="actions month-picker-actions">
                  <button className="button" type="submit">
                    Aplicar
                  </button>
                  <Link
                    className="button secondary"
                    href={hrefWithAnchorDate(filters, today, view)}
                  >
                    Ir para hoje
                  </Link>
                  <Link
                    className="button secondary"
                    href={hrefWith(filters, { navMonth: undefined, navYear: undefined })}
                  >
                    Fechar
                  </Link>
                </div>
              </form>
            </div>
          </details>
          <div className="calendar-nav-actions">
            <Link className="button secondary" href={hrefWithAnchorDate(filters, today, view)}>
              Hoje
            </Link>
            <Link
              className="button secondary"
              href={hrefWithAnchorDate(filters, nextDate, view)}
            >
              Próximo
            </Link>
          </div>
        </div>

        <div className="calendar-view-tabs">
          {views.map((option) => (
            <Link
              className={view === option ? "button" : "button secondary"}
              href={hrefWith(filters, { view: option })}
              key={option}
            >
              {option === "month" ? "Mês" : option === "week" ? "Semana" : "Lista"}
            </Link>
          ))}
        </div>

        <details className="calendar-filters" open={activeFilters > 0}>
          <summary>
            Busca e filtros
            {activeFilters > 0 ? <span className="badge">{activeFilters}</span> : null}
          </summary>
          <form className="calendar-filter-form" method="get">
            <input name="view" type="hidden" value={view} />
            <input name="date" type="hidden" value={anchorDate} />
            <label className="span-2">
              Buscar
              <input
                defaultValue={filters.q ?? ""}
                name="q"
                placeholder="Título, marca, cliente, modelo ou local"
              />
            </label>
            <label>
              Cliente
              <select defaultValue={filters.client ?? ""} name="client">
                <option value="">Todos</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Modelo
              <select defaultValue={filters.model ?? ""} name="model">
                <option value="">Todos</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.stage_name || model.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select defaultValue={filters.type ?? ""} name="type">
                <option value="">Todos</option>
                {jobTypeOptions.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select defaultValue={filters.status ?? ""} name="status">
                <option value="">Todos</option>
                {jobStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              De
              <input defaultValue={filters.dateFrom ?? ""} name="dateFrom" type="date" />
            </label>
            <label>
              Até
              <input defaultValue={filters.dateTo ?? ""} name="dateTo" type="date" />
            </label>
            <div className="actions calendar-filter-actions">
              <button className="button" type="submit">
                Aplicar
              </button>
              <Link className="button secondary" href="/admin/calendar">
                Limpar
              </Link>
            </div>
          </form>
        </details>
      </section>

      {view === "month" ? (
        <section className="panel stack calendar-month-shell">
          <div className="calendar-weekday-row">
            {monthDays.slice(0, 7).map((day) => (
              <span key={day.date}>{day.weekdayShort.slice(0, 1).toUpperCase()}</span>
            ))}
          </div>
          <div className="calendar-month-grid">
            {monthDays.map((day) => {
              const dayJobs = jobs.filter((job) => eventDate(job) === day.date);

              return (
                <article
                  className={[
                    "calendar-day",
                    day.isCurrentMonth ? "" : "muted-day",
                    day.isToday ? "today" : ""
                  ].filter(Boolean).join(" ")}
                  key={day.date}
                >
                  {dayJobs.length === 0 ? (
                    <Link
                      aria-label={`Criar evento em ${formatDatePtBr(day.date)}`}
                      className="calendar-day-hit"
                      href={`/admin/calendar/new?date=${day.date}`}
                    />
                  ) : null}
                  <Link
                    className="calendar-day-number"
                    href={`/admin/calendar/new?date=${day.date}`}
                  >
                    {day.dayOfMonth}
                  </Link>
                  <div className="calendar-event-stack">
                    {dayJobs.slice(0, 3).map((job) => (
                      <Link
                        className={`calendar-event-chip type-${job.type}`}
                        href={`/admin/calendar/${job.id}`}
                        key={job.id}
                      >
                        {jobTitle(job)}
                      </Link>
                    ))}
                    {dayJobs.length > 3 ? (
                      <small>+ {dayJobs.length - 3} eventos</small>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {view === "week" ? (
        <section className="panel calendar-week-grid">
          {weekDates.map((date) => {
            const dayJobs = jobs.filter((job) => eventDate(job) === date);

            return (
              <article className="calendar-week-day" key={date}>
                <div className="actions spread">
                  <span className="eyebrow">{formatDatePtBr(date)}</span>
                  <Link className="button secondary mini-button" href={`/admin/calendar/new?date=${date}`}>
                    Criar
                  </Link>
                </div>
                <div className="calendar-list">
                  {dayJobs.map((job) => (
                    <CalendarEventRow
                      job={job}
                      key={job.id}
                      modelImageUrls={modelImageUrls}
                    />
                  ))}
                  {dayJobs.length === 0 ? (
                    <p className="muted">Nenhum evento neste dia.</p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {view === "list" ? (
        <section className="panel stack">
          <div className="actions spread">
            <span className="eyebrow">Lista operacional</span>
            <span className="badge">Limite seguro: 250 eventos</span>
          </div>
          <div className="calendar-list">
            {jobs.map((job) => (
              <CalendarEventRow
                job={job}
                key={job.id}
                modelImageUrls={modelImageUrls}
              />
            ))}
            {jobs.length === 0 ? (
              <p className="muted">Nenhum evento encontrado para os filtros atuais.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <style>{`
        .calendar-hero,
        .calendar-nav {
          align-items: center;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
        }

        .calendar-title {
          border: 0;
          cursor: pointer;
          display: block;
          list-style: none;
          text-align: center;
        }

        .calendar-title::-webkit-details-marker {
          display: none;
        }

        .calendar-title h3 {
          margin: 0.2rem 0 0;
        }

        .calendar-title h3::after {
          color: var(--muted);
          content: " ▾";
          font-size: 0.9rem;
        }

        .calendar-title-picker {
          position: relative;
        }

        .month-picker-panel {
          background: color-mix(in srgb, #01102a 88%, #86c8ff 12%);
          border: 1px solid color-mix(in srgb, #86c8ff 24%, var(--line));
          border-radius: 8px;
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
          left: 50%;
          margin-top: 0.7rem;
          max-width: min(92vw, 28rem);
          padding: 0.85rem;
          position: absolute;
          top: 100%;
          transform: translateX(-50%);
          width: 28rem;
          z-index: 5;
        }

        .month-picker-form {
          display: grid;
          gap: 0.75rem;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          text-align: left;
        }

        .month-picker-form label {
          color: var(--muted-strong);
          display: grid;
          font-size: 0.76rem;
          font-weight: 800;
          gap: 0.35rem;
        }

        .month-picker-form select,
        .month-picker-form input {
          background: rgba(1, 16, 42, 0.46);
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          color: var(--foreground);
          min-height: 2.6rem;
          padding: 0 0.7rem;
        }

        .month-picker-year {
          display: grid;
          gap: 0.4rem;
          grid-template-columns: auto minmax(0, 1fr) auto;
        }

        .month-picker-year .mini-button {
          align-items: center;
          justify-content: center;
          min-width: 2.4rem;
        }

        .month-picker-form .muted,
        .month-picker-error,
        .month-picker-actions {
          grid-column: 1 / -1;
        }

        .month-picker-error {
          color: #ffb4b4;
          font-size: 0.82rem;
          font-weight: 800;
          margin: 0;
        }

        .month-picker-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .calendar-nav-actions,
        .calendar-view-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .calendar-view-tabs .button {
          min-height: 2.2rem;
          padding: 0.4rem 0.75rem;
        }

        .calendar-filters {
          border: 1px solid color-mix(in srgb, #86c8ff 18%, var(--line));
          border-radius: 8px;
          padding: 0.75rem;
        }

        .calendar-filters summary {
          align-items: center;
          cursor: pointer;
          display: flex;
          font-weight: 800;
          gap: 0.5rem;
          justify-content: space-between;
          list-style: none;
        }

        .calendar-filter-form {
          display: grid;
          gap: 0.75rem;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 0.75rem;
        }

        .calendar-filter-form label {
          color: var(--muted-strong);
          display: grid;
          font-size: 0.76rem;
          font-weight: 800;
          gap: 0.35rem;
        }

        .calendar-filter-form input,
        .calendar-filter-form select {
          background: rgba(1, 16, 42, 0.36);
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          color: var(--foreground);
          min-height: 2.5rem;
          padding: 0 0.7rem;
        }

        .span-2 {
          grid-column: span 2;
        }

        .calendar-filter-actions {
          align-items: end;
        }

        .calendar-weekday-row,
        .calendar-month-grid {
          display: grid;
          gap: 0.45rem;
          grid-template-columns: repeat(7, minmax(0, 1fr));
        }

        .calendar-weekday-row span {
          color: var(--muted);
          font-size: 0.75rem;
          font-weight: 800;
          text-align: center;
        }

        .calendar-day {
          background: rgba(1, 16, 42, 0.32);
          border: 1px solid var(--line);
          border-radius: 8px;
          display: grid;
          gap: 0.45rem;
          min-height: 8.2rem;
          overflow: hidden;
          padding: 0.55rem;
          position: relative;
        }

        .calendar-day-hit {
          inset: 0;
          position: absolute;
        }

        .calendar-day-number {
          color: var(--foreground);
          font-weight: 800;
          position: relative;
          text-decoration: none;
          width: fit-content;
          z-index: 1;
        }

        .muted-day {
          opacity: 0.44;
        }

        .today {
          border-color: rgba(134, 200, 255, 0.72);
          box-shadow: inset 0 0 0 1px rgba(134, 200, 255, 0.26);
        }

        .calendar-event-stack,
        .calendar-list {
          display: grid;
          gap: 0.45rem;
          position: relative;
          z-index: 1;
        }

        .calendar-event-chip {
          background: rgba(134, 200, 255, 0.12);
          border: 1px solid color-mix(in srgb, #86c8ff 22%, var(--line));
          border-radius: 999px;
          color: var(--foreground);
          display: block;
          font-size: 0.7rem;
          font-weight: 800;
          overflow: hidden;
          padding: 0.25rem 0.45rem;
          text-decoration: none;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .calendar-event-stack small {
          color: var(--muted);
          font-size: 0.68rem;
          font-weight: 800;
        }

        .calendar-week-grid {
          display: grid;
          gap: 0.75rem;
          grid-template-columns: repeat(7, minmax(0, 1fr));
        }

        .calendar-week-day {
          border: 1px solid var(--line);
          border-radius: 8px;
          display: grid;
          gap: 0.65rem;
          min-width: 0;
          padding: 0.75rem;
        }

        .mini-button {
          font-size: 0.7rem;
          min-height: 1.9rem;
          padding: 0.25rem 0.55rem;
        }

        .calendar-row {
          align-items: center;
          border: 1px solid var(--line);
          border-radius: 8px;
          display: grid;
          gap: 0.75rem;
          grid-template-columns: minmax(0, 1.2fr) minmax(11rem, 0.9fr) auto;
          padding: 0.75rem;
        }

        .calendar-row h3 {
          margin: 0.15rem 0;
        }

        .calendar-row p {
          color: var(--muted);
          margin: 0;
        }

        .model-chip-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .model-chip {
          align-items: center;
          border: 1px solid var(--line);
          border-radius: 8px;
          display: inline-flex;
          gap: 0.45rem;
          min-width: 0;
          padding: 0.3rem 0.45rem 0.3rem 0.3rem;
        }

        .model-chip img,
        .model-chip-placeholder {
          border-radius: 7px;
          height: 2rem;
          width: 2rem;
        }

        .model-chip img {
          object-fit: cover;
        }

        .model-chip-placeholder {
          align-items: center;
          background: rgba(255, 255, 255, 0.06);
          color: var(--muted-strong);
          display: inline-flex;
          font-size: 0.65rem;
          font-weight: 800;
          justify-content: center;
        }

        .model-chip span:last-child {
          display: grid;
          gap: 0.1rem;
          min-width: 0;
        }

        .model-chip strong,
        .model-chip small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .model-chip small {
          color: var(--muted);
          font-size: 0.65rem;
        }

        @media (max-width: 1120px) {
          .calendar-week-grid,
          .calendar-filter-form {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .calendar-row {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .calendar-hero,
          .calendar-nav {
            align-items: stretch;
            flex-direction: column;
          }

          .calendar-title {
            text-align: left;
          }

          .month-picker-panel {
            left: 0;
            max-width: 100%;
            position: relative;
            transform: none;
            width: 100%;
          }

          .month-picker-form {
            grid-template-columns: 1fr;
          }

          .calendar-nav-actions,
          .calendar-view-tabs {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .calendar-filter-form,
          .calendar-week-grid {
            grid-template-columns: 1fr;
          }

          .span-2 {
            grid-column: auto;
          }

          .calendar-month-grid {
            display: grid;
            grid-template-columns: 1fr;
          }

          .calendar-weekday-row {
            display: none;
          }

          .calendar-day {
            min-height: 5.8rem;
          }

          .muted-day {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

function CalendarEventRow({
  job,
  modelImageUrls
}: {
  job: JobWithRelations;
  modelImageUrls: Record<string, string>;
}) {
  return (
    <article className="calendar-row">
      <div>
        <span className="eyebrow">
          {formatDatePtBr(eventDate(job))} · {eventTime(job)} · {jobTypeLabel(job.type)}
        </span>
        <h3>
          <Link href={`/admin/calendar/${job.id}`}>{jobTitle(job)}</Link>
        </h3>
        <p>
          {[job.client?.company_name, job.location_name, job.city]
            .filter(Boolean)
            .join(" · ") || "Evento interno"}
        </p>
      </div>
      <div className="model-chip-list">
        {job.job_models.slice(0, 3).map((jobModel) => {
          const model = jobModel.model;
          const name = modelDisplayName(model) || "Modelo";

          return (
            <span className="model-chip" key={jobModel.id}>
              {model && modelImageUrls[model.id] ? (
                <img alt={name} src={modelImageUrls[model.id]} />
              ) : (
                <span className="model-chip-placeholder">{modelInitials(model)}</span>
              )}
              <span>
                <strong>{name}</strong>
                <small>{jobModelStatusLabel(jobModel.status)}</small>
              </span>
            </span>
          );
        })}
        {job.job_models.length > 3 ? (
          <span className="badge">+ {job.job_models.length - 3}</span>
        ) : null}
        {job.job_models.length === 0 ? <span className="muted">Sem modelo</span> : null}
      </div>
      <span className="status">{jobStatusLabel(job.status)}</span>
    </article>
  );
}

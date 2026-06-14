export type CalendarDay = {
  date: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  weekday: string;
  weekdayShort: string;
};

const defaultToday = "2026-06-13";

function dateFromParts(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

export function toDateKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    return dateFromParts(2026, 5, 13);
  }

  return dateFromParts(year, month - 1, day);
}

export function compareDateKeys(left: string, right: string) {
  return left.localeCompare(right);
}

export function formatDatePtBr(dateKey: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
    ...options
  }).format(parseDateKey(dateKey));
}

export function getWeekdayPtBr(dateKey: string, format: "long" | "short" = "long") {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: format
  }).format(parseDateKey(dateKey));
}

export function generateMonthDays(
  anchorDateKey = defaultToday,
  todayDateKey = defaultToday
) {
  const anchor = parseDateKey(anchorDateKey);
  const year = anchor.getUTCFullYear();
  const monthIndex = anchor.getUTCMonth();
  const firstDay = dateFromParts(year, monthIndex, 1);
  const startOffset = firstDay.getUTCDay();
  const gridStart = dateFromParts(year, monthIndex, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = dateFromParts(
      gridStart.getUTCFullYear(),
      gridStart.getUTCMonth(),
      gridStart.getUTCDate() + index
    );
    const dateKey = toDateKey(date);

    return {
      date: dateKey,
      dayOfMonth: date.getUTCDate(),
      isCurrentMonth: date.getUTCMonth() === monthIndex,
      isToday: dateKey === todayDateKey,
      weekday: getWeekdayPtBr(dateKey, "long"),
      weekdayShort: getWeekdayPtBr(dateKey, "short")
    } satisfies CalendarDay;
  });
}

export function monthTitlePtBr(anchorDateKey = defaultToday) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  }).format(parseDateKey(anchorDateKey));
}

export function dateKeyFromIso(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

export function addDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  return toDateKey(
    dateFromParts(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );
}

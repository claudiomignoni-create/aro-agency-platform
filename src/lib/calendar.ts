export type CalendarDay = {
  date: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  weekday: string;
  weekdayShort: string;
};

export const operationalTimeZone = "America/Sao_Paulo";
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;
const monthKeyPattern = /^\d{4}-\d{2}$/;

function dateKeyFromParts(year: number, month: number, day: number) {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0")
  ].join("-");
}

function dateFromParts(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

export function toDateKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function currentDateKey(timeZone = operationalTimeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(new Date());

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

export function currentMonthKey(timeZone = operationalTimeZone) {
  return currentDateKey(timeZone).slice(0, 7);
}

export function isValidDateKey(dateKey: string | null | undefined) {
  if (!dateKey || !dateKeyPattern.test(dateKey)) {
    return false;
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const parsed = dateFromParts(year, month - 1, day);

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function safeDateKey(
  dateKey: string | null | undefined,
  fallbackDateKey = currentDateKey()
) {
  return isValidDateKey(dateKey) ? String(dateKey) : fallbackDateKey;
}

export function parseDateKey(dateKey: string) {
  const safeDateKeyValue = safeDateKey(dateKey);
  const [year, month, day] = safeDateKeyValue.split("-").map(Number);

  return dateFromParts(year, month - 1, day);
}

export function compareDateKeys(left: string, right: string) {
  return left.localeCompare(right);
}

export function isValidMonthKey(monthKey: string | null | undefined) {
  if (!monthKey || !monthKeyPattern.test(monthKey)) {
    return false;
  }

  const [year, month] = monthKey.split("-").map(Number);
  const parsed = dateFromParts(year, month - 1, 1);

  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1;
}

export function monthKeyFromDateKey(dateKey: string) {
  return safeDateKey(dateKey).slice(0, 7);
}

export function monthStartDateKey(monthKey: string) {
  return `${safeMonthKey(monthKey)}-01`;
}

export function safeMonthKey(
  monthKey: string | null | undefined,
  fallbackMonthKey = currentMonthKey()
) {
  return isValidMonthKey(monthKey) ? String(monthKey) : fallbackMonthKey;
}

export function addMonths(monthKey: string, months: number) {
  const [year, month] = safeMonthKey(monthKey).split("-").map(Number);
  const date = dateFromParts(year, month - 1 + months, 1);

  return dateKeyFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, 1).slice(0, 7);
}

export function previousMonthKey(monthKey: string) {
  return addMonths(monthKey, -1);
}

export function nextMonthKey(monthKey: string) {
  return addMonths(monthKey, 1);
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
  anchorDateKey = currentDateKey(),
  todayDateKey = currentDateKey()
) {
  const anchor = parseDateKey(
    isValidMonthKey(anchorDateKey) ? `${anchorDateKey}-01` : anchorDateKey
  );
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

export function monthTitlePtBr(anchorDateKey = currentDateKey()) {
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

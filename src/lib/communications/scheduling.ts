const dateTimeLocalPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function zonedDateTimeLocalToUtc(value: string, timeZone: string) {
  const match = value.match(dateTimeLocalPattern);
  if (!match) return null;

  const [, year, month, day, hour, minute, second = "00"] = match;
  const utcGuess = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    )
  );
  if (Number.isNaN(utcGuess.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(utcGuess);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  const zonedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  const offset = zonedAsUtc - utcGuess.getTime();
  const result = new Date(utcGuess.getTime() - offset);

  return Number.isNaN(result.getTime()) ? null : result;
}

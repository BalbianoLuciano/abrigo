/** Minuto del día en Argentina (UTC−3, sin horario de verano). */
export function argentinaMinuteOfDay(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** El horario de silencio puede cruzar la medianoche (por ejemplo 23:00–07:00). */
export function isQuiet(start: number | null, end: number | null, minute: number): boolean {
  if (start === null || end === null || start === end) return false;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

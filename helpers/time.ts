export const DAY_MS = 24 * 60 * 60 * 1000;

export function dayKeyLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function startOfLocalDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()); // local midnight
}

export function endOfLocalDay(d: Date = new Date()): Date {
  const start = startOfLocalDay(d);
  return new Date(start.getTime() + DAY_MS);
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return dayKeyLocal(a) === dayKeyLocal(b);
}

export function isYesterdayLocal(last: Date | null): boolean {
  if (!last) return false;
  const yStart = new Date(startOfLocalDay().getTime() - DAY_MS);
  return dayKeyLocal(last) === dayKeyLocal(yStart);
}

export function tomorrowStartLocal(): Date {
  return new Date(startOfLocalDay().getTime() + DAY_MS);
}

export function addMinutesUTC(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60_000);
}

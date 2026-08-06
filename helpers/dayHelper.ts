export function ymdInSystemTz(date = new Date()): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; // system tz
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date); // "YYYY-MM-DD"
}
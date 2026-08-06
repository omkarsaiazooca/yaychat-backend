// utils/toCsv.ts
export function csvEscape(value: string): string {
  const needsWrap = /[",\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsWrap ? `"${escaped}"` : escaped;
}

export function emailsToCsv(emails: string[], header = "email"): string {
  const lines = [header, ...emails.map(csvEscape)];
  return lines.join("\n") + "\n";
}

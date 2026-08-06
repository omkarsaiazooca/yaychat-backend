// src/utils/template.ts
// Robust template renderer that supports both {var} and {{var}}.
// Also supports dot-paths like {{user.firstName}}.

function get(obj: any, path: string) {
  return String(path)
    .split(".")
    .reduce((o: any, k: string) => (o == null ? o : o[k]), obj);
}

/**
 * Render a string template using the provided data.
 * - Accepts `{var}` and `{{var}}` (we normalize single braces to mustache first)
 * - Trims whitespace inside braces
 * - Leaves unknown keys blank
 */
export function renderTemplate(
  input: string,
  data: Record<string, any>
): string {
  if (!input) return "";

  // 1) normalize `{var}` → `{{var}}`
  const normalized = input.replace(/\{(\s*[\w.]+\s*)\}/g, "{{$1}}");

  // 2) render `{{var}}`
  return normalized.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
    const val = get(data, key);
    return val === undefined || val === null ? "" : String(val);
  });
}

// Simple {{ key }} renderer with dotted paths (e.g., {{user.firstName}})
export function renderString(
  tpl: string | undefined,
  vars: Record<string, unknown> = {}
): string | undefined {
  if (!tpl) return tpl;

  return tpl.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_: string, path: string) => {
    let cur: unknown = vars;
    for (const key of path.split(".")) {
      if (cur != null && typeof cur === "object") {
        cur = (cur as Record<string, unknown>)[key];
      } else {
        cur = undefined;
        break;
      }
    }
    return cur == null ? "" : String(cur);
  });
}

export function renderDataMap(
  data: Record<string, any> | undefined,
  vars: Record<string, any> = {}
): Record<string, string> | undefined {
  if (!data) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    const raw = typeof v === "string" ? v : String(v ?? "");
    out[k] = renderString(raw, vars) ?? "";
  }
  return out;
}

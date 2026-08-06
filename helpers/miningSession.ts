const normalize = (value?: string): string => String(value || "").trim().toLowerCase();

export function isFreeMiningPlan(planName?: string): boolean {
  const plan = normalize(planName);
  return !plan || plan.includes("free");
}

export function resolvePlanSessionHours(planName?: string): number {
  const plan = normalize(planName);
  if (isFreeMiningPlan(plan)) return 6;
  if (plan.includes("electric") || plan.includes("silver")) return 12;
  if (plan.includes("turbo") || plan.includes("gold")) return 24;
  if (plan.includes("nuclear") || plan.includes("platinum")) return 24;
  return 24;
}

export function isFreeMiningSession(userType?: string, planName?: string): boolean {
  const type = normalize(userType);
  if (type === "free mining") return true;
  if (type === "power mining") return false;
  return isFreeMiningPlan(planName);
}

export function resolveSessionHours(userType?: string, planName?: string): number {
  const type = normalize(userType);
  if (type === "free mining") return 6;
  const planHours = resolvePlanSessionHours(planName);
  // power mining users should never get the free 6h session length
  if (type === "power mining" && planHours === 6) return 24;
  return planHours;
}

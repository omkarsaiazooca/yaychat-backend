export const INDEPENDENCE_WEEK_PROMO_CODE = "JULY4BTCY2026";
export const INDEPENDENCE_WEEK_EMMM_PROMO_CODE = "JULY4BTCY2026_EMMM";
export const INDEPENDENCE_WEEK_QUANTUM_BONUS_RATE = 0.3;
export const INDEPENDENCE_WEEK_POWER_DISCOUNT_PERCENT = 20;
export const INDEPENDENCE_WEEK_EMMM_POWER_DISCOUNT_PERCENT = 30;
export const INDEPENDENCE_WEEK_START_UTC = new Date(Date.UTC(2026, 6, 4, 0, 0, 0));
export const INDEPENDENCE_WEEK_END_DISPLAY_UTC = new Date(Date.UTC(2026, 6, 10, 23, 59, 59, 999));
export const INDEPENDENCE_WEEK_END_UTC_EXCLUSIVE = new Date(Date.UTC(2026, 6, 11, 0, 0, 0));

type QuantumBonusResult = {
  eligible: boolean;
  alreadyApplied: boolean;
  applied: boolean;
  baseOutAmount: number;
  bonusAmount: number;
  finalOutAmount: number;
  reason: string;
};

function toFinite(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isQuantumContext(order: any): boolean {
  const comments = String(order?.comments || "").toLowerCase();
  const exchangeName = String(order?.exchangeName || "").toLowerCase();
  const orderId = String(order?.orderId || "");
  return (
    comments.includes("quantum") ||
    exchangeName.includes("cryptopaymentprocessor") ||
    orderId.startsWith("CRYPTO_")
  );
}

function outCurrencyIsBtcy(order: any): boolean {
  return String(order?.breakdown?.outCurrencyName || "").toUpperCase() === "BTCY";
}

export function isIndependenceWeekPromoActive(now = new Date()): boolean {
  return now >= INDEPENDENCE_WEEK_START_UTC && now < INDEPENDENCE_WEEK_END_UTC_EXCLUSIVE;
}

export function applyIndependenceWeekQuantumBtcyBonus(
  amountUsd: number,
  outAmount: number,
  now = new Date()
) {
  const amount = toFinite(amountUsd);
  const base = toFinite(outAmount);

  if (!isIndependenceWeekPromoActive(now) || amount <= 0 || base <= 0) {
    return {
      applied: false,
      baseOutAmount: base,
      bonusAmount: 0,
      finalOutAmount: base,
      promoCode: "",
    };
  }

  const bonusAmount = Number((base * INDEPENDENCE_WEEK_QUANTUM_BONUS_RATE).toFixed(8));
  const finalOutAmount = Number((base + bonusAmount).toFixed(8));
  return {
    applied: bonusAmount > 0,
    baseOutAmount: base,
    bonusAmount,
    finalOutAmount,
    promoCode: INDEPENDENCE_WEEK_PROMO_CODE,
  };
}

export function applyQuantumBtcyBonusIfNeeded(
  order: any,
  baseOutAmount: number,
  now = new Date()
): QuantumBonusResult {
  const base = toFinite(baseOutAmount);
  const inAmount = toFinite(order?.breakdown?.inAmount);

  if (!outCurrencyIsBtcy(order)) {
    return {
      eligible: false,
      alreadyApplied: false,
      applied: false,
      baseOutAmount: base,
      bonusAmount: 0,
      finalOutAmount: base,
      reason: "outCurrency is not BTCY",
    };
  }

  if (!isQuantumContext(order)) {
    return {
      eligible: false,
      alreadyApplied: false,
      applied: false,
      baseOutAmount: base,
      bonusAmount: 0,
      finalOutAmount: base,
      reason: "order is not quantum context",
    };
  }

  if (
    String(order?.notes || "").includes(INDEPENDENCE_WEEK_PROMO_CODE) ||
    String(order?.breakdown?.promotionalBonusCode || "") === INDEPENDENCE_WEEK_PROMO_CODE
  ) {
    return {
      eligible: true,
      alreadyApplied: true,
      applied: false,
      baseOutAmount: base,
      bonusAmount: 0,
      finalOutAmount: base,
      reason: "promo already applied",
    };
  }

  if (!Number.isFinite(base) || base <= 0) {
    return {
      eligible: true,
      alreadyApplied: false,
      applied: false,
      baseOutAmount: base,
      bonusAmount: 0,
      finalOutAmount: base,
      reason: "invalid base outAmount",
    };
  }

  const promo = applyIndependenceWeekQuantumBtcyBonus(inAmount, base, now);
  if (!promo.applied) {
    return {
      eligible: true,
      alreadyApplied: false,
      applied: false,
      baseOutAmount: base,
      bonusAmount: 0,
      finalOutAmount: base,
      reason: "promo inactive",
    };
  }

  return {
    eligible: true,
    alreadyApplied: false,
    applied: true,
    baseOutAmount: base,
    bonusAmount: promo.bonusAmount,
    finalOutAmount: promo.finalOutAmount,
    reason: INDEPENDENCE_WEEK_PROMO_CODE,
  };
}

export function appendQuantumBtcyBonusNote(
  notesInput: any,
  bonusAmount: number,
  finalOutAmount: number,
  _now: Date = new Date()
): string {
  const notes = String(notesInput || "").trim();
  const marker = `${INDEPENDENCE_WEEK_PROMO_CODE}: +${bonusAmount} BTCY bonus applied; finalOutAmount=${finalOutAmount}`;
  if (notes.includes(INDEPENDENCE_WEEK_PROMO_CODE)) {
    return notes;
  }
  return notes ? `${notes} | ${marker}` : marker;
}

import assert from "assert";
import {
  INDEPENDENCE_WEEK_END_DISPLAY_UTC,
  INDEPENDENCE_WEEK_END_UTC_EXCLUSIVE,
  INDEPENDENCE_WEEK_EMMM_POWER_DISCOUNT_PERCENT,
  INDEPENDENCE_WEEK_EMMM_PROMO_CODE,
  INDEPENDENCE_WEEK_POWER_DISCOUNT_PERCENT,
  INDEPENDENCE_WEEK_PROMO_CODE,
  INDEPENDENCE_WEEK_QUANTUM_BONUS_RATE,
  INDEPENDENCE_WEEK_START_UTC,
  appendQuantumBtcyBonusNote,
  applyIndependenceWeekQuantumBtcyBonus,
  applyQuantumBtcyBonusIfNeeded,
  isIndependenceWeekPromoActive,
} from "../helpers/quantumBtcyBonus";

function assertEqual<T>(actual: T, expected: T, label: string) {
  assert.deepStrictEqual(actual, expected, label);
  console.log(`PASS ${label}`);
}

function assertClose(actual: number, expected: number, label: string) {
  assert(Math.abs(actual - expected) < 0.00000001, `${label}: expected ${expected}, got ${actual}`);
  console.log(`PASS ${label}`);
}

function sampleQuantumOrder(overrides: any = {}) {
  return {
    comments: "Quantum order for BTCY",
    exchangeName: "",
    orderId: "12345678",
    breakdown: {
      inAmount: 100,
      outCurrencyName: "BTCY",
      promotionalBonusCode: "",
    },
    notes: "",
    ...overrides,
  };
}

function run() {
  console.log("BTCY Independence Week promo test");
  console.log(`Window: ${INDEPENDENCE_WEEK_START_UTC.toISOString()} -> ${INDEPENDENCE_WEEK_END_DISPLAY_UTC.toISOString()} inclusive`);
  console.log(`Exclusive cutoff: ${INDEPENDENCE_WEEK_END_UTC_EXCLUSIVE.toISOString()}`);
  console.log(`Quantum bonus: ${INDEPENDENCE_WEEK_QUANTUM_BONUS_RATE * 100}%`);
  console.log(`Power discount: ${INDEPENDENCE_WEEK_POWER_DISCOUNT_PERCENT}%`);
  console.log(`EMMM bettor Power discount: ${INDEPENDENCE_WEEK_EMMM_POWER_DISCOUNT_PERCENT}%`);

  assertEqual(isIndependenceWeekPromoActive(new Date("2026-07-03T23:59:59.999Z")), false, "promo inactive before July 4 UTC");
  assertEqual(isIndependenceWeekPromoActive(new Date("2026-07-04T00:00:00.000Z")), true, "promo active exactly at start");
  assertEqual(isIndependenceWeekPromoActive(new Date("2026-07-10T23:59:59.999Z")), true, "promo active through July 10 UTC");
  assertEqual(isIndependenceWeekPromoActive(new Date("2026-07-10T23:59:59.999Z")), true, "promo is active through the end of July 10 UTC");
  assertEqual(isIndependenceWeekPromoActive(new Date("2026-07-11T00:00:00.000Z")), false, "promo expires immediately after July 10 UTC");

  const directBonus = applyIndependenceWeekQuantumBtcyBonus(100, 950, new Date("2026-07-04T12:00:00.000Z"));
  assertEqual(directBonus.applied, true, "direct Quantum bonus applies inside window");
  assertClose(directBonus.bonusAmount, 285, "direct Quantum bonus amount is 30%");
  assertClose(directBonus.finalOutAmount, 1235, "direct Quantum final amount includes bonus");
  assertEqual(directBonus.promoCode, INDEPENDENCE_WEEK_PROMO_CODE, "direct Quantum bonus returns promo code");

  const outsideWindow = applyIndependenceWeekQuantumBtcyBonus(100, 950, new Date("2026-07-11T00:00:00.000Z"));
  assertEqual(outsideWindow.applied, false, "direct Quantum bonus does not apply after window");
  assertClose(outsideWindow.finalOutAmount, 950, "outside-window amount is unchanged");

  const invalidAmount = applyIndependenceWeekQuantumBtcyBonus(0, 950, new Date("2026-07-04T12:00:00.000Z"));
  assertEqual(invalidAmount.applied, false, "zero USD amount does not get bonus");

  const completionBonus = applyQuantumBtcyBonusIfNeeded(sampleQuantumOrder(), 950, new Date("2026-07-04T12:00:00.000Z"));
  assertEqual(completionBonus.applied, true, "Quantum completion helper applies bonus for BTCY Quantum order during promo window");
  assertClose(completionBonus.bonusAmount, 285, "completion helper bonus amount is 30%");
  assertClose(completionBonus.finalOutAmount, 1235, "completion helper final amount includes bonus");

  const nonBtcy = applyQuantumBtcyBonusIfNeeded(
    sampleQuantumOrder({ breakdown: { inAmount: 100, outCurrencyName: "INEX" } }),
    950,
    new Date("2026-07-04T12:00:00.000Z")
  );
  assertEqual(nonBtcy.eligible, false, "non-BTCY orders are not eligible");

  const nonQuantum = applyQuantumBtcyBonusIfNeeded(
    sampleQuantumOrder({ comments: "regular buy order", orderId: "87654321" }),
    950,
    new Date("2026-07-04T12:00:00.000Z")
  );
  assertEqual(nonQuantum.eligible, false, "non-Quantum BTCY orders are not eligible");

  const alreadyApplied = applyQuantumBtcyBonusIfNeeded(
    sampleQuantumOrder({
      breakdown: {
        inAmount: 100,
        outCurrencyName: "BTCY",
        promotionalBonusCode: INDEPENDENCE_WEEK_PROMO_CODE,
      },
    }),
    1235,
    new Date("2026-07-04T12:00:00.000Z")
  );
  assertEqual(alreadyApplied.alreadyApplied, true, "already-tagged orders do not receive a second bonus");
  assertClose(alreadyApplied.finalOutAmount, 1235, "already-tagged order amount is unchanged");

  const invalidBase = applyQuantumBtcyBonusIfNeeded(sampleQuantumOrder(), 0, new Date("2026-07-04T12:00:00.000Z"));
  assertEqual(invalidBase.applied, false, "invalid base BTCY amount does not get bonus");

  const emptyNote = appendQuantumBtcyBonusNote("", 285, 1235);
  assert(emptyNote.includes(INDEPENDENCE_WEEK_PROMO_CODE), "empty note gets promo marker");
  console.log("PASS empty note gets promo marker");

  const existingNote = appendQuantumBtcyBonusNote(emptyNote, 285, 1235);
  assertEqual(existingNote, emptyNote, "promo note append is idempotent");

  const powerBase = 75;
  const powerDiscount = Number((powerBase * (INDEPENDENCE_WEEK_POWER_DISCOUNT_PERCENT / 100)).toFixed(2));
  const powerFinal = Number((powerBase - powerDiscount).toFixed(2));
  assertClose(powerDiscount, 15, "Turbo/Power $75 plan gets $15 discount");
  assertClose(powerFinal, 60, "Turbo/Power $75 plan final price is $60");

  const emmmPowerDiscount = Number(
    (powerBase * (INDEPENDENCE_WEEK_EMMM_POWER_DISCOUNT_PERCENT / 100)).toFixed(2)
  );
  const emmmPowerFinal = Number((powerBase - emmmPowerDiscount).toFixed(2));
  assertEqual(INDEPENDENCE_WEEK_EMMM_PROMO_CODE, "JULY4BTCY2026_EMMM", "EMMM bettor promo code is stable");
  assertClose(emmmPowerDiscount, 22.5, "EMMM bettor Turbo/Power $75 plan gets $22.50 discount");
  assertClose(emmmPowerFinal, 52.5, "EMMM bettor Turbo/Power $75 plan final price is $52.50");

  console.log("All BTCY Independence Week promo checks passed.");
}

run();

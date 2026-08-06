import { getPriceByName } from "../controllers/priceAPI";

export const QUANTUM_BTCY_FALLBACK_USD_RATE = 0.1;

export async function resolveQuantumBtcyUsdRate(): Promise<number> {
  try {
    const priceResult = await getPriceByName("BTCY");
    const rate = Number(priceResult?.data);

    if (Number.isFinite(rate) && rate > 0) {
      return rate;
    }

    console.warn(
      "[resolveQuantumBtcyUsdRate] invalid BTCY price result, using fallback",
      priceResult
    );
  } catch (error) {
    console.warn(
      "[resolveQuantumBtcyUsdRate] failed to resolve BTCY price, using fallback",
      error
    );
  }

  return QUANTUM_BTCY_FALLBACK_USD_RATE;
}

export function calculateQuantumBtcyOutAmountFromFeeData(
  feeData: any,
  btcyUsdRate: number
) {
  const netAmount = Number(feeData?.netAmount ?? feeData?.baseAmount ?? 0);
  const rate = Number(btcyUsdRate);

  if (
    !Number.isFinite(netAmount) ||
    netAmount <= 0 ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    return 0;
  }

  return Number((netAmount / rate).toFixed(8));
}

import { keys } from "../config/keys";

export function getConfiguredBtcyFeePercent(): number {
  const feePercent = Number(keys.btcyFeePercent?.key ?? 0);
  return Number.isFinite(feePercent) && feePercent >= 0 ? feePercent : 0;
}

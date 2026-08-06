import type { providers } from "ethers";

export async function waitReceiptAny(
  providersList: providers.Provider[],
  txHash: string,
  minConf = 1,
  overallTimeoutMs = 120_000
): Promise<providers.TransactionReceipt> {
  const deadline = Date.now() + overallTimeoutMs;

  while (Date.now() < deadline) {
    try {
      const winner = await Promise.race(
        providersList.map((p) => p.waitForTransaction(txHash, minConf, 30_000))
      );
      if (winner) return winner; // got receipt with >= minConf
    } catch {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`waitReceiptAny timeout for ${txHash}`);
}

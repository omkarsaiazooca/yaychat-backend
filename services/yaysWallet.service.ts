import { WalletUserService } from "./walletUser.service";
import { WalletTransactionService } from "./walletTransaction.service";
import { UserWallet } from "../data/user";
import { Transaction } from "../data/transaction";
import { WalletAssetView, WalletTransactionView } from "../data/yaysWallet";
import { PointsLedgerService, YaysPointsService } from "./yaysPoints.service";

/**
 * The wallet view YaysApp shows.
 *
 * Two very different sources are merged here:
 *
 *  - **IndexxPoints** — owned by YaysApp, sourced from the points ledger. Fully
 *    spendable inside the app.
 *  - **Crypto** — owned by the Indexx wallet service. Read-only from here:
 *    balances and transaction history are surfaced, but nothing in YaysApp
 *    signs or broadcasts a transfer. Those rows are marked `preview` so the UI
 *    knows not to offer send/convert on them.
 *
 * An account with no Indexx wallet is normal, not an error — most YaysApp
 * members sign up for chat and never open one. That case returns the points
 * row alone rather than failing the screen.
 */

/** Symbols whose price comes from the internal currency table, not a feed. */
const INDEXX_POINTS_SYMBOL = "IXXP";

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const iso = (value: unknown): string => {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

/** Map an Indexx order status onto the three states the wallet UI renders. */
const txStatus = (status: unknown): WalletTransactionView["status"] => {
  const value = String(status || "").toUpperCase();
  if (value.includes("FAIL") || value.includes("CANCEL") || value.includes("REJECT")) {
    return "failed";
  }
  if (value.includes("PENDING") || value.includes("PROCESS") || value.includes("SUBMIT")) {
    return "pending";
  }
  return "completed";
};

export class YaysWalletService {
  private walletUsers = new WalletUserService();
  private walletTransactions = new WalletTransactionService();
  private ledger = new PointsLedgerService();
  private points = new YaysPointsService();

  /**
   * Every asset row for the wallet home screen.
   *
   * IndexxPoints always leads: it is the balance YaysApp is authoritative for and
   * the only one guaranteed to exist.
   */
  async assets(userLower: string): Promise<WalletAssetView[]> {
    const account = await this.points.summary(userLower);

    const rows: WalletAssetView[] = [
      {
        symbol: INDEXX_POINTS_SYMBOL,
        name: "IndexxPoints",
        balance: account.balance,
        // IndexxPoints have no fiat conversion until the redemption rail exists;
        // reporting 0 is honest, whereas inventing a rate would not be.
        fiatValue: 0,
        preview: false,
      },
    ];

    for (const wallet of await this.indexxWallets(userLower)) {
      if (wallet.isCoinActive === false) {
        continue;
      }
      const balance = num(wallet.coinBalance) + num(wallet.coinStakedBalance);
      const price = num(wallet.coinPrice);
      rows.push({
        symbol: String(wallet.coinSymbol || "").toUpperCase(),
        name: String(wallet.coinName || wallet.coinSymbol || "Asset"),
        balance,
        fiatValue: num(wallet.coinBalanceInUSD) || balance * price,
        // Read-only until YaysApp can sign transfers itself.
        preview: true,
      });
    }

    return rows;
  }

  /**
   * Combined transaction history: points ledger entries and Indexx wallet
   * transactions, newest first.
   */
  async transactions(
    userLower: string,
    limit: number,
    skip: number
  ): Promise<{ items: WalletTransactionView[]; hasMore: boolean }> {
    // Over-fetch each source so the merge has enough rows to fill the page
    // after interleaving by date.
    const window = limit + skip + 1;

    const [ledgerRows, chainRows] = await Promise.all([
      this.ledger.history(userLower, window, 0),
      this.indexxTransactions(userLower, window),
    ]);

    const merged: WalletTransactionView[] = [
      ...ledgerRows.map((entry) => this.fromLedger(entry)),
      ...chainRows.map((tx) => this.fromChain(tx, userLower)),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      items: merged.slice(skip, skip + limit),
      hasMore: merged.length > skip + limit,
    };
  }

  async transaction(userLower: string, id: string): Promise<WalletTransactionView | null> {
    const entry = await this.ledger.entry(userLower, id);
    if (entry) {
      return this.fromLedger(entry);
    }
    const tx = await this.walletTransactions.findOne({ _id: id, email: userLower });
    return tx ? this.fromChain(tx, userLower) : null;
  }

  // -------------------------------------------------------------------------
  // Indexx sources. Both swallow their errors: a wallet-service outage should
  // degrade the screen to IndexxPoints, never blank it.
  // -------------------------------------------------------------------------

  private async indexxWallets(userLower: string): Promise<UserWallet[]> {
    try {
      const user = await this.walletUsers.findOneSelect({ email: userLower }, {});
      const wallets = (user as any)?.userWallets;
      if (!Array.isArray(wallets)) {
        return [];
      }
      return wallets.map((wallet: UserWallet) => ({
        ...wallet,
        // Never let a private key leave this process, whatever the caller asked for.
        coinPrivateKey: "",
      }));
    } catch (error) {
      console.error("[yays/wallet] could not read Indexx wallets", error);
      return [];
    }
  }

  private async indexxTransactions(userLower: string, limit: number): Promise<Transaction[]> {
    try {
      return await this.walletTransactions.findPaginatedSkip(
        limit,
        0,
        { txDate: -1 },
        { email: userLower },
        {}
      );
    } catch (error) {
      console.error("[yays/wallet] could not read Indexx transactions", error);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Row mapping
  // -------------------------------------------------------------------------

  private fromLedger(entry: any): WalletTransactionView {
    const amount = num(entry.amount);
    return {
      id: String(entry._id || entry.id),
      type: amount >= 0 ? "reward" : "conversion",
      asset: INDEXX_POINTS_SYMBOL,
      amount: Math.abs(amount),
      counterparty: entry.activity || "YaysApp",
      createdAt: iso(entry.createdAt),
      status: entry.status === "reversed" ? "failed" : "completed",
      memo: entry.note || undefined,
    };
  }

  private fromChain(tx: any, userLower: string): WalletTransactionView {
    const from = String(tx.from || "").toLowerCase();
    const outgoing = from === userLower || String(tx.transactionType || "")
      .toUpperCase()
      .includes("WITHDRAW");
    return {
      id: String(tx._id || tx.txId || tx.orderId),
      type: outgoing ? "send" : "receive",
      asset: String(tx.currencyRef || "").toUpperCase() || "—",
      amount: Math.abs(num(tx.amount)),
      counterparty: String(outgoing ? tx.to : tx.from) || "Indexx",
      createdAt: iso(tx.txDate),
      status: txStatus(tx.status),
      memo: tx.info || tx.notes || undefined,
    };
  }
}

export const yaysWallet = new YaysWalletService();

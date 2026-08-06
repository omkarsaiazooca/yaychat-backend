import crypto from "crypto";
import { ServiceBase } from "./base";
import shoperpalBtcyCreditSchema, {
  ShoperPalBtcyCreditModel,
} from "../models/shoperpalBtcyCredit";
import { ShoperPalBtcyCredit } from "../data/shoperpalBtcyCredit";
import { UserService } from "./user.service";
import { TransactionService } from "./transaction.service";

const BTCY_ASSET = {
  assetSymbol: "BTCY",
  assetName: "Bitcoin-Yay Nuggets",
  network: "Ying Yang Chain",
  walletType: "ASSET_WALLET",
};

export type ShoperPalBtcyCreditPayload = {
  email: string;
  amount: number;
  assetSymbol?: string;
  assetName?: string;
  network?: string;
  walletType?: string;
  source: string;
  sourceOrderId?: string;
  sourceRewardId: string;
  rewardType: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

export class ShoperPalBtcyCreditService extends ServiceBase<
  ShoperPalBtcyCredit,
  ShoperPalBtcyCreditModel
> {
  private userService = new UserService();
  private transactionService = new TransactionService();

  constructor() {
    super(shoperpalBtcyCreditSchema, "ShoperPalBtcyCredit");
  }

  async credit(payload: ShoperPalBtcyCreditPayload) {
    const amount = Number(payload.amount);
    if (!payload.email) throw new Error("Email is required");
    if (!payload.sourceRewardId) throw new Error("sourceRewardId is required");
    if (!payload.idempotencyKey) throw new Error("idempotencyKey is required");
    if (!payload.source) throw new Error("source is required");
    if (!payload.rewardType) throw new Error("rewardType is required");
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }

    const existing = await this.findOne({ idempotencyKey: payload.idempotencyKey });
    if (existing) return this.toResponse(existing);

    const email = payload.email.toLowerCase();
    const assetSymbol = payload.assetSymbol || BTCY_ASSET.assetSymbol;
    const assetName = payload.assetName || BTCY_ASSET.assetName;
    const network = payload.network || BTCY_ASSET.network;
    const walletType = payload.walletType || BTCY_ASSET.walletType;

    const user = await this.userService.findOneSelect({ email }, { userWallets: 1, email: 1 });
    if (!user) throw new Error("Indexx user not found");

    const now = new Date();
    const wallet = ((user as any).userWallets || []).find(
      (w: any) => w.coinSymbol === assetSymbol && w.coinNetwork === network
    );

    if (!wallet) {
      await this.userService.updatePart(
        { email },
        {
          $push: {
            userWallets: {
              userId: String((user as any)._id || ""),
              coinType: walletType,
              coinWalletAddress: "",
              coinPrivateKey: "",
              coinNetwork: network,
              coinName: assetName,
              coinSymbol: assetSymbol,
              coinDecimals: 0,
              coinStakedBalance: 0,
              coinBalance: amount,
              coinBalanceInUSD: 0,
              coinBalanceInBTC: 0,
              coinCreatedOn: now,
              coinLastUsedOn: now,
              coinPrice: 0,
              coinPrevPrice: 0,
              isCoinActive: true,
              isImported: 0,
              notes: "Credited from ShoperPal shopper rewards",
              specialNotes: payload.source,
              amountInvested: 0,
            },
          },
        }
      );
    } else {
      await this.userService.updatePart(
        { email, "userWallets.coinSymbol": assetSymbol, "userWallets.coinNetwork": network },
        {
          $inc: { "userWallets.$.coinBalance": amount },
          $set: { "userWallets.$.coinLastUsedOn": now },
        }
      );
    }

    const updatedUser = await this.userService.findOneSelect({ email }, { userWallets: 1 });
    const updatedWallet = ((updatedUser as any)?.userWallets || []).find(
      (w: any) => w.coinSymbol === assetSymbol && w.coinNetwork === network
    );
    const balanceAfter = Number(updatedWallet?.coinBalance || 0);
    const transactionId = `shoperpal_${crypto.randomUUID()}`;

    await this.transactionService.create({
      orderId: payload.sourceOrderId || "",
      extRef: payload.idempotencyKey,
      txId: transactionId,
      from: "ShoperPal",
      to: email,
      amount,
      info: "ShoperPal Bitcoin-Yay Nuggets reward credit",
      status: "Completed" as any,
      currencyRef: assetSymbol,
      walletType,
      transactionType: payload.source,
      exchangeName: "Indexx",
      email,
      userWalletAddress: "",
      txDate: now,
      benificaryAddress: email,
      notes: JSON.stringify({
        sourceRewardId: payload.sourceRewardId,
        rewardType: payload.rewardType,
        network,
      }),
      amountInvested: 0,
      fees: 0,
      rate: 0,
    });

    const credit = await this.create({
      email,
      amount,
      assetSymbol,
      assetName,
      network,
      walletType,
      source: payload.source,
      sourceOrderId: payload.sourceOrderId,
      sourceRewardId: payload.sourceRewardId,
      rewardType: payload.rewardType,
      idempotencyKey: payload.idempotencyKey,
      walletTransactionId: transactionId,
      status: "CREDITED",
      balanceAfter,
      metadata: payload.metadata || {},
    });

    return this.toResponse(credit);
  }

  async getBalance(email: string) {
    const normalizedEmail = email.toLowerCase();
    const user = await this.userService.findOneSelect(
      { email: normalizedEmail },
      { userWallets: 1, email: 1 }
    );
    if (!user) throw new Error("Indexx user not found");

    const wallet = ((user as any).userWallets || []).find(
      (w: any) => w.coinSymbol === BTCY_ASSET.assetSymbol && w.coinNetwork === BTCY_ASSET.network
    );

    return {
      email: normalizedEmail,
      assetSymbol: BTCY_ASSET.assetSymbol,
      assetName: BTCY_ASSET.assetName,
      network: BTCY_ASSET.network,
      walletType: BTCY_ASSET.walletType,
      balance: Number(wallet?.coinBalance || 0),
    };
  }

  async getHistory(email: string, limit: number) {
    const normalizedEmail = email.toLowerCase();
    const rows = await this.findPaginated(
      Math.min(Math.max(limit || 50, 1), 100),
      { createdAt: -1 },
      { email: normalizedEmail },
      {}
    );

    return rows.map((row: any) => ({
      transactionId: row.walletTransactionId,
      amount: row.amount,
      source: row.source,
      sourceRewardId: row.sourceRewardId,
      sourceOrderId: row.sourceOrderId,
      rewardType: row.rewardType,
      createdAt: row.createdAt,
    }));
  }

  private toResponse(credit: any) {
    return {
      transactionId: credit.walletTransactionId,
      email: credit.email,
      assetSymbol: credit.assetSymbol,
      creditedAmount: credit.amount,
      balanceAfter: credit.balanceAfter,
      idempotencyKey: credit.idempotencyKey,
      status: credit.status,
    };
  }
}

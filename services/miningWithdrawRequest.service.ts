import { MiningService } from "./mining.service";
import { UserMiningBalanceService } from "./userMiningBalance.service";
import { UserService } from "./user.service";
import { Repository } from "../db/base";

import { WithdrawRequest } from "../data/miningWithdrawRequest";
import WithdrawRequestSchema from "../models/miningWithdrawRequest";
import { SendEmail } from "../platform/email.operations";

let miningService: MiningService = new MiningService();
let userMiningBalanceService: UserMiningBalanceService = new UserMiningBalanceService();
let userService: UserService = new UserService();

export class WithdrawService extends Repository<WithdrawRequest, any> {
  constructor() {
    super(WithdrawRequestSchema, "WithdrawRequest");
  }

  // Function to determine the withdrawable amount per vesting month
  getVestedAmount(month: number): number {
    const vestingSchedule = [100000, 150000, 200000, 200000, 200000, 150000];
    return vestingSchedule[month - 1] || 0;
  }

  async requestWithdrawal(
    email: string,
    amount: number,
    method: "Immediate" | "Vested" | "USDT" | "USDC" | "BTCY",
    destination: { walletAddress?: string; network?: string } = {}
  ): Promise<any> {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    // 1️⃣ Retrieve user's mining data
    let miningData = await miningService.findOne({ email: normalizedEmail, coinSymbol: "BTCY" });
    let miningBalance = await userMiningBalanceService.findOne({
      email: normalizedEmail,
      coinSymbol: "BTCY",
    });

    if (!miningData || !miningBalance) {
      return {
        status: 400,
        message: "No BTCY mining balance found.",
      };
    }

    const availableBalance = Number(miningBalance?.transferableBalance || 0);
    if (availableBalance < amount) {
      return {
        status: 400,
        message: "Insufficient available withdrawal balance.",
      };
    }

    // 2️⃣ Apply Withdrawal Fee
    let feePercentage = method === "Vested" || method === "BTCY" ? 0.03 : 0.1;
    let netAmount = amount - amount * feePercentage;

    // 3️⃣ Deduct from mining balance & create withdrawal request
    await miningService.updatePart(
      { email: normalizedEmail, coinSymbol: "BTCY" },
      { $inc: { totalMined: -amount } }
    );
    await userMiningBalanceService.updatePart(
      { email: normalizedEmail, coinSymbol: "BTCY" },
      { $inc: { transferableBalance: -amount } }
    );

    let withdrawal = await this.create({
      orderId: new Date().getTime().toString(), // Generate a unique orderId (timestamp-based)
      email: normalizedEmail,
      requestedAmount: amount,
      approvedAmount: netAmount,
      status: "Pending",
      withdrawalMethod: method,
      walletAddress: String(destination.walletAddress || "").trim(),
      network: String(destination.network || "").trim(),
      txHash: "",
      createdAt: new Date(), // Explicitly setting the creation time
    });

    // (Optional) Send email notification
    await new SendEmail().sendWithdrawRequestEmail(
      normalizedEmail,
      "User",
      amount,
      netAmount,
      method,
      withdrawal.orderId,
      "Pending Approval",
      {
        amountCurrency: "BTCY",
        walletAddress: destination.walletAddress,
        network: destination.network,
        subjectStatus: "Request",
      }
    );

    return {
      status: 200,
      message: "Withdrawal request submitted successfully",
      data: withdrawal,
    };
  }

  async requestAdRevenueWithdrawal(
    email: string,
    amountUsd: number,
    method: "USDT" | "USDC" | "BTCY",
    destination: { walletAddress?: string; network?: string; usdPerBtcy?: number | null } = {}
  ): Promise<any> {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return { status: 400, message: "email is required" };
    }
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return { status: 400, message: "amount must be greater than 0" };
    }

    // Validate against ad revenue balance only — never touch mining transferableBalance
    const miningBalance = await userMiningBalanceService.findOne({
      email: normalizedEmail,
      coinSymbol: "BTCY",
    });
    const adRevenueBalance = Number((miningBalance as any)?.adRevenueTransferableBalance || 0);
    const usdPerBtcy = Number(destination.usdPerBtcy || 0);
    const amountBtcy = usdPerBtcy > 0 ? amountUsd / usdPerBtcy : 0;

    if (adRevenueBalance < amountBtcy) {
      return { status: 400, message: "Insufficient ad revenue balance." };
    }

    // Deduct from ad revenue balance immediately
    await userMiningBalanceService.updatePart(
      { email: normalizedEmail, coinSymbol: "BTCY" },
      { $inc: { adRevenueTransferableBalance: -amountBtcy } }
    );

    const feePercentage = method === "BTCY" ? 0.03 : 0.1;
    const feeAmountUsd = amountUsd * feePercentage;
    const netAmountUsd = amountUsd - feeAmountUsd;
    const payoutAmount =
      method === "BTCY" && usdPerBtcy > 0
        ? netAmountUsd / usdPerBtcy
        : netAmountUsd;

    const isInstantBtcyTransfer = method === "BTCY";
    const now = new Date();
    const withdrawal = await this.create({
      orderId: new Date().getTime().toString(),
      email: normalizedEmail,
      requestedAmount: amountUsd,
      approvedAmount: netAmountUsd,
      requestedAmountUsd: amountUsd,
      approvedAmountUsd: netAmountUsd,
      requestedAmountBtcy: amountBtcy,
      payoutAmount,
      payoutCurrency: method,
      feeAmountUsd,
      feePercentage,
      source: "ad_revenue",
      status: isInstantBtcyTransfer ? "Approved" : "Pending",
      withdrawalMethod: method,
      walletAddress: String(destination.walletAddress || "").trim(),
      network: String(destination.network || "").trim(),
      txHash: "",
      createdAt: now,
      processedAt: isInstantBtcyTransfer ? now : undefined,
    });

    const emailRequestAmount = method === "BTCY" ? amountBtcy : amountUsd;
    const emailApprovedAmount = method === "BTCY" ? payoutAmount : netAmountUsd;
    await new SendEmail().sendWithdrawRequestEmail(
      normalizedEmail,
      "User",
      emailRequestAmount,
      emailApprovedAmount,
      method,
      withdrawal.orderId,
      isInstantBtcyTransfer ? "Approved" : "Pending Approval",
      {
        amountCurrency: method,
        walletAddress: destination.walletAddress,
        network: destination.network,
        subjectStatus: isInstantBtcyTransfer ? "Approved" : "Request",
      }
    );

    return {
      status: 200,
      message: "Withdrawal request submitted successfully",
      data: withdrawal,
    };
  }

  async processWithdrawal(requestId: string, txHash: string): Promise<any> {
    const request = await this.findOne({ _id: requestId, status: "Pending" });
    if (!request) {
      return { status: 404, message: "No pending withdrawal request found." };
    }

    const email = String(request.email || "").trim().toLowerCase();
    const source = String((request as any).source || "mining_balance");

    if (source === "ad_revenue") {
      // BTCY ad-revenue withdrawals are credited immediately on request submit.
      // USDT/USDC are off-chain transfers handled externally; approval only records completion.
      await userMiningBalanceService.updatePart(
        { email, coinSymbol: "BTCY" },
        { $inc: { migratedBalance: Number((request as any).requestedAmountBtcy || 0) } }
      );
    } else {
      // Mining balance: requestedAmount and approvedAmount are in BTCY
      await userService.updatePart(
        { email, "userWallets.coinSymbol": "BTCY" },
        { $inc: { "userWallets.$.coinBalance": request.approvedAmount } }
      );
      await userMiningBalanceService.updatePart(
        { email, coinSymbol: "BTCY" },
        { $inc: { migratedBalance: request.requestedAmount } }
      );
    }

    await this.updatePart(
      { _id: requestId },
      { $set: { status: "Approved", processedAt: new Date(), txHash } }
    );

    const emailCurrency = source === "ad_revenue"
      ? String((request as any).payoutCurrency || request.withdrawalMethod || "BTCY")
      : "BTCY";
    const emailRequestAmount = source === "ad_revenue" && emailCurrency === "BTCY"
      ? Number((request as any).requestedAmountBtcy ?? request.requestedAmount ?? 0)
      : Number((request as any).requestedAmount ?? 0);
    const emailApprovedAmount = source === "ad_revenue" && emailCurrency === "BTCY"
      ? Number((request as any).payoutAmount ?? request.approvedAmount ?? 0)
      : Number((request as any).approvedAmount ?? 0);
    await new SendEmail().sendWithdrawRequestEmail(
      email,
      "User",
      emailRequestAmount,
      emailApprovedAmount,
      String(request.withdrawalMethod || emailCurrency),
      String(request.orderId || requestId),
      "Approved",
      {
        amountCurrency: emailCurrency,
        walletAddress: (request as any).walletAddress,
        network: (request as any).network,
        txHash,
        subjectStatus: "Approved",
        bodyMessage: "Your Bitcoin Yay Mining Station withdrawal has been approved. Below are the details:",
      }
    );

    return {
      status: 200,
      message: "Withdrawal approved successfully",
      data: { requestId, txHash },
    };
  }

  async rejectWithdrawal(requestId: string, reason?: string): Promise<any> {
    const request = await this.findOne({ _id: requestId, status: "Pending" });
    if (!request) {
      return { status: 404, message: "No pending withdrawal request found." };
    }

    const email = String(request.email || "").trim().toLowerCase();
    const source = String((request as any).source || "mining_balance");

    // Restore the deducted balance
    if (source === "ad_revenue") {
      const btcyToRestore = Number((request as any).requestedAmountBtcy || 0);
      if (btcyToRestore > 0) {
        await userMiningBalanceService.updatePart(
          { email, coinSymbol: "BTCY" },
          { $inc: { adRevenueTransferableBalance: btcyToRestore } }
        );
      }
    } else {
      await userMiningBalanceService.updatePart(
        { email, coinSymbol: "BTCY" },
        { $inc: { transferableBalance: request.requestedAmount } }
      );
      await miningService.updatePart(
        { email, coinSymbol: "BTCY" },
        { $inc: { totalMined: request.requestedAmount } }
      );
    }

    await this.updatePart(
      { _id: requestId },
      { $set: { status: "Rejected", processedAt: new Date(), txHash: reason || "" } }
    );

    const emailCurrency = source === "ad_revenue"
      ? String((request as any).payoutCurrency || request.withdrawalMethod || "BTCY")
      : "BTCY";
    const emailRequestAmount = source === "ad_revenue" && emailCurrency === "BTCY"
      ? Number((request as any).requestedAmountBtcy ?? request.requestedAmount ?? 0)
      : Number((request as any).requestedAmount ?? 0);
    const emailApprovedAmount = source === "ad_revenue" && emailCurrency === "BTCY"
      ? Number((request as any).payoutAmount ?? request.approvedAmount ?? 0)
      : Number((request as any).approvedAmount ?? 0);
    await new SendEmail().sendWithdrawRequestEmail(
      email,
      "User",
      emailRequestAmount,
      emailApprovedAmount,
      String(request.withdrawalMethod || emailCurrency),
      String(request.orderId || requestId),
      "Rejected",
      {
        amountCurrency: emailCurrency,
        walletAddress: (request as any).walletAddress,
        network: (request as any).network,
        reason,
        subjectStatus: "Rejected",
        bodyMessage: "Your Bitcoin Yay Mining Station withdrawal was rejected. Below are the details:",
      }
    );

    return {
      status: 200,
      message: "Withdrawal rejected and balance restored",
      data: { requestId },
    };
  }
}

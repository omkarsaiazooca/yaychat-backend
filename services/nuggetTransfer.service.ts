import { v4 as uuidv4 } from "uuid";
import mongo from "../db/connection";
import { Repository } from "../db/base";
import { NuggetTransfer } from "../data/nuggetTransfer";
import NuggetTransferSchema from "../models/nuggetTransfer";
import { SendEmail } from "../platform/email.operations";
import { adRevenueCreditingService } from "./adRevenueCrediting.service";
import { UserService } from "./user.service";

const MIN_TRANSFER_NUGGETS = 5000;
const MIN_STATION_REFERRALS = 5;
const REQUIRED_TRANSFER_ADS = 5;
const TRANSFER_AD_WINDOW_MS = 30 * 60 * 1000;
const COIN_SYMBOL = "BTCY";
const COIN_NAME = "Bitcoin Yay";
const COIN_NETWORK = "Stellar";

const normalizeEmail = (value: any) => String(value || "").trim().toLowerCase();
const normalizeTransferSource = (value: any): "mined" | "withdrawn" =>
  String(value || "mined").trim().toLowerCase() === "withdrawn" ? "withdrawn" : "mined";
const normalizeTransferClient = (value: any): "mobile" | "web" =>
  String(value || "mobile").trim().toLowerCase() === "web" ? "web" : "mobile";

const roundNuggets = (value: number) => Math.round(Number(value || 0) * 100000) / 100000;
const createTransferAdKey = (
  senderEmail: string,
  recipientEmail: string,
  amount: number,
  source: "mined" | "withdrawn"
) => `${senderEmail}:${recipientEmail}:${roundNuggets(amount)}:${source}`;
const getTransferAdCutoff = () => new Date(Date.now() - TRANSFER_AD_WINDOW_MS);

const isKycVerified = (user: any) => {
  const status = String(user?.kycStatus || "").trim().toLowerCase();
  return (
    user?.isKYCPass === true ||
    status === "completed" ||
    status === "complete" ||
    status === "approved" ||
    status === "verified"
  );
};

export class NuggetTransferService extends Repository<NuggetTransfer, any> {
  private userService = new UserService();
  private emailService = new SendEmail();

  constructor() {
    super(NuggetTransferSchema, "nuggetTransfer");
  }

  private async validateStationOwner(sender: any) {
    if (!isKycVerified(sender)) {
      return "Sender account must be KYC verified.";
    }

    const referralCode = String(sender?.referralCode || "").trim();
    if (!referralCode) {
      return "Only the Mining Station owner can transfer Nuggets.";
    }

    const referralCount = await this.userService.findCount({ referralCodeUsed: referralCode });
    if (referralCount < MIN_STATION_REFERRALS) {
      return `Only Mining Station owners with at least ${MIN_STATION_REFERRALS} referrals can transfer Nuggets.`;
    }

    return null;
  }

  async submitTransfer(params: {
    authEmail: string;
    senderEmail: string;
    recipientEmail: string;
    amount: number;
    source?: "mined" | "withdrawn";
    client?: "mobile" | "web";
    idempotencyKey?: string;
  }) {
    const authEmail = normalizeEmail(params.authEmail);
    const senderEmail = normalizeEmail(params.senderEmail);
    const recipientEmail = normalizeEmail(params.recipientEmail);
    const amount = roundNuggets(Number(params.amount));
    const source = normalizeTransferSource(params.source);
    const client = normalizeTransferClient(params.client);
    const idempotencyKey = String(params.idempotencyKey || "").trim();

    if (!authEmail) {
      return { status: 401, data: { message: "Authentication required." } };
    }
    if (!senderEmail) {
      return { status: 400, data: { message: "senderEmail is required." } };
    }
    if (!recipientEmail) {
      return { status: 400, data: { message: "recipientEmail is required." } };
    }
    if (authEmail !== senderEmail) {
      return { status: 403, data: { message: "Authenticated user must match senderEmail." } };
    }
    if (senderEmail === recipientEmail) {
      return { status: 400, data: { message: "You cannot transfer Nuggets to your own account." } };
    }
    if (!Number.isFinite(amount) || amount < MIN_TRANSFER_NUGGETS) {
      return { status: 400, data: { message: `Minimum transfer is ${MIN_TRANSFER_NUGGETS} Nuggets.` } };
    }

    if (idempotencyKey) {
      const existing = await this.findOne({ senderEmail, idempotencyKey });
      if (existing) {
        return {
          status: 200,
          data: this.mapTransfer(existing, senderEmail),
        };
      }
    }

    const [sender, recipient] = await Promise.all([
      this.userService.findOneSelect(
        { email: senderEmail },
        { email: 1, referralCode: 1, kycStatus: 1, isKYCPass: 1 }
      ),
      this.userService.findOneSelect(
        { email: recipientEmail },
        { email: 1, referralCodeUsed: 1, kycStatus: 1, isKYCPass: 1 }
      ),
    ]);

    if (!sender) {
      return { status: 404, data: { message: "Sender account not found." } };
    }
    if (!recipient) {
      return { status: 404, data: { message: "Recipient account not found." } };
    }

    const stationOwnerError = await this.validateStationOwner(sender);
    if (stationOwnerError) {
      return { status: 403, data: { message: stationOwnerError } };
    }
    const senderReferralCode = String((sender as any)?.referralCode || "").trim();
    const recipientReferralCodeUsed = String((recipient as any)?.referralCodeUsed || "").trim();
    if (!senderReferralCode || recipientReferralCodeUsed !== senderReferralCode) {
      return {
        status: 403,
        data: { message: "Recipient must be one of the sender's direct referrals." },
      };
    }
    if (!isKycVerified(recipient)) {
      return { status: 403, data: { message: "Recipient account must be KYC verified." } };
    }

    const adCollection = mongo.primary.connection.collection("nuggetTransferAdWatch");
    const adKey = createTransferAdKey(senderEmail, recipientEmail, amount, source);
    if (client !== "web") {
      const adWatchCount = await adCollection.countDocuments({
        senderEmail,
        transferAdKey: adKey,
        status: "completed",
        consumedAt: { $exists: false },
        createdAt: { $gte: getTransferAdCutoff() },
      });
      if (adWatchCount < REQUIRED_TRANSFER_ADS) {
        return {
          status: 403,
          data: {
            message: `Please watch ${REQUIRED_TRANSFER_ADS} rewarded ads before transferring Nuggets.`,
            requiredAds: REQUIRED_TRANSFER_ADS,
            watchedAds: adWatchCount,
          },
        };
      }
    }

    const session = await mongo.primary.startSession();

    try {
      let createdTransfer: any = null;

      await session.withTransaction(async () => {
        const balanceCollection = mongo.primary.connection.collection("userMiningBalance");
        const miningCollection = mongo.primary.connection.collection("Mining");
        const userCollection = mongo.primary.connection.collection("User");
        const transferCollection = mongo.primary.connection.collection("nuggetTransfer");

        const recipientBalance = await balanceCollection.findOne(
          { email: recipientEmail, coinSymbol: COIN_SYMBOL },
          { session }
        );
        const recipientBalanceBefore = roundNuggets(Number(recipientBalance?.transferableBalance || 0));

        let senderSourceBalanceBefore = 0;
        let senderSourceBalanceAfter = 0;
        let senderTotalMinedBefore = 0;
        let senderTotalMinedAfter = 0;
        let recipientTotalMinedBefore = 0;
        let recipientTotalMinedAfter = 0;

        const senderMiningForAudit = await miningCollection.findOne(
          { email: senderEmail, coinSymbol: COIN_SYMBOL },
          { session }
        );
        senderTotalMinedBefore = roundNuggets(Number(senderMiningForAudit?.totalMined || 0));
        senderTotalMinedAfter = senderTotalMinedBefore;

        if (source === "mined") {
          const senderBalance = await balanceCollection.findOne(
            { email: senderEmail, coinSymbol: COIN_SYMBOL },
            { session }
          );
          senderSourceBalanceBefore = roundNuggets(Number(senderBalance?.transferableBalance || 0));

          if (senderSourceBalanceBefore < amount) {
            throw new Error("Insufficient mined Nugget balance.");
          }
          if (senderTotalMinedBefore < amount) {
            throw new Error("Insufficient mined Nugget balance.");
          }

          const debitResult = await balanceCollection.updateOne(
            {
              email: senderEmail,
              coinSymbol: COIN_SYMBOL,
              transferableBalance: { $gte: amount },
            },
            {
              $inc: { transferableBalance: -amount },
            },
            { session }
          );

          if (debitResult.modifiedCount !== 1) {
            throw new Error("Insufficient mined Nugget balance.");
          }

          const miningDebitResult = await miningCollection.updateOne(
            {
              email: senderEmail,
              coinSymbol: COIN_SYMBOL,
              totalMined: { $gte: amount },
            },
            {
              $inc: { totalMined: -amount },
            },
            { session }
          );

          if (miningDebitResult.modifiedCount !== 1) {
            throw new Error("Insufficient mined Nugget balance.");
          }

          senderSourceBalanceAfter = roundNuggets(senderSourceBalanceBefore - amount);
          senderTotalMinedAfter = roundNuggets(senderTotalMinedBefore - amount);
        } else {
          const senderWalletDoc = await userCollection.findOne(
            {
              email: senderEmail,
              userWallets: {
                $elemMatch: {
                  coinNetwork: COIN_NETWORK,
                  coinSymbol: COIN_SYMBOL,
                  coinBalance: { $gte: amount },
                },
              },
            },
            { projection: { userWallets: 1 }, session }
          );
          const senderWallet = (senderWalletDoc?.userWallets || []).find(
            (wallet: any) =>
              wallet?.coinNetwork === COIN_NETWORK &&
              wallet?.coinSymbol === COIN_SYMBOL &&
              Number(wallet?.coinBalance || 0) >= amount
          );

          senderSourceBalanceBefore = roundNuggets(Number(senderWallet?.coinBalance || 0));
          if (!senderWallet || senderSourceBalanceBefore < amount) {
            throw new Error("Insufficient withdrawn Stellar wallet Nugget balance.");
          }

          const walletDebitResult = await userCollection.updateOne(
            { email: senderEmail },
            {
              $inc: { "userWallets.$[wallet].coinBalance": -amount },
              $set: { "userWallets.$[wallet].coinLastUsedOn": new Date() },
            },
            {
              session,
              arrayFilters: [
                {
                  "wallet.coinSymbol": COIN_SYMBOL,
                  "wallet.coinNetwork": COIN_NETWORK,
                  "wallet.coinBalance": { $gte: amount },
                },
              ],
            }
          );

          if (walletDebitResult.modifiedCount !== 1) {
            throw new Error("Insufficient withdrawn Stellar wallet Nugget balance.");
          }

          senderSourceBalanceAfter = roundNuggets(senderSourceBalanceBefore - amount);
        }

        const recipientMining = await miningCollection.findOne(
          { email: recipientEmail, coinSymbol: COIN_SYMBOL },
          { session }
        );
        recipientTotalMinedBefore = roundNuggets(Number(recipientMining?.totalMined || 0));
        recipientTotalMinedAfter = roundNuggets(recipientTotalMinedBefore + amount);

        await balanceCollection.updateOne(
          { email: recipientEmail, coinSymbol: COIN_SYMBOL },
          {
            $inc: { transferableBalance: amount },
            $setOnInsert: {
              email: recipientEmail,
              migratedBalance: 0,
              unverifiedBalance: 0,
              adRevenueTransferableBalance: 0,
              createdAt: new Date(),
              coinSymbol: COIN_SYMBOL,
              coinName: COIN_NAME,
              coinNetwork: COIN_NETWORK,
            },
          },
          { upsert: true, session }
        );

        await miningCollection.updateOne(
          { email: recipientEmail, coinSymbol: COIN_SYMBOL },
          {
            $inc: { totalMined: amount },
            $setOnInsert: {
              email: recipientEmail,
              coinSymbol: COIN_SYMBOL,
              miningPlan: "free",
              miningRate: 0,
              isMiningActive: false,
            },
          },
          { upsert: true, session }
        );

        const now = new Date();
        const doc = {
          transactionId: `NGT-${uuidv4()}`,
          senderEmail,
          recipientEmail,
          amount,
          asset: "BTCY_NUGGET",
          source,
          client,
          status: "completed",
          ...(idempotencyKey ? { idempotencyKey } : {}),
          senderSourceBalanceBefore,
          senderSourceBalanceAfter,
          senderBalanceBefore: senderSourceBalanceBefore,
          senderBalanceAfter: senderSourceBalanceAfter,
          recipientBalanceBefore,
          recipientBalanceAfter: roundNuggets(recipientBalanceBefore + amount),
          senderTotalMinedBefore,
          senderTotalMinedAfter,
          recipientTotalMinedBefore,
          recipientTotalMinedAfter,
          createdAt: now,
          completedAt: now,
        };

        const insertResult = await transferCollection.insertOne(doc, { session });
        createdTransfer = { _id: insertResult.insertedId, ...doc };

        if (client !== "web") {
          await adCollection.updateMany(
            {
              senderEmail,
              transferAdKey: adKey,
              status: "completed",
              consumedAt: { $exists: false },
              createdAt: { $gte: getTransferAdCutoff() },
            },
            {
              $set: {
                consumedAt: now,
                consumedByTransactionId: doc.transactionId,
              },
            },
            { session }
          );
        }
      });

      await this.sendTransferSuccessEmails(createdTransfer);

      return {
        status: 200,
        data: this.mapTransfer(createdTransfer, senderEmail),
      };
    } catch (error: any) {
      const message = error?.message || "Failed to submit Nugget transfer.";
      if (idempotencyKey && String(error?.code) === "11000") {
        const existing = await this.findOne({ senderEmail, idempotencyKey });
        if (existing) {
          return { status: 200, data: this.mapTransfer(existing, senderEmail) };
        }
      }
      const status = message.toLowerCase().includes("insufficient") ? 400 : 500;
      return { status, data: { message } };
    } finally {
      await session.endSession();
    }
  }

  async getTransferHistory(emailInput: string, requesterEmailInput: string) {
    const email = normalizeEmail(emailInput);
    const requesterEmail = normalizeEmail(requesterEmailInput);

    if (!requesterEmail) {
      return { status: 401, data: { message: "Authentication required." } };
    }
    if (!email) {
      return { status: 400, data: { message: "email is required." } };
    }
    if (email !== requesterEmail) {
      return { status: 403, data: { message: "Forbidden." } };
    }

    const transfers = await this.findPaginatedSkip(
      100,
      0,
      { createdAt: -1 },
      {
        $or: [{ senderEmail: email }, { recipientEmail: email }],
      },
      {}
    );

    return {
      status: 200,
      data: {
        transfers: transfers.map((transfer: any) => this.mapTransfer(transfer, email)),
      },
    };
  }

  async logTransferAdWatch(params: {
    authEmail: string;
    senderEmail: string;
    recipientEmail: string;
    amount: number;
    source?: "mined" | "withdrawn";
    adId: string;
    watchId: string;
    secondsWatched?: number;
  }) {
    const authEmail = normalizeEmail(params.authEmail);
    const senderEmail = normalizeEmail(params.senderEmail);
    const recipientEmail = normalizeEmail(params.recipientEmail);
    const amount = roundNuggets(Number(params.amount));
    const source = normalizeTransferSource(params.source);
    const adId = String(params.adId || "").trim();
    const watchId = String(params.watchId || "").trim();
    const secondsWatched = Number(params.secondsWatched || 0);

    if (!authEmail) {
      return { status: 401, data: { message: "Authentication required." } };
    }
    if (!senderEmail || authEmail !== senderEmail) {
      return { status: 403, data: { message: "Authenticated user must match senderEmail." } };
    }
    if (!recipientEmail) {
      return { status: 400, data: { message: "recipientEmail is required." } };
    }
    if (!Number.isFinite(amount) || amount < MIN_TRANSFER_NUGGETS) {
      return { status: 400, data: { message: `Minimum transfer is ${MIN_TRANSFER_NUGGETS} Nuggets.` } };
    }
    if (!adId || !watchId) {
      return { status: 400, data: { message: "adId and watchId are required." } };
    }

    const transferAdKey = createTransferAdKey(senderEmail, recipientEmail, amount, source);
    const collection = mongo.primary.connection.collection("nuggetTransferAdWatch");
    await collection.createIndex({ senderEmail: 1, watchId: 1 }, { unique: true, background: true });
    await collection.createIndex({ senderEmail: 1, transferAdKey: 1 }, { background: true });
    await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + TRANSFER_AD_WINDOW_MS);
    const result = await collection.updateOne(
      { senderEmail, watchId },
      {
        $setOnInsert: {
          senderEmail,
          recipientEmail,
          amount,
          source,
          transferAdKey,
          adId,
          watchId,
          secondsWatched: Number.isFinite(secondsWatched) ? secondsWatched : 0,
          status: "completed",
          watchedAt: now,
          createdAt: now,
          expiresAt,
        },
      },
      { upsert: true }
    );

    if (result.upsertedCount === 1) {
      adRevenueCreditingService.creditAdWatch(senderEmail, "rewarded").catch(() => {});
    }

    const watchedAds = await collection.countDocuments({
      senderEmail,
      transferAdKey,
      status: "completed",
      consumedAt: { $exists: false },
      createdAt: { $gte: getTransferAdCutoff() },
    });

    return {
      status: 200,
      data: {
        transferAdKey,
        watchedAds: Math.min(watchedAds, REQUIRED_TRANSFER_ADS),
        requiredAds: REQUIRED_TRANSFER_ADS,
        alreadyCounted: result.upsertedCount !== 1,
        expiresAt,
        expiresInSeconds: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
      },
    };
  }

  async getTransferAdStatus(params: {
    authEmail: string;
    senderEmail: string;
    recipientEmail: string;
    amount: number;
    source?: "mined" | "withdrawn";
  }) {
    const authEmail = normalizeEmail(params.authEmail);
    const senderEmail = normalizeEmail(params.senderEmail);
    const recipientEmail = normalizeEmail(params.recipientEmail);
    const amount = roundNuggets(Number(params.amount));
    const source = normalizeTransferSource(params.source);

    if (!authEmail) {
      return { status: 401, data: { message: "Authentication required." } };
    }
    if (!senderEmail || authEmail !== senderEmail) {
      return { status: 403, data: { message: "Authenticated user must match senderEmail." } };
    }
    if (!recipientEmail) {
      return { status: 400, data: { message: "recipientEmail is required." } };
    }
    if (!Number.isFinite(amount) || amount < MIN_TRANSFER_NUGGETS) {
      return { status: 400, data: { message: `Minimum transfer is ${MIN_TRANSFER_NUGGETS} Nuggets.` } };
    }

    const transferAdKey = createTransferAdKey(senderEmail, recipientEmail, amount, source);
    const collection = mongo.primary.connection.collection("nuggetTransferAdWatch");
    const query = {
      senderEmail,
      transferAdKey,
      status: "completed",
      consumedAt: { $exists: false },
      createdAt: { $gte: getTransferAdCutoff() },
    };
    const [watchedAds, latest] = await Promise.all([
      collection.countDocuments(query),
      collection.find(query).sort({ expiresAt: -1 }).limit(1).next(),
    ]);

    const expiresAt = latest?.expiresAt || null;
    return {
      status: 200,
      data: {
        transferAdKey,
        watchedAds: Math.min(watchedAds, REQUIRED_TRANSFER_ADS),
        requiredAds: REQUIRED_TRANSFER_ADS,
        expiresAt,
        expiresInSeconds: expiresAt
          ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
          : 0,
      },
    };
  }

  private mapTransfer(transfer: any, viewerEmail: string) {
    const senderEmail = normalizeEmail(transfer?.senderEmail);
    const recipientEmail = normalizeEmail(transfer?.recipientEmail);
    const direction = viewerEmail && viewerEmail === recipientEmail ? "received" : "sent";
    const counterpartyEmail = direction === "received" ? senderEmail : recipientEmail;

    return {
      id: String(transfer?._id || ""),
      transactionId: String(transfer?.transactionId || ""),
      direction,
      counterpartyName: counterpartyEmail,
      counterpartyEmail,
      senderEmail,
      recipientEmail,
      amount: Number(transfer?.amount || 0),
      asset: transfer?.asset || "BTCY_NUGGET",
      source: transfer?.source || "mined",
      client: transfer?.client || "mobile",
      status: transfer?.status || "completed",
      senderSourceBalanceBefore: Number(transfer?.senderSourceBalanceBefore ?? transfer?.senderBalanceBefore ?? 0),
      senderSourceBalanceAfter: Number(transfer?.senderSourceBalanceAfter ?? transfer?.senderBalanceAfter ?? 0),
      senderBalanceBefore: Number(transfer?.senderBalanceBefore || 0),
      senderBalanceAfter: Number(transfer?.senderBalanceAfter || 0),
      recipientBalanceBefore: Number(transfer?.recipientBalanceBefore || 0),
      recipientBalanceAfter: Number(transfer?.recipientBalanceAfter || 0),
      senderTotalMinedBefore: Number(transfer?.senderTotalMinedBefore || 0),
      senderTotalMinedAfter: Number(transfer?.senderTotalMinedAfter || 0),
      recipientTotalMinedBefore: Number(transfer?.recipientTotalMinedBefore || 0),
      recipientTotalMinedAfter: Number(transfer?.recipientTotalMinedAfter || 0),
      createdAt: transfer?.createdAt,
      completedAt: transfer?.completedAt,
    };
  }

  private async sendTransferSuccessEmails(transfer: any) {
    if (!transfer?.senderEmail || !transfer?.recipientEmail) {
      return;
    }

    try {
      await Promise.allSettled([
        this.emailService.sendNuggetTransferSuccessEmail({
          toEmail: transfer.senderEmail,
          direction: "sent",
          counterpartyEmail: transfer.recipientEmail,
          amount: Number(transfer.amount || 0),
          source: transfer.source || "mined",
          transactionId: String(transfer.transactionId || ""),
          completedAt: transfer.completedAt || transfer.createdAt,
        }),
        this.emailService.sendNuggetTransferSuccessEmail({
          toEmail: transfer.recipientEmail,
          direction: "received",
          counterpartyEmail: transfer.senderEmail,
          amount: Number(transfer.amount || 0),
          source: transfer.source || "mined",
          transactionId: String(transfer.transactionId || ""),
          completedAt: transfer.completedAt || transfer.createdAt,
        }),
      ]);
    } catch (error) {
      console.error("Failed to send Nugget transfer success emails:", error);
    }
  }
}

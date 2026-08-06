import axios from "axios";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { OrderStatus } from "../data/order";
import { MiningService } from "./mining.service";
import { OrderService } from "./order.service";
import { SubscriptionPlansService } from "./miningSubscriptionPlan.service";
import { SubscriptionService } from "./subscription.service";

const COIN_SYMBOL = "BTCY";
export const DEFAULT_GOOGLE_PLAY_PACKAGE_NAME =
  process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.yaysapp";

const GOOGLE_PLAY_KEY_PATH = path.resolve(
  __dirname,
  "../credentials/google-play-service-account.json"
);
const GOOGLE_PLAY_AUTH_SCOPES = [
  "https://www.googleapis.com/auth/androidpublisher",
];

type PubSubMessage = {
  data?: string;
  messageId?: string;
  publishTime?: string;
  attributes?: Record<string, string>;
};

export type GooglePlayRtdnEnvelope = {
  message?: PubSubMessage;
  subscription?: string;
};

type GooglePlaySubscriptionNotification = {
  version?: string;
  notificationType?: number;
  purchaseToken?: string;
};

type GooglePlayDeveloperNotification = {
  version?: string;
  packageName?: string;
  eventTimeMillis?: string;
  subscriptionNotification?: GooglePlaySubscriptionNotification;
  oneTimeProductNotification?: Record<string, unknown>;
  voidedPurchaseNotification?: Record<string, unknown>;
  testNotification?: Record<string, unknown>;
};

type GooglePlayAutoRenewingPlan = {
  autoRenewEnabled?: boolean;
};

type GooglePlaySubscriptionLineItem = {
  productId?: string;
  expiryTime?: string;
  autoRenewingPlan?: GooglePlayAutoRenewingPlan;
};

export type GooglePlaySubscriptionPurchaseV2 = {
  startTime?: string;
  subscriptionState?: string;
  latestOrderId?: string;
  linkedPurchaseToken?: string;
  acknowledgementState?: string;
  lineItems?: GooglePlaySubscriptionLineItem[];
};

type SyncAction = "active" | "ending" | "inactive" | "ignored" | "not_found";

export type GooglePlaySyncResult = {
  action: SyncAction;
  message: string;
  source: string;
  packageName?: string | null;
  purchaseToken?: string | null;
  messageId?: string | null;
  googleState?: string | null;
  notificationType?: number | null;
  orderId?: string | null;
  email?: string | null;
  hasAccess?: boolean | null;
  startDate?: Date | null;
  endDate?: Date | null;
  productId?: string | null;
  autoRenewEnabled?: boolean | null;
};

type SyncParams = {
  packageName: string;
  purchaseToken: string;
  source: string;
  notificationType?: number | null;
  occurredAt?: Date | null;
};

type NormalizedGooglePlayState = {
  googleState: string;
  startDate: Date | null;
  endDate: Date | null;
  productId: string | null;
  autoRenewEnabled: boolean | null;
  hasAccess: boolean;
  action: Exclude<SyncAction, "ignored" | "not_found">;
  orderStatus: string;
  subscriptionStatus: string;
  cancelledAt: Date | null;
};

function maskPurchaseToken(token?: string | null): string {
  const value = String(token || "").trim();
  if (!value) return "missing";
  if (value.length <= 8) return value;
  return `...${value.slice(-8)}`;
}

function parseDateValue(value: unknown): Date | null {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const rawValue = String(value).trim();
  if (!rawValue) return null;

  const numericValue = Number(rawValue);
  const date = Number.isFinite(numericValue)
    ? new Date(numericValue)
    : new Date(rawValue);

  return Number.isNaN(date.getTime()) ? null : date;
}

function maxExpiryDate(lineItems?: GooglePlaySubscriptionLineItem[]): Date | null {
  const dates = (lineItems || [])
    .map((item) => parseDateValue(item.expiryTime))
    .filter((value): value is Date => value instanceof Date);

  if (!dates.length) return null;

  return dates.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest
  );
}

function firstLineItem(lineItems?: GooglePlaySubscriptionLineItem[]) {
  return Array.isArray(lineItems) && lineItems.length > 0 ? lineItems[0] : undefined;
}

function normalizeGooglePlayState(
  subscription: GooglePlaySubscriptionPurchaseV2,
  occurredAt?: Date | null
): NormalizedGooglePlayState {
  const now = new Date();
  const state = String(
    subscription.subscriptionState || "SUBSCRIPTION_STATE_UNSPECIFIED"
  );
  const item = firstLineItem(subscription.lineItems);
  const endDate = maxExpiryDate(subscription.lineItems);
  const startDate = parseDateValue(subscription.startTime);
  const autoRenewEnabled =
    typeof item?.autoRenewingPlan?.autoRenewEnabled === "boolean"
      ? item.autoRenewingPlan.autoRenewEnabled
      : null;
  const productId = item?.productId ? String(item.productId) : null;

  const fallbackHasAccess = !!endDate && endDate.getTime() > now.getTime();

  switch (state) {
    case "SUBSCRIPTION_STATE_ACTIVE":
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return {
        googleState: state,
        startDate,
        endDate,
        productId,
        autoRenewEnabled,
        hasAccess: true,
        action: "active",
        orderStatus: OrderStatus.Completed,
        subscriptionStatus: "Active",
        cancelledAt: null,
      };
    case "SUBSCRIPTION_STATE_CANCELED":
      return {
        googleState: state,
        startDate,
        endDate,
        productId,
        autoRenewEnabled,
        hasAccess: fallbackHasAccess,
        action: fallbackHasAccess ? "ending" : "inactive",
        orderStatus: fallbackHasAccess
          ? OrderStatus.Completed
          : OrderStatus.OrderCancelled,
        subscriptionStatus: fallbackHasAccess ? "Active" : "Cancelled",
        cancelledAt: occurredAt ?? now,
      };
    case "SUBSCRIPTION_STATE_PAUSED":
    case "SUBSCRIPTION_STATE_ON_HOLD":
    case "SUBSCRIPTION_STATE_PENDING":
    case "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED":
      return {
        googleState: state,
        startDate,
        endDate,
        productId,
        autoRenewEnabled,
        hasAccess: false,
        action: "inactive",
        orderStatus: OrderStatus.OrderCancelled,
        subscriptionStatus: "Cancelled",
        cancelledAt: occurredAt ?? now,
      };
    case "SUBSCRIPTION_STATE_EXPIRED":
      return {
        googleState: state,
        startDate,
        endDate,
        productId,
        autoRenewEnabled,
        hasAccess: false,
        action: "inactive",
        orderStatus: OrderStatus.OrderCancelled,
        subscriptionStatus: "Expired",
        cancelledAt: occurredAt ?? endDate ?? now,
      };
    default:
      return {
        googleState: state,
        startDate,
        endDate,
        productId,
        autoRenewEnabled,
        hasAccess: fallbackHasAccess,
        action: fallbackHasAccess ? "active" : "inactive",
        orderStatus: fallbackHasAccess
          ? OrderStatus.Completed
          : OrderStatus.OrderCancelled,
        subscriptionStatus: fallbackHasAccess ? "Active" : "Cancelled",
        cancelledAt: fallbackHasAccess ? null : occurredAt ?? now,
      };
  }
}

function decodePubSubData(data: string): GooglePlayDeveloperNotification {
  const decoded = Buffer.from(data, "base64").toString("utf8");
  return JSON.parse(decoded) as GooglePlayDeveloperNotification;
}

export async function getGooglePlayAccessToken(): Promise<string> {
  const keyFile = JSON.parse(fs.readFileSync(GOOGLE_PLAY_KEY_PATH, "utf-8"));
  const jwtClient = new google.auth.JWT(
    keyFile.client_email,
    undefined,
    keyFile.private_key,
    GOOGLE_PLAY_AUTH_SCOPES
  );

  await jwtClient.authorize();
  const accessToken = await jwtClient.getAccessToken();

  if (!accessToken.token) {
    throw new Error("Google Play access token was empty");
  }

  return accessToken.token;
}

export async function fetchGooglePlaySubscriptionPurchaseV2(
  packageName: string,
  purchaseToken: string,
  accessToken: string
): Promise<GooglePlaySubscriptionPurchaseV2 | null> {
  try {
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptionsv2/tokens/${purchaseToken}`;
    const response = await axios.get<GooglePlaySubscriptionPurchaseV2>(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  } catch (error: unknown) {
    const err = error as {
      response?: { status?: number };
      message?: string;
    };
    const status = err?.response?.status;
    if (status === 404 || status === 410) {
      return null;
    }
    throw error;
  }
}

export class GooglePlaySubscriptionSyncService {
  private readonly orderService = new OrderService();
  private readonly subscriptionService = new SubscriptionService();
  private readonly miningService = new MiningService();
  private readonly subscriptionPlansService = new SubscriptionPlansService();

  async handleRtdnEnvelope(
    envelope: GooglePlayRtdnEnvelope
  ): Promise<GooglePlaySyncResult> {
    const message = envelope.message;
    if (!message?.data) {
      throw new Error("Missing Pub/Sub message.data");
    }

    const developerNotification = decodePubSubData(message.data);
    const messageId = message.messageId || null;

    if (developerNotification.testNotification) {
      console.log(
        `[GooglePlayRTDN] test notification received messageId=${messageId || "unknown"}`
      );
      return {
        action: "ignored",
        message: "Google Play RTDN test notification acknowledged",
        source: "rtdn",
        messageId,
      };
    }

    if (!developerNotification.subscriptionNotification) {
      console.log(
        `[GooglePlayRTDN] non-subscription notification ignored messageId=${messageId || "unknown"} package=${developerNotification.packageName || "unknown"}`
      );
      return {
        action: "ignored",
        message: "Non-subscription Google Play RTDN ignored",
        source: "rtdn",
        messageId,
      };
    }

    const packageName = String(developerNotification.packageName || "").trim();
    const purchaseToken = String(
      developerNotification.subscriptionNotification.purchaseToken || ""
    ).trim();
    const notificationType =
      developerNotification.subscriptionNotification.notificationType ?? null;

    if (!packageName || !purchaseToken) {
      throw new Error("Google Play RTDN was missing packageName or purchaseToken");
    }

    console.log(
      `[GooglePlayRTDN] subscription notification received messageId=${messageId || "unknown"} type=${notificationType ?? "unknown"} package=${packageName} token=${maskPurchaseToken(
        purchaseToken
      )}`
    );

    const occurredAt = parseDateValue(developerNotification.eventTimeMillis);

    const result = await this.syncSubscriptionByToken({
      packageName,
      purchaseToken,
      source: "rtdn",
      notificationType,
      occurredAt,
    });

    return {
      ...result,
      messageId,
    };
  }

  async syncSubscriptionByToken(params: SyncParams): Promise<GooglePlaySyncResult> {
    const packageName = String(
      params.packageName || DEFAULT_GOOGLE_PLAY_PACKAGE_NAME
    ).trim();
    const purchaseToken = String(params.purchaseToken || "").trim();

    if (!packageName) {
      throw new Error("Google Play package name is required");
    }

    if (!purchaseToken) {
      throw new Error("Google Play purchase token is required");
    }

    const accessToken = await getGooglePlayAccessToken();
    const googleSubscription = await fetchGooglePlaySubscriptionPurchaseV2(
      packageName,
      purchaseToken,
      accessToken
    );

    if (!googleSubscription) {
      console.log(
        `[GooglePlaySync] token not found source=${params.source} package=${packageName} token=${maskPurchaseToken(
          purchaseToken
        )} type=${params.notificationType ?? "n/a"}`
      );
      return {
        action: "not_found",
        message: "Google Play subscription token was not found or is no longer queryable",
        source: params.source,
        packageName,
        purchaseToken,
        notificationType: params.notificationType ?? null,
      };
    }

    let order = await this.orderService.findOne({
      googlePurchaseToken: purchaseToken,
    });

    if (!order && googleSubscription.linkedPurchaseToken) {
      order = await this.orderService.findOne({
        googlePurchaseToken: googleSubscription.linkedPurchaseToken,
      });
    }

    if (!order) {
      console.log(
        `[GooglePlaySync] no local order source=${params.source} package=${packageName} token=${maskPurchaseToken(
          purchaseToken
        )} linkedToken=${maskPurchaseToken(googleSubscription.linkedPurchaseToken || null)}`
      );
      return {
        action: "not_found",
        message: "No local mining subscription order matched the Google Play purchase token",
        source: params.source,
        packageName,
        purchaseToken,
        notificationType: params.notificationType ?? null,
        googleState: googleSubscription.subscriptionState || null,
      };
    }

    const email = String(order?.user?.email || "").toLowerCase().trim();
    if (!email) {
      console.log(
        `[GooglePlaySync] matched order missing email source=${params.source} orderId=${String(
          order?.orderId || ""
        )} token=${maskPurchaseToken(purchaseToken)}`
      );
      return {
        action: "not_found",
        message: "Matched order had no user email to synchronize",
        source: params.source,
        packageName,
        purchaseToken,
        notificationType: params.notificationType ?? null,
        googleState: googleSubscription.subscriptionState || null,
        orderId: String(order?.orderId || ""),
      };
    }

    const normalized = normalizeGooglePlayState(
      googleSubscription,
      params.occurredAt
    );

    const existingSubscription = await this.subscriptionService.findOne({
      email,
      coinSymbol: COIN_SYMBOL,
    });
    const existingMining = await this.miningService.findOne({
      email,
      coinSymbol: COIN_SYMBOL,
    });
    const allPlans = await this.subscriptionPlansService.find({});
    const freePlan = allPlans.find(
      (plan) => String(plan.name).trim().toLowerCase() === "free"
    );
    const currentPlanName =
      String(order?.breakdown?.outCurrencyName || existingSubscription?.plan || "")
        .trim() || "Electric Power";
    const currentPlan = allPlans.find(
      (plan) => String(plan.name).trim().toLowerCase() === currentPlanName.toLowerCase()
    );

    const syncedPlanName = normalized.hasAccess
      ? currentPlanName
      : freePlan?.name || "Free";
    const syncedPlanTemplate = normalized.hasAccess ? currentPlan : freePlan;
    const syncedMiningRate = Number(
      syncedPlanTemplate?.miningRate ??
        (normalized.hasAccess
          ? existingSubscription?.miningRate ?? existingMining?.miningRate
          : freePlan?.miningRate) ??
        1.5
    );
    const syncedSpeedBoost = Number(
      syncedPlanTemplate?.speedBoost ?? existingSubscription?.speedBoost ?? 0
    );
    const syncedCost = Number(
      syncedPlanTemplate?.cost ??
        (normalized.hasAccess ? existingSubscription?.cost : freePlan?.cost) ??
        0
    );

    const startDate =
      normalized.startDate ||
      parseDateValue(order?.subscriptionStartDate) ||
      parseDateValue(existingSubscription?.startDate) ||
      parseDateValue(order?.created) ||
      new Date();
    const endDate =
      normalized.endDate ||
      parseDateValue(order?.subscriptionEndDate) ||
      parseDateValue(order?.expirationDate) ||
      parseDateValue(existingSubscription?.endDate) ||
      new Date();
    const now = new Date();

    const orderUpdate: Record<string, unknown> = {
      $set: {
        status: normalized.orderStatus,
        googlePurchaseToken: purchaseToken,
        googlePackageName: packageName,
        productId: normalized.productId ?? order?.productId,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        expirationDate: endDate,
        lastUpdated: now,
      },
    };

    if (googleSubscription.latestOrderId) {
      (orderUpdate.$set as Record<string, unknown>).merchantReferenceId =
        googleSubscription.latestOrderId;
    }

    if (normalized.cancelledAt) {
      (orderUpdate.$set as Record<string, unknown>).subscriptionCancelledAt =
        normalized.cancelledAt;
    } else {
      orderUpdate.$unset = { subscriptionCancelledAt: 1 };
    }

    await this.orderService.updatePart({ orderId: order.orderId }, orderUpdate);

    const subscriptionSet = {
      email,
      plan: syncedPlanName,
      speedBoost: syncedSpeedBoost,
      cost: syncedCost,
      paymentMethod: "Gpay",
      startDate,
      endDate,
      status: normalized.subscriptionStatus,
      miningRate: syncedMiningRate,
      coinSymbol: COIN_SYMBOL,
      referralBonusUsed: Number(existingSubscription?.referralBonusUsed ?? 0),
    };

    if (existingSubscription) {
      await this.subscriptionService.updatePart(
        { email, coinSymbol: COIN_SYMBOL },
        {
          $set: {
            plan: subscriptionSet.plan,
            speedBoost: subscriptionSet.speedBoost,
            cost: subscriptionSet.cost,
            paymentMethod: subscriptionSet.paymentMethod,
            startDate: subscriptionSet.startDate,
            endDate: subscriptionSet.endDate,
            status: subscriptionSet.status,
            miningRate: subscriptionSet.miningRate,
          },
        }
      );
    } else {
      await this.subscriptionService.create(subscriptionSet);
    }

    if (existingMining) {
      await this.miningService.updatePart(
        { email, coinSymbol: COIN_SYMBOL },
        {
          $set: {
            miningPlan: syncedPlanName,
            miningRate: syncedMiningRate,
          },
        }
      );
    } else {
      await this.miningService.create({
        email,
        totalMined: 0,
        miningPlan: syncedPlanName,
        isMiningActive: false,
        miningRate: syncedMiningRate,
        coinSymbol: COIN_SYMBOL,
      });
    }

    console.log(
      `[GooglePlaySync] source=${params.source} action=${normalized.action} state=${normalized.googleState} orderId=${String(
        order.orderId || ""
      )} email=${email} package=${packageName} productId=${normalized.productId || order?.productId || "unknown"} token=${maskPurchaseToken(
        purchaseToken
      )} access=${normalized.hasAccess} autoRenew=${normalized.autoRenewEnabled ?? "unknown"}`
    );

    return {
      action: normalized.action,
      message: `Synchronized Google Play subscription state ${normalized.googleState}`,
      source: params.source,
      packageName,
      purchaseToken,
      notificationType: params.notificationType ?? null,
      googleState: normalized.googleState,
      orderId: String(order.orderId || ""),
      email,
      hasAccess: normalized.hasAccess,
      startDate,
      endDate,
      productId: normalized.productId,
      autoRenewEnabled: normalized.autoRenewEnabled,
    };
  }
}

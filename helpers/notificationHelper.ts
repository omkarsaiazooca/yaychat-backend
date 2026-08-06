import admin from "../config/firebase";
import { UserService } from "../services/user.service";

const INVALID_FCM_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

const DEFAULT_IMAGE =
  "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Push+Notification+Graphics.png";
const LOTTO_IMAGE =
  "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/art-1.jpg";
const userService = new UserService();

const clearInvalidToken = async (token: string) => {
  try {
    await userService.updatePart(
      { fcmToken: token },
      { $set: { fcmToken: null } } as any
    );
  } catch (error) {
    console.error("Failed to clear invalid FCM token:", error);
  }
};

const isInvalidFcmError = (error: any) => {
  const code = error?.errorInfo?.code || error?.code;
  return INVALID_FCM_CODES.has(code);
};

const toStringData = (values: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, String(value ?? "")])
  );

const sendToToken = async (
  token: string,
  title: string,
  body: string,
  image: string,
  extraData: Record<string, unknown> = {}
) => {
  if (!token) return;

  try {
    await admin.messaging().send({
      token,
      notification: { title, body, image },
      data: toStringData({ image, ...extraData }),
      apns: {
        payload: { aps: { "mutable-content": 1, sound: "default" } },
        fcmOptions: { imageUrl: image },
      },
    });
  } catch (error) {
    if (isInvalidFcmError(error)) {
      await clearInvalidToken(token);
      return;
    }
    console.error("Error sending Firebase notification:", error);
  }
};

export const sendFirebaseNotification = async (
  token: string,
  title: string,
  body: string,
  imageUrl?: string,
  extraData: Record<string, any> = {}
) => sendToToken(token, title, body, imageUrl || DEFAULT_IMAGE, extraData);

export const sendFirebaseNotificationForLotto = async (
  token: string,
  title: string,
  body: string
) => sendToToken(token, title, body, LOTTO_IMAGE);

export const sendLottoAirdropFirebaseNotification = async (
  token: string,
  title: string,
  body: string,
  imageUrl: string = LOTTO_IMAGE
) => sendToToken(token, title, body, imageUrl);

export const sendFirebaseTopicNotification = async (
  topic: string,
  title: string,
  body: string,
  imageUrl?: string,
  extraData: Record<string, any> = {}
) => {
  const image = imageUrl || DEFAULT_IMAGE;
  try {
    await admin.messaging().send({
      topic,
      notification: { title, body, image },
      data: toStringData({ image, ...extraData }),
      android: { priority: "high", notification: { imageUrl: image } },
      apns: {
        payload: { aps: { "mutable-content": 1, sound: "default" } },
        fcmOptions: { imageUrl: image },
      },
    });
  } catch (error) {
    console.error(`Topic push failed for ${topic}:`, error);
  }
};

const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  );

export const subscribeTokensToTopic = async (tokens: string[], topic: string) => {
  const batches = chunk(Array.from(new Set(tokens.filter(Boolean))), 900);
  for (const batch of batches) {
    await admin.messaging().subscribeToTopic(batch, topic);
  }
};

export const unsubscribeTokensFromTopic = async (
  tokens: string[],
  topic: string
) => {
  const batches = chunk(Array.from(new Set(tokens.filter(Boolean))), 900);
  for (const batch of batches) {
    await admin.messaging().unsubscribeFromTopic(batch, topic);
  }
};

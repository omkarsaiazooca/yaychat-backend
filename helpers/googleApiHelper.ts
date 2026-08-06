import {
  DEFAULT_GOOGLE_PLAY_PACKAGE_NAME,
  fetchGooglePlaySubscriptionPurchaseV2,
} from "../services/googlePlaySubscriptionSync.service";

export async function verifyAndroidSubscription(
  purchaseToken: string,
  _productId: string,
  accessToken: string,
  packageName: string = DEFAULT_GOOGLE_PLAY_PACKAGE_NAME
) {
  return fetchGooglePlaySubscriptionPurchaseV2(
    packageName,
    purchaseToken,
    accessToken
  );
}

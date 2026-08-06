# BitcoinYay Subscription API Reference

## Overview
The `/api/v1/bitcoinyay/subscriptions` namespace orchestrates onboarding, plan management, coupon validation, and webhook handling for Stripe and PayPal purchases. Most controllers rely on `BITCOINYAY_PLAN_MAP` and `COUPON_MAP` inside `controllers/bitcoinyaySubscription.controller.ts`, so any plan or coupon changes should be synchronized with that file and the scripts listed below.

## Plan catalog (excerpt)
| Key | USD | Interval | Speed | Stripe price ID | PayPal plan/ID |
| --- | --- | -------- | ----- | --------------- | ------------- |
| `electric` | $35 | Monthly | 4.5 BTCY/h | `price_1SVBcFEbqha0tw36YuvUTbIj` | `P-5CV79387EB067920TNEYG2BQ` |
| `turbo` | $75 | Monthly | 9 BTCY/h | `price_1SVBcGEbqha0tw36IAKxfvwf` | `P-7L537812PX603125JNEYG2CA` |
| `nuclear` | $100 | Monthly | 13.5 BTCY/h | `price_1SVBcHEbqha0tw36sxsBMocs` | `P-9TN27927HY7339010NEYG2CQ` |
| `electric3month` | $99.75 (5% loyalty) | 3 month | 4.5 BTCY/h | `price_tbd_electric3month` | `P-TBD-ELECTRIC-3M` |
| `turbo3month` | $213.75 (5% loyalty) | 3 month | 9 BTCY/h | `price_tbd_turbo3month` | `P-TBD-TURBO-3M` |
| `nuclear3month` | $285 (5% loyalty) | 3 month | 13.5 BTCY/h | `price_tbd_nuclear3month` | `P-TBD-NUCLEAR-3M` |
| `weeklyElectric` | $10 | Weekly | 4.5 BTCY/h | `price_1ShsdAEbqha0tw36IqY8kqym` | `P-07V52839UP893671KNFF7EPY` |
| `weeklyTurbo` | $20 | Weekly | 9 BTCY/h | `price_1ShsdDEbqha0tw36tEoaPNpu` | `P-54F99001YF256534BNFF7EQQ` |
| `weeklyNuclear` | $30 | Weekly | 13.5 BTCY/h | `price_1ShsdFEbqha0tw36FdBZRo1D` | `P-78W60944J5052054XNFF7ERI` |
| `event15x1day` | $5 | 1 day | 15x | `price_1ShsdIEbqha0tw36JcBl056k` | `P-2NM874926V2361225NFF7ESA` |
| `event15x3day` | $10 | 3 days | 15x | `price_1ShsdLEbqha0tw362a7KwTpM` | `P-2511546701567533LNFF7ESQ` |
| `event15x7day` | $20 | 7 days | 15x | `price_1ShsdOEbqha0tw36XYx1vbyp` | `P-4AT99994BW035730DNFF7ETI` |

> The canonical Stripe price IDs are mirrored in `config/bitcoinyayStripePrices.json` and can be updated with `scripts/sync-bitcoinyay-provider-pricing.ts`. Override specific tiers at runtime by setting `BITCOINYAY_STRIPE_PRICE_<PLAN_KEY_UPPERCASE>` in the environment (for example `BITCOINYAY_STRIPE_PRICE_TURBO`).

## API endpoints

### POST `/api/v1/bitcoinyay/subscriptions/purchase`
- **Purpose**: create a pending subscription record, then redirect the user to Stripe Checkout or PayPal approval.
- **Body** (JSON):
  ```json
  {
    "email": "user@example.com",
    "provider": "stripe",
    "planKey": "nuclear",
    "couponCode": "HBD30",
    "metadata": { "source": "app" }
  }
  ```
- **Behavior**:
  - Validates `planKey` against `BITCOINYAY_PLAN_MAP` and stores the request metadata + coupon info.
  - `provider === "stripe"` → creates a Checkout session, records `stripeCheckoutSessionId`, and responds with `{ sessionId, sessionUrl }`.
  - `provider === "paypal"` → calls PayPal `/v1/billing/subscriptions`, stores the approval URL + plan IDs, and returns the `approvalUrl`/`subscriptionId`.
  - Other providers return `400 Unsupported provider`.

### POST `/api/v1/bitcoinyay/subscriptions/coupons/validate`
- **Purpose**: verify a coupon before checkout.
- **Body**: `{ "planKey": "electric", "couponCode": "BTCY20", "provider": "stripe" }`.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "planKey": "electric",
      "currency": "USD",
      "basePrice": 35,
      "discountPercent": 20,
      "discountAmount": 7,
      "finalPrice": 28,
      "couponCode": "BTCY20",
      "stripeCouponId": "<generated>"
    }
  }
  ```
- **Notes**: Stripe validation ensures the coupon exists in Stripe before Checkout; PayPal validation remains purely local.

### GET `/api/v1/bitcoinyay/subscriptions`
- **Purpose**: list stored subscription events (purchases, webhooks, plan changes).
- **Query params**: `email`, `provider`, `status` (pending/active/cancelled), `limit` (max 200), `page` (1-indexed).
- **Response**: `{ success, page, limit, total, data }` with each item containing events, provider IDs, coupon metadata, and most recent status.

### POST `/api/v1/bitcoinyay/subscriptions/change-plan`
- **Purpose**: request a new tier for an existing subscription (Stripe immediate, PayPal queued).
- **Body**: `{ "subscriptionId": "...", "newPlanKey": "turbo" }`.
- **Behavior**:
  - Validates plan key and loads the record.
  - Under Stripe: updates the subscription item via `stripe.subscriptions.update` (with `create_prorations`) and rewrites the price/item IDs.
  - Under PayPal: saves `pendingPlanKey`/`pendingPlanName` and persists a `{ type: "plan.change.requested" }` event so manual review can pick it up.

### POST `/api/v1/bitcoinyay/subscriptions/webhooks/stripe`
- **Purpose**: consume Stripe events for checkout sessions and invoices.
- **Requirements**:
  - Must post the raw body; Stripe requires the exact payload for signature verification (`(req as any).rawBody`).
  - Include `Stripe-Signature` header matching `STRIPE_WEBHOOK` (configured in `config/keys.ts`).
  - Currently handles `checkout.session.completed` and `invoice.payment_succeeded`.
- **Effects**:
  - Marks the subscription `status: active`, stores Stripe IDs, and notifies `SubscriptionService.subscribeUser`.
  - Records webhook payloads in `events` for auditing.

### POST `/api/v1/bitcoinyay/subscriptions/webhooks/paypal`
- **Purpose**: track PayPal `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`, and related events.
- **Requirements**:
  - Optional verification via `PAYPAL_WEBHOOK_ID` using `paypal.notification.webhookEvent.verify`.
  - Each resource is looked up by `custom_id`, `billing_agreement_id`, or `id` to find the stored subscription record.
- **Effects**:
  - Sets `status: active` when `ACTIVATED`, `status: cancelled` on cancellation, and appends a `paypal.<event>` entry to `events`.

### GET `/api/v1/bitcoinyay/subscriptions/home-buy`
Returns `{ data: false, status: 200 }`. The UI currently polls this route to determine whether the quick-buy button should show; no logic beyond the stub is executed.

### GET `/api/v1/bitcoinyay/subscriptions/main-buy`
Returns `{ data: false, status: 200 }` as a placeholder for the main purchase flow (the controller routes to `emptyBuyResponse` by default).

## Coupon reference
- Supported codes: `BTCY10`, `BTCY20`, `BTCY30`, `BTCY50`, `HBD30`.
- The map is defined in `COUPON_MAP` and includes `description` + `percentOff`.
- Stripe translations automatically create matching coupon objects; PayPal uses the code when emitting plan metadata, and custom plan creation occurs inside `ensurePaypalCouponPlan`.

## Environment & configuration
- `BITCOINYAY_USE_TEST_PROVIDERS` (default `true`) controls whether Stripe/PayPal test credentials are used.
- `BITCOINYAY_SUBSCRIPTION_SUCCESS_URL` / `BITCOINYAY_SUBSCRIPTION_CANCEL_URL` customize the redirect targets that are sent to Stripe/PayPal.
- `BITCOINYAY_COIN_SYMBOL` (default `BTCY`) is annotated whenever `SubscriptionService.subscribeUser` runs.
- `BITCOINYAY_STRIPE_PRICE_<PLAN>` overrides the Stripe price IDs defined in `BITCOINYAY_PLAN_MAP`.
- Actual API keys live in `config/keys.ts` (e.g., `STRIPE_TEST`, `STRIPE_LIVE`, `PAYPAL_CLIENT_ID_TEST/LIVE`, `PAYPAL_SECRET_KEY_TEST/LIVE`, `STRIPE_WEBHOOK`, `PAYPAL_WEBHOOK_ID`).
- `config/bitcoinyayStripePrices.json` is regenerated by `scripts/sync-bitcoinyay-provider-pricing.ts` whenever the Stripe price IDs change.

## Workflow notes
1. Front-end creates a checkout intent by posting to `/purchase`.
2. The browser is redirected to the provider approval page. Wait for the webhook to mark the subscription `active` before surfacing mining speed changes.
3. Coupon validation can be run ahead of checkout using `/coupons/validate`.
4. To change plans mid-subscription, post to `/change-plan`; Stripe handles prorations, PayPal records a manual review event.

## Helpful scripts
- `npx ts-node scripts/create-test-coupons.ts`: seeds Stripe coupon objects for enabled codes such as `HBD30`. PayPal discounted billing plans are created during checkout from `COUPON_MAP`.
- `npx ts-node scripts/update-bitcoinyay-plan-rates.ts`: refreshes the mining speed/amount constants inside `controllers/bitcoinyaySubscription.controller.ts`.
- `npx ts-node scripts/sync-bitcoinyay-provider-pricing.ts`: rewrites `config/bitcoinyayStripePrices.json` with fresh Stripe price IDs.
- `npx ts-node scripts/create-paypal-plans.ts`: (re)creates PayPal products/plan IDs after price changes.
- `npx ts-node scripts/seed-power-mining-plans.ts`: provisions weekly/event passes in both providers.
- `npx ts-node scripts/list-power-mining-plans.ts`: dumps the current plan metadata from Stripe/PayPal for verification.
- `npx ts-node scripts/update-power-mining-plans.ts`: keeps the Mongo catalog (`data/defaultPowerMiningPlans.ts`) aligned with plan definitions.

## Postman collection
Import `bitcoinyay-subscriptions.postman_collection.json` to test these endpoints locally. The collection uses `{{bitcoinyaySubscriptions}}` to point at `http://localhost:3000/api/v1/bitcoinyay/subscriptions`.

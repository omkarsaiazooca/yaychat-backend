# Bitcoin Yay Subscriptions

## Purpose
Centralized reference for how the backend handles Bitcoinyay subscriptions through Stripe and PayPal, including purchases, webhook handling, and required environment variables.

## Supported Plans

### Monthly subscriptions
| Key | Name | Stripe Price ID | PayPal Plan ID | USD Price | BTCY Speed |
| --- | ---- | -------------- | ------------- | --------- | ---------- |
| `electric` | Electric Power | `price_1SadYdEbqha0tw36JFkzmVlp` | `P-6LU677213V647522WNEO5GAQ` | $35 | 4.5 BTCY/h |
| `turbo` | Turbo Power | `price_1SadYeEbqha0tw36hPTznzQ1` | `P-3S428650NM573030PNEO5GBA` | $75 | 9 BTCY/h |
| `nuclear` | Nuclear Power | `price_1SadYeEbqha0tw36X6TgNYgz` | `P-1L139598U19623744NEO5GBQ` | $100 | 13.5 BTCY/h |

*After you run `scripts/create-paypal-plans.ts` and seed new Stripe prices, replace the Stripe/PayPal IDs above with the new values for the refreshed tiers.*

### 3-Month loyalty bundles
| Key | Name | Stripe/PayPal IDs | Price (billed once) | Duration | Speed |
| --- | ---- | ----------------- | ------------------- | -------- | ----- |
| `electric3month` | Electric Power (3-Month Loyalty) | Stripe: `price_tbd_electric3month` / `prod_tbd_electric3month`<br>PayPal: `P-TBD-ELECTRIC-3M` / `PROD-TBD-ELECTRIC-3M` | $99.75 | 3 months | 4.5 BTCY/h |
| `turbo3month` | Turbo Power (3-Month Loyalty) | Stripe: `price_tbd_turbo3month` / `prod_tbd_turbo3month`<br>PayPal: `P-TBD-TURBO-3M` / `PROD-TBD-TURBO-3M` | $213.75 | 3 months | 9 BTCY/h |
| `nuclear3month` | Nuclear Power (3-Month Loyalty) | Stripe: `price_tbd_nuclear3month` / `prod_tbd_nuclear3month`<br>PayPal: `P-TBD-NUCLEAR-3M` / `PROD-TBD-NUCLEAR-3M` | $285 | 3 months | 13.5 BTCY/h |

*Each loyalty bundle aggregates three monthly cycles (e.g., 3 × $100) and applies a 5% loyalty discount, so the final charge uses `(monthly price × 3) × 0.95`.*

After the new Stripe/PayPal assets exist, rerun `scripts/create-paypal-plans.ts` and `scripts/sync-bitcoinyay-provider-pricing.ts` so the generated IDs replace the `price_tbd_*` placeholders above.

*You can also target just the 3-month loyalty tiers by running `npx ts-node scripts/create-3month-loyalty-plans.ts`; the script creates the new Stripe price/product plus PayPal product/plan, updates `controllers/bitcoinyaySubscription.controller.ts`, and records the new price IDs in `config/bitcoinyayStripePrices.json`.*

### Weekly passes
| Key | Name | Stripe/PayPal IDs | Price | Duration | Speed |
| --- | ---- | ----------------- | ----- | -------- | ----- |
| `weeklyElectric` | Electric Mining Weekly Pass | Stripe: `price_1ShsdAEbqha0tw36IqY8kqym` / `prod_TfD3Vrvyf5vawl`<br>PayPal: `P-07V52839UP893671KNFF7EPY` / `PROD-27S666344T074251X` | $10 | 1 week | 4.5 BTCY/h |
| `weeklyTurbo` | Turbo Mining Weekly Pass | Stripe: `price_1ShsdDEbqha0tw36tEoaPNpu` / `prod_TfD3RaThTobNMZ`<br>PayPal: `P-54F99001YF256534BNFF7EQQ` / `PROD-780598580T497470A` | $20 | 1 week | 9 BTCY/h |
| `weeklyNuclear` | Nuclear Mining Weekly Pass | Stripe: `price_1ShsdFEbqha0tw36FdBZRo1D` / `prod_TfD378BprVTUbI`<br>PayPal: `P-78W60944J5052054XNFF7ERI` / `PROD-4XE0345004348044C` | $30 | 1 week | 13.5 BTCY/h |

### New Year’s 15x event passes
| Key | Name | Stripe/PayPal IDs | Price | Duration | Speed |
| --- | ---- | ----------------- | ----- | -------- | ----- |
| `event15x1day` | 15x Speed Mining – 1 Day | Stripe: `price_1ShsdIEbqha0tw36JcBl056k` / `prod_TfD3M86QTp2bss`<br>PayPal: `P-2NM874926V2361225NFF7ESA` / `PROD-1XB7423846666572N` | $5 | 1 day | 15x |
| `event15x3day` | 15x Speed Mining – 3 Days | Stripe: `price_1ShsdLEbqha0tw362a7KwTpM` / `prod_TfD3cxtZhxWwk9`<br>PayPal: `P-2511546701567533LNFF7ESQ` / `PROD-9TX505978E3014832` | $10 | 3 days | 15x |
| `event15x7day` | 15x Speed Mining – 7 Days | Stripe: `price_1ShsdOEbqha0tw36XYx1vbyp` / `prod_TfD3rgwlDjDX9w`<br>PayPal: `P-4AT99994BW035730DNFF7ETI` / `PROD-46149046YA209530P` | $20 | 7 days | 15x |
### Stripe price overrides
- The canonical Stripe price IDs now live inside `config/bitcoinyayStripePrices.json`, which is automatically rewritten by `scripts/sync-bitcoinyay-provider-pricing.ts`.
- If you need to rotate a price (e.g., fresh IDs added on Dec 4 2025) without redeploying, set `BITCOINYAY_STRIPE_PRICE_<PLAN_KEY_UPPERCASE>` in the environment (for example `BITCOINYAY_STRIPE_PRICE_ELECTRIC`, `BITCOINYAY_STRIPE_PRICE_TURBO`, `BITCOINYAY_STRIPE_PRICE_NUCLEAR`, `BITCOINYAY_STRIPE_PRICE_ELECTRIC3MONTH`, `BITCOINYAY_STRIPE_PRICE_TURBO3MONTH`, or `BITCOINYAY_STRIPE_PRICE_NUCLEAR3MONTH`) and the controller will prefer those values over the hard-coded defaults.

## Purchase flow
- **Endpoint**: POST /api/v1/bitcoinyay/subscriptions/purchase.
- **Payload**: include email, provider (stripe or paypal), planKey, optional couponCode, and metadata per request body described in the main README.
- **Response**: Stripe returns sessionId + sessionUrl; PayPal returns an pprovalUrl. Backend persists request metadata for reconciliation.
- The controller redirects users to the provider approval page, and retries/coupon audits are handled server-side.

## Subscription management
- **Listing**: GET /api/v1/bitcoinyay/subscriptions accepts email, provider, status, limit, page and responds with pagination + stored events.
- **Plan changes**: POST /api/v1/bitcoinyay/subscriptions/change-plan accepts { subscriptionId, newPlanKey }.
  - Stripe performs immediate updates with prorated amounts.
  - PayPal records change-plan requests only for manual review since billing agreements cannot be retargeted automatically.

### Plan-change API details
- **Endpoint**: `POST /api/v1/bitcoinyay/subscriptions/change-plan`
- **Payload**
  ```json
  {
    "subscriptionId": "695684e5edf6fa8c03d765a3",
    "newPlanKey": "turbo"
  }
  ```
  Both fields are required; `newPlanKey` must match one of `BITCOINYAY_PLAN_MAP`.
- **Response** (success):
  ```json
  {
    "success": true,
    "message": "Plan change scheduled",
    "data": {
      "key": "turbo",
      "name": "Turbo Power",
      "amount": 75,
      "currency": "USD",
      "miningSpeed": 6,
      "stripePriceId": "price_1SVBcGEbqha0tw36IAKxfvwf"
    }
  }
  ```
  The `data` object mirrors the chosen `PlanDefinition` so callers can refresh pricing/speed immediately.
- **Error conditions**: missing parameters, unknown plan keys, missing Stripe subscription IDs, or CLI requests that cannot be proratd trigger `400` responses; non-fatal `500` responses include the error message.
- **Behavior note**: After validation the controller records a `plan.change.requested` event, updates the Mongo document, and either updates the Stripe subscription item (immediate call with `create_prorations`) or flags the PayPal record’s `pendingPlanKey`/`pendingPlanName` for manual review.
## Webhooks
- **Stripe**: POST /api/v1/bitcoinyay/subscriptions/webhooks/stripe.
  - Validates Stripe signatures, stores checkout session or invoice data, marks local subscription as ctive, and notifies SubscriptionService to refresh user mining plans.
- **PayPal**: POST /api/v1/bitcoinyay/subscriptions/webhooks/paypal.
  - Validates the webhook using PAYPAL_WEBHOOK_ID (when configured) and tracks events such as BILLING.SUBSCRIPTION.ACTIVATED, BILLING.SUBSCRIPTION.CANCELLED, and payment successes.

## Environment variables
Reference config/keys.ts so each provider key/secret maps correctly. Keep values aligned with the sample in dist/config/.env.

- `BITCOINYAY_USE_TEST_PROVIDERS`: Controls whether subscriptions use Stripe test keys and PayPal sandbox resources. Defaults to `true` so that the current test-only plans work; set to `false` once live products are available.

### Stripe
- STRIPE_LIVE / STRIPE_TEST: API keys used by the backend for live/test checkout flows.
- DEX_STRIPE_LIVE / DEX_STRIPE_TEST: additional Stripe keys used by the DEX service (kept in sync).
- STRIPE_SECRETKEY: webhook secret used for signature verification.
- STRIPE_WEBHOOK: optional alternate webhook secret if the subscription service differentiates between live/test.
- STRIPE_PUBLISHABLE_KEY: client-side key for quick integration testing.

### PayPal
- PAYPAL_CLIENT_ID_MAIN / PAYPAL_SECRET_KEY_MAIN: live credentials used during production purchases.
- PAYPAL_CLIENT_ID_TEST / PAYPAL_SECRET_KEY_TEST: sandbox credentials for testing.
- PAYPAL_WEBHOOK_ID: required when verifying incoming PayPal webhook notifications; leave blank if verification takes place outside this service.

## Creating test coupons
- Run `npx ts-node scripts/create-test-coupons.ts` (or `BITCOINYAY_USE_TEST_PROVIDERS=false` if you want to target live Stripe resources). This script provisions Stripe coupons for the enabled codes. PayPal discounted billing plans are created during checkout from `COUPON_MAP`, so there is no separate PayPal coupon seeding step.
## Updating plan rates
- Run `npx ts-node scripts/update-bitcoinyay-plan-rates.ts` whenever the subscription tiers change. It replaces the `miningSpeed` and `amount` values inside `controllers/bitcoinyaySubscription.controller.ts` so your active constants stay in sync with the rates documented above.
- Run `npx ts-node scripts/sync-bitcoinyay-provider-pricing.ts` to create fresh Stripe `Price` objects and rewrite the `stripePriceId` values inside `BITCOINYAY_PLAN_MAP`, keeping your API and Stripe pricing aligned. PayPal does not allow pricing patches via this API, so update each plan in the PayPal dashboard manually and use this script’s log to see which plan IDs need changing.
- Run `npx ts-node scripts/create-paypal-plans.ts` to create new PayPal Products/Plans for the updated rates, then restart your server once the plan IDs have been rewritten in `BITCOINYAY_PLAN_MAP`.

## Seeding bite-sized & event plans
- Run `npx ts-node scripts/seed-power-mining-plans.ts` to provision the bite-sized weekly passes and New Year's 15x event passes on both PayPal and Stripe. Capture the product/price IDs from the script output so you can reference them when you wire the new plans into the backend API.
- Run `npx ts-node scripts/list-power-mining-plans.ts` to fetch the current PayPal/Stripe metadata for every plan and confirm those IDs still resolve before releasing.
- Run `npx ts-node scripts/update-power-mining-plans.ts` anytime you tweak `data/defaultPowerMiningPlans.ts` so the subscription plan catalog stored in Mongo reflects the latest tiers.

## Integration notes
1. Create a checkout flow that POSTs to subscriptions/purchase with the selected plan key and provider.
2. After the provider redirects back, wait for the webhook and mark the UI subscription as active once this backend update occurs.
3. When users switch plans, call subscriptions/change-plan; Stripe updates automatically, while PayPal plans are queued for manual review.

### Coupon validation
- **Endpoint**: `POST /api/v1/bitcoinyay/subscriptions/coupons/validate`
- **Body**: `{ planKey, couponCode }`
- **Provider hint**: include `provider` (either `stripe` or `paypal`) to know which checkout path the UI will take; the discount is identical for both today but this makes the response clearer.
- **Stripe validation**: when `provider` is `stripe`, the endpoint now calls Stripe once to ensure the coupon exists so clients can trust that code will work before redirecting to checkout. PayPal validation remains local.
- **Response**: Returns `basePrice`, `discountPercent`, `discountAmount`, `finalPrice`, and metadata about the plan/coupon so the frontend can display pricing before checkout.

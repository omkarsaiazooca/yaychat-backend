# Indexx Exchange Backend

## MongoDB Health Check API

- **Route**: `GET /api/v1/inex/basic/mongoHealth`
- **Purpose**: Lets client apps detect when MongoDB is unavailable, overloaded, or running a backup so they can warn users that portfolio/asset data may be unreliable.

### Response Schema

```jsonc
{
  "timestamp": "ISO timestamp of the check",
  "status": "healthy | degraded | unavailable",
  "message": "Human-readable summary",
  "assetDataReliable": true,
  "mongo": {
    "state": "connected | disconnected | connecting | disconnecting",
    "readyState": 1,
    "connected": true,
    "busy": false,
    "backupInProgress": false,
    "latencyMs": 23,
    "queuedOperations": 4,
    "issues": []
  }
}
```

- `assetDataReliable` is `false` whenever `status` is `degraded` or `unavailable`; client UIs should display a warning in those cases.
- `issues` lists detected problems (e.g., high latency, queued operations, backup locks).
- HTTP status is `200` only when `status === "healthy"`; otherwise it returns `503`.

### curl Example

```bash
curl -X GET https://<host>/api/v1/inex/basic/mongoHealth
```

### Suggested Client Handling

1. Poll the endpoint before showing balances or asset values.
2. If the request fails or returns `status` other than `healthy`, show a banner like “Data services are temporarily unavailable. Asset values may be inaccurate.”
3. Optionally log/report the `issues` array for observability.

## Bitcoinyay Ad Failure Audit

### POST `/api/v1/bitcoinyay/audit-logs`

- **Purpose**: Capture every ad failure from the Bitcoinyay app (ad unit, format, error code/message, VPN flag, device locale, etc.) so issues can be triaged faster.
- **Payload**: `{ adUnitId, adFormat, errorCode, errorMessage, locale, timestamp, ... }` (see backend schema for optional user/session metadata).
- **Rate limiting**: ~40 writes/min per IP or authorization header; handle HTTP 429 gracefully.

### GET `/api/v1/bitcoinyay/audit-logs`

- **Filters**: `adUnitId`, `adFormat`, `errorCode`, `locale`, `vpnDetected`, `networkStatus`, `userId`, `sessionId`, `from`, `to`, `limit`, `page`.
- **Response**: Pagination metadata plus stored failure documents keyed by timestamp and error status.

## Bitcoinyay Power Mining Subscriptions

### Supported plans

#### Monthly tiers
| Key | Name | Stripe Price | PayPal Plan | Price | BTCY Speed |
| --- | ---- | ------------ | ----------- | ----- | ---------- |
| `electric` | Electric Power | `price_1SadYdEbqha0tw36JFkzmVlp` | `P-6LU677213V647522WNEO5GAQ` | $35 | 4.5 BTCY/h |
| `turbo` | Turbo Power | `price_1SadYeEbqha0tw36hPTznzQ1` | `P-3S428650NM573030PNEO5GBA` | $75 | 9 BTCY/h |
| `nuclear` | Nuclear Power | `price_1SadYeEbqha0tw36X6TgNYgz` | `P-1L139598U19623744NEO5GBQ` | $100 | 13.5 BTCY/h |

#### Weekly passes
| Key | Name | Stripe/PayPal | Price | Duration | Speed |
| --- | ---- | ------------- | ----- | -------- | ----- |
| `weeklyElectric` | Electric Mining Weekly Pass | Stripe: `price_1ShsdAEbqha0tw36IqY8kqym` / `prod_TfD3Vrvyf5vawl`<br>PayPal: `P-07V52839UP893671KNFF7EPY` / `PROD-27S666344T074251X` | $10 | 1 week | 4.5 BTCY/h |
| `weeklyTurbo` | Turbo Mining Weekly Pass | Stripe: `price_1ShsdDEbqha0tw36tEoaPNpu` / `prod_TfD3RaThTobNMZ`<br>PayPal: `P-54F99001YF256534BNFF7EQQ` / `PROD-780598580T497470A` | $20 | 1 week | 9 BTCY/h |
| `weeklyNuclear` | Nuclear Mining Weekly Pass | Stripe: `price_1ShsdFEbqha0tw36FdBZRo1D` / `prod_TfD378BprVTUbI`<br>PayPal: `P-78W60944J5052054XNFF7ERI` / `PROD-4XE0345004348044C` | $30 | 1 week | 13.5 BTCY/h |

#### New Year’s 15x passes
| Key | Name | Stripe/PayPal | Price | Duration | Speed |
| --- | ---- | ------------- | ----- | -------- | ----- |
| `event15x1day` | 15x Speed Mining – 1 Day | Stripe: `price_1ShsdIEbqha0tw36JcBl056k` / `prod_TfD3M86QTp2bss`<br>PayPal: `P-2NM874926V2361225NFF7ESA` / `PROD-1XB7423846666572N` | $5 | 1 day | 15x |
| `event15x3day` | 15x Speed Mining – 3 Days | Stripe: `price_1ShsdLEbqha0tw362a7KwTpM` / `prod_TfD3cxtZhxWwk9`<br>PayPal: `P-2511546701567533LNFF7ESQ` / `PROD-9TX505978E3014832` | $10 | 3 days | 15x |
| `event15x7day` | 15x Speed Mining – 7 Days | Stripe: `price_1ShsdOEbqha0tw36XYx1vbyp` / `prod_TfD3rgwlDjDX9w`<br>PayPal: `P-4AT99994BW035730DNFF7ETI` / `PROD-46149046YA209530P` | $20 | 7 days | 15x |

> **Tip:** The `config/bitcoinyayStripePrices.json` file holds the Stripe price IDs so they can be refreshed by `scripts/sync-bitcoinyay-provider-pricing.ts` without touching the controller sources. For temporary overrides, set `BITCOINYAY_STRIPE_PRICE_ELECTRIC`, `BITCOINYAY_STRIPE_PRICE_TURBO`, or `BITCOINYAY_STRIPE_PRICE_NUCLEAR` in your environment and the controller will respect those values.

- Run `npx ts-node scripts/list-power-mining-plans.ts` when you need to verify PayPal product/plan names or Stripe price/product metadata before pushing another update.

## Mining subscription plan API

### GET `/api/v1/mining/getUserSubscriptionPlan/:coinSymbol/:email`

- **Purpose**: Return the user’s mining subscription so the UI can render the most recent plan, speed boost, and window without duplicating business logic.
- **Path params**:
  - `coinSymbol` (e.g., `BTCY`)
  - `email` (percent-encode `@` → `%40`)
- **Response** (`200`):
  ```json
  {
    "status": 200,
    "data": {
      "_id": "695684e5edf6fa8c03d765a3",
      "email": "user@example.com",
      "plan": "Electric Power",
      "speedBoost": 3,
      "miningRate": 3,
      "cost": 35,
      "paymentMethod": "Stripe",
      "startDate": "2025-12-31T18:00:00.000Z",
      "endDate": "2026-01-31T17:59:59.999Z",
      "coinSymbol": "BTCY",
      "status": "Active",
      "referralBonusUsed": 0,
      "bonusNote": "",
      "lastBonusAppliedAt": null,
      "referralNote": "",
      "referredByEmail": ""
    }
  }
  ```
- **Notes**: The controller forwards the request to `SubscriptionService.getUserSubscriptionForUi`, which synchronizes pending rewards and referral boosts before returning a sanitized document (no raw Mongo internals). If no subscription exists, it safely seeds a free-tier window and still replies with `status === 200`.
- **Client tip**: Import `postman/mining-subscription-plan.postman_collection.json` to test the endpoint locally and swap the `coinSymbol`/`email` path params.

## BTCY New Year 2026 Airdrop
- `POST /api/v1/basic/registerbtcynewyear2026airdrop`  
  Body must include `email`, a TRON `walletAddress`, `walletProvider`, and a `referralCode` (users must invite at least one friend). Submissions are accepted through December 31, 2025 23:59 UTC and are recorded inside the `BTCYNewYear2026AIRDROPData` collection; winners are drawn on Jan 1, 2026.
- `GET /api/v1/basic/allbtcynewyear2026airdrop` returns the stored registrations for monitoring/fulfillment teams.

### POST `/api/v1/bitcoinyay/subscriptions/purchase`

- **Purpose**: Redirect the end user to Stripe checkout or PayPal approval so Bitcoinyay subscriptions are captured.
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "provider": "stripe",
    "planKey": "nuclear",
    "couponCode": "HBD30",
    "metadata": { "source": "app" }
  }
  ```
- **Response**: Stripe returns `sessionId` + `sessionUrl`; PayPal returns an `approvalUrl`. Backend stores the request and coupon metadata for future reconciliation.

### GET `/api/v1/bitcoinyay/subscriptions`

- **Purpose**: List subscription history for a user or provider.
- **Query params**: `email`, `provider`, `status`, `limit`, `page`.
- **Response**: `total`, `limit`, `page`, and array of stored subscription documents (events, provider IDs, status).

### POST `/api/v1/bitcoinyay/subscriptions/change-plan`

- **Purpose**: Upgrade or downgrade an active subscription.
- **Body**: `{ "subscriptionId": "...", "newPlanKey": "turbo" }`
- **Behavior**: Stripe updates the subscription immediately (prorates the new price). PayPal requests are marked as pending because PayPal billing agreements cannot be retargeted automatically.
- **Allowed plans**: Monthly (`electric`, `turbo`, `nuclear`), weekly passes, and 1-day event passes are supported; only multi-month loyalty bundles remain blocked.
- **Free downgrade**: Send `newPlanKey: "free"` to cancel auto-renewal and transition to the Free tier after the current billing cycle ends. Stripe sets `cancel_at_period_end`; PayPal records a pending downgrade for manual review.
- **Limit**: Only the standard 1-month plans (`electric`, `turbo`, `nuclear`) are eligible; weekly/event passes or loyalty bundles cannot be targeted.

### Webhooks

- **Stripe**: `POST /api/v1/bitcoinyay/subscriptions/webhooks/stripe`  
  Verifies the Stripe signature, stores the checkout session or invoice event, marks the local record as `active`, and calls `SubscriptionService` to refresh the user's mining plan.
- **PayPal**: `POST /api/v1/bitcoinyay/subscriptions/webhooks/paypal`  
  Verifies the PayPal webhook (if `PAYPAL_WEBHOOK_ID` is configured) and tracks `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`, and payment successes.

### Coupon codes

- Supported codes: `BTCY10`, `BTCY20`, `BTCY30`, `BTCY50`, `HBD30`.  
- Stripe automatically creates/uses a matching coupon and applies it to the checkout session.  
- PayPal creates/uses a matching discounted billing plan for the first billing cycle.

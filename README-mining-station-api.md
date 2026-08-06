# Mining Station API

This document explains how the Mining Station APIs work and how each response is generated.

Primary route:

`/api/v1/mining/station`

Related read-only earnings route:

`/api/v1/earnings`

Primary implementation files:

- `routes/miningstation.routes.ts`
- `controllers/miningStationAPI.ts`
- `services/miningStationEarnings.service.ts`
- `services/miningWithdrawRequest.service.ts`
- `models/userMiningBalance.ts`
- `models/miningWithdrawRequest.ts`

## Auth And Access

Every route requires:

```http
Authorization: Bearer <JWT_TOKEN>
```

Access rules:

- Normal users can read only their own station data.
- `Admin` and `SuperAdmin` can pass `?email=<user email>` on GET routes to inspect another user's station.
- `POST /withdrawals` always uses the authenticated user's JWT email. It does not allow withdrawing for another user through query/body email.

Common auth errors:

```json
{ "message": "Unauthorized: Missing or invalid Authorization header" }
```

```json
{ "message": "Unauthorized: Invalid or expired token" }
```

Forbidden response:

```json
{
  "status": 403,
  "data": { "message": "Forbidden" }
}
```

## Common Query Params

Most GET endpoints support:

| Query | Default | Notes |
| --- | --- | --- |
| `email` | logged-in user | Admin/SuperAdmin only for other users. |
| `range` | `30d` | Examples: `7d`, `30d`, `90d`, `all`. |
| `from` | none | ISO date. If `from` or `to` exists, range becomes `custom`. |
| `to` | now | ISO date. |
| `timezone` | `Asia/Kolkata` | Used for calendar buckets and current month ranges. |
| `page` | `0` | Zero-based page index. |
| `pageSize` | `20` | Max `100` for station lists. |

## Cache Behavior

Station responses are cached in Redis for 5 minutes.

The service also coalesces identical in-flight requests. If two identical uncached requests arrive at the same time, only one DB computation runs and both callers receive the same result.

Cache keys include:

- endpoint scope
- normalized email
- range/from/to/timezone
- page/pageSize

Withdrawal submission invalidates the owner's station caches.

## Main Data Sources

### User Collection

Used for:

- station owner profile
- owner referral code
- referred users
- saved BTCY payout wallets
- KYC fields used by `qualificationStatus`

Important fields:

- `email`
- `referralCode`
- `referralCodeUsed`
- `firstName`
- `lastName`
- `username`
- `profilePic`
- `lastActive`
- `kycStatus`
- `isKYCPass`
- `userWallets`

### AdMiningWatch Collection

Used for all ad-count and ad-revenue metrics.

Important fields:

- `email`
- `timestamp`
- `adType`

Current behavior:

- Ad counts include all `adType` values.
- Missing or custom `adType` values still count as ad impressions.
- Revenue is still calculated only from exact `rewarded` and `interstitial` counts because only those have configured CPM rates.

### Mining Collection

Used for:

- owner mining status
- miner `isMining`
- miner `lastClaimTime`
- withdrawal minimum gate via `totalMined`

Important fields:

- `email`
- `coinSymbol`
- `isMiningActive`
- `lastClaimTime`
- `totalMined`

### userMiningBalance Collection

Used for withdrawable balance display and withdrawal validation.

Important fields:

- `email`
- `coinSymbol`
- `transferableBalance`
- `unverifiedBalance`
- `migratedBalance`

### WithdrawRequest Collection

Used by the withdrawals page/history.

Important fields:

- `orderId`
- `email`
- `requestedAmount`
- `approvedAmount`
- `status`
- `withdrawalMethod`
- `txHash`
- `createdAt`
- `processedAt`

## Revenue Model

CPM rates and revenue share are read from environment variables. The BTCY/USD conversion rate is fetched from a live internal price API at request time — it is **not** an env var.

**Environment variables:**

| Env | Default | Meaning |
| --- | ---: | --- |
| `GOOGLE_ADMOB_REWARDED_CPM_USD` | `0` | Rewarded ad CPM. First priority. |
| `MINING_STATION_ADMOB_CPM_USD` | `0` | Rewarded ad CPM fallback. |
| `ADMOB_REWARDED_CPM_USD` | `0` | Rewarded ad CPM second fallback. |
| `GOOGLE_ADMOB_INTERSTITIAL_CPM_USD` | `0` | Interstitial ad CPM. |
| `MINING_STATION_REFERRAL_REVENUE_SHARE_PCT` | `30` | Revenue share percent. First priority. |
| `MINING_STATION_AD_REVENUE_SHARE_PCT` | `30` | Revenue share percent fallback. |
| `MINING_STATION_EARNING_USD_PER_AD` | `0` | Legacy fixed USD-per-ad fallback when both CPM values are zero. |
| `MINING_STATION_EARNING_BTCY_PER_AD` | `0` | Legacy fixed BTCY-per-ad fallback when both CPM values are zero. |

**BTCY/USD rate (live API):**

`usdPerBtcy` is resolved by calling `getPriceByName("BTCY")` at request time. The result is cached in-memory for 5 minutes. If the API call fails or returns a non-positive value, `usdPerBtcy` becomes `null` and all BTCY output fields in that response are returned as `0` or `null`. There is no env var fallback for this value.

Current local `config/.env` values:

```text
GOOGLE_ADMOB_REWARDED_CPM_USD=1.3193
GOOGLE_ADMOB_INTERSTITIAL_CPM_USD=0
MINING_STATION_REFERRAL_REVENUE_SHARE_PCT=30
```

The returned `model` field is generated by code:

- `admob_cpm_share` when rewarded or interstitial CPM is greater than `0`
- `fixed_per_ad` when both CPM values are `0` and legacy fixed-per-ad values are used

Formula:

```text
gross rewarded USD       = rewardedCount * (ADMOB_CPM_USD / 1000)
gross interstitial USD  = interstitialCount * (ADMOB_INTERSTITIAL_CPM_USD / 1000)
earnings USD            = gross USD * (AD_REVENUE_SHARE_PCT / 100)
earnings BTCY           = earnings USD / USD_PER_BTCY
```

If `USD_PER_BTCY` is `0`, BTCY earnings are returned as `0` or `null` depending on the field.

## Ads Revenue Calculation — Deep Dive

This section explains exactly how an ad watch event becomes a USD earnings figure and a BTCY token balance.

### Step 1 — Recording an Ad Watch

Every time a referred user watches an ad the app writes one document to the `AdMiningWatch` collection:

```json
{
  "email": "miner@example.com",
  "timestamp": "2026-06-05T10:30:00.000Z",
  "adType": "rewarded"
}
```

`adType` can be `"rewarded"`, `"interstitial"`, or any custom/unknown string.

### Step 2 — Counting Ads by Type

When earnings are computed, the service runs a MongoDB aggregation over `AdMiningWatch` for all referral emails in a given time window:

```js
$group: {
  _id: null,
  adCount:          { $sum: 1 },
  rewardedCount:    { $sum: { $cond: [{ $eq: ["$adType", "rewarded"] },     1, 0] } },
  interstitialCount:{ $sum: { $cond: [{ $eq: ["$adType", "interstitial"] }, 1, 0] } },
}
```

- `adCount` — total impressions regardless of type. Used for display metrics, active-miner counts, and engagement stats.
- `rewardedCount` — only `adType === "rewarded"` documents. Drives CPM revenue.
- `interstitialCount` — only `adType === "interstitial"` documents. Drives CPM revenue.
- Unknown `adType` values increment `adCount` but contribute `0` to revenue.

### Step 3 — Resolving Rate Config

Before any arithmetic the service calls `getRateConfig()`, which reads environment variables in priority order and returns a `RateConfig` object. Two models are possible:

#### Model A — `admob_cpm_share` (active when any CPM > 0)

```text
grossUsdPerAd             = REWARDED_CPM_USD / 1000
grossInterstitialUsdPerAd = INTERSTITIAL_CPM_USD / 1000
usdPerAd                  = grossUsdPerAd * (revenueSharePct / 100)
interstitialUsdPerAd      = grossInterstitialUsdPerAd * (revenueSharePct / 100)
btcyPerAd                 = usdPerAd / USD_PER_BTCY
interstitialBtcyPerAd     = interstitialUsdPerAd / USD_PER_BTCY
```

With the current `.env` values:

```text
REWARDED_CPM_USD   = 1.3193   →  grossUsdPerAd = 1.3193 / 1000 = 0.0013193
revenueSharePct    = 30%      →  usdPerAd      = 0.0013193 * 0.30 = 0.00039579
USD_PER_BTCY       = 0.001    →  btcyPerAd     = 0.00039579 / 0.001 = 0.39579
INTERSTITIAL_CPM   = 0        →  (no interstitial revenue)
```

#### Model B — `fixed_per_ad` (legacy fallback when both CPM values are 0)

```text
usdPerAd  = MINING_STATION_EARNING_USD_PER_AD   (env var, default 0)
btcyPerAd = MINING_STATION_EARNING_BTCY_PER_AD  (env var, default 0)
            OR  usdPerAd / USD_PER_BTCY if the BTCY env var is 0
```

Both rewarded and interstitial ads use the same flat rate under this model.

### Step 4 — Computing Revenue (`computeRevenue`)

With counts and rates in hand the service calls `computeRevenue(rewardedCount, interstitialCount, rates)`:

```text
grossRevenueUsd = (rewardedCount * grossUsdPerAd)
                + (interstitialCount * grossInterstitialUsdPerAd)

earningsUsd     = (rewardedCount * usdPerAd)
                + (interstitialCount * interstitialUsdPerAd)

earningsBtcy    = (rewardedCount * btcyPerAd)
                + (interstitialCount * interstitialBtcyPerAd)
```

`grossRevenueUsd` is the platform's raw AdMob revenue before the station owner's share is applied.
`earningsUsd` is the station owner's cut (i.e. `grossRevenueUsd * revenueShareRatio`).
`earningsBtcy` is the same cut expressed in BTCY tokens.

If `USD_PER_BTCY` is `null` (BTCY price lookup failed), `earningsBtcy` is `0`.

### Step 5 — BTCY Price Lookup

`usdPerBtcy` is always fetched from a live internal price API — there is no env var override:

1. Check in-memory service cache (5-minute TTL). Return cached value if still valid.
2. Call `getPriceByName("BTCY")` and parse the numeric price from `response.data`.
3. If the call fails or returns a non-positive value, return `null` and log a warning.

A `null` result does not block USD earnings — it only means all BTCY output fields in that response are `0` or `null`.

### Step 6 — Time Windows and Aggregation Scopes

The service computes `computeRevenue` separately for four time windows on every overview/earnings request:

| Window | `from` | `to` | Used for |
| --- | --- | --- | --- |
| Lifetime | `null` (no lower bound) | now | `lifetimeEarned`, `withdrawable` totals |
| Selected range | `now - N days` (or custom) | now | Charts, referral breakdown |
| Current month | 1st of current month 00:00 UTC | now | `currentMonthEarnings`, `pendingUnverifiedEarnings` |
| Previous month | 1st of previous month | last second of previous month | `growthVsLastMonth` |

History charts group by `%Y-%m-%d` (day granularity) or `%Y-%m` (month granularity) using the request timezone for bucket labels.

### Step 7 — Allocation Across Referrals

When the overview breaks down earnings per referral, `computeRevenue` is called once per referred user using only that user's `rewardedCount` and `interstitialCount` for the selected range. The results are summed to produce total earnings for the station owner across all referrals.

### End-to-End Example

Scenario: station owner has 3 referrals who watched ads this month.

```
Miner A: 50 rewarded, 0 interstitial
Miner B: 20 rewarded, 5 interstitial
Miner C:  0 rewarded, 0 interstitial (inactive)
```

Using current rates (`REWARDED_CPM=1.3193` from env, `INTERSTITIAL_CPM=0` from env, `SHARE=30%` from env, `USD_PER_BTCY=0.001` from live price API):

```text
rewardedCount      = 70
interstitialCount  = 5

grossRevenueUsd  = (70 * 0.0013193) + (5 * 0)
                 = 0.092351 USD

earningsUsd      = grossRevenueUsd * 0.30
                 = 0.027705 USD

earningsBtcy     = 0.027705 / 0.001
                 = 27.705 BTCY
```

`adCount` displayed = 75 (all 75 records regardless of type).
`activeMiners` = 2 (Miner A and B had at least one ad watch).
`lifetimeEarned` uses the same formula but over the full unfiltered date range.

## Withdrawal Balance Calculation

The visible withdrawal balance comes from `userMiningBalance.transferableBalance`.

It is not recalculated from ad watches on each request.

Display fields:

- `availableWithdrawalBalance.btcy = userMiningBalance.transferableBalance`
- `availableWithdrawalBalance.usd = transferableBalance * USD_PER_BTCY`
- `pendingUnverifiedEarnings` / `pendingUnverified` = current calendar month earnings, from the 1st day of the current month through the current request time.

Current-month earnings stay pending until the month is complete. Completed month balances become withdrawal-ready only when they are moved into `userMiningBalance.transferableBalance`.

Withdrawal request validation:

1. Find Mining record:

```ts
{ email, coinSymbol: "BTCY" }
```

2. Find user mining balance:

```ts
{ email, coinSymbol: "BTCY" }
```

3. Require:

```text
mining.totalMined >= 1,000,000 BTCY
```

4. Require:

```text
userMiningBalance.transferableBalance >= requestedAmount
```

5. Method limit:

```text
USDT max = min(mining.totalMined, transferableBalance)
USDC max = min(mining.totalMined, transferableBalance)
BTCY max = min(100,000, transferableBalance)
```

The current BTCY internal-transfer limit uses month 1 of this schedule:

```ts
[100000, 150000, 200000, 200000, 200000, 150000]
```

6. Fee:

```text
USDT fee = 10%
USDC fee = 10%
BTCY fee = 3%
approvedAmount = requestedAmount - fee
```

7. On successful request creation:

```text
Mining.totalMined -= requestedAmount
userMiningBalance.transferableBalance -= requestedAmount
WithdrawRequest.status = "Pending"
```

8. When a pending withdrawal is processed:

```text
userWallets.BTCY.coinBalance += approvedAmount
userMiningBalance.migratedBalance += requestedAmount
WithdrawRequest.status = "Approved"
```

Important consequence:

If `availableWithdrawalBalance` looks low, check `userMiningBalance.transferableBalance`. Ad watch totals alone do not make funds withdrawable until another process has moved/verified them into `transferableBalance`.

## GET /api/v1/mining/station/overview

High-level station dashboard.

Query params:

- `email` admin only
- `range`
- `from`
- `to`
- `timezone`

Generated from:

- `getOverview(ownerEmail)` for base referral/ad/earnings summary
- owner/referral context
- owner Mining record
- owner userMiningBalance record
- current-month daily active miners
- six-month referral growth

Key fields:

| Field | Source / Calculation |
| --- | --- |
| `owner` | User profile fields. |
| `qualificationStatus` | `qualified` if `isKYCPass` or `kycStatus` is approved/verified, otherwise `pending_verification`. |
| `miningStatus` | Owner Mining `isMiningActive`. |
| `totalMiners` | Number of users whose `referralCodeUsed` equals owner's `referralCode`. |
| `activeMiners` | Referrals with ad count greater than zero in selected range. |
| `monthlyVerifiedAdRevenue` | Current-month gross ad revenue. |
| `currentMonthEarnings` | Current calendar month revenue share. |
| `lifetimeEarned` | Lifetime referral ad revenue share, including amounts already withdrawn. |
| `pendingUnverifiedEarnings` | Current calendar month revenue share pending month-end completion. |
| `availableWithdrawalBalance` | Withdrawal-ready balance from `userMiningBalance.transferableBalance`. |
| `dailyActiveMiners` | Current-month daily unique ad-watch emails. |
| `monthlyGrowthRate` | New referrals grouped by month from owner referral code. |
| `adImpressionsHistory` | Ad impressions grouped by the overview history granularity. |
| `totalAdImpressionsThisMonth` | Current-month ad count from referred users. |
| `topReferrals` | Top 10 referrals by selected range ad count. |

Example:

```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  "https://api.v1.indexx.ai/api/v1/mining/station/overview?range=30d"
```

## GET /api/v1/mining/station/earnings

Detailed earnings page data.

Query params:

- `email` admin only
- `range`
- `from`
- `to`
- `timezone`

Generated from:

- base `getOverview(ownerEmail)`
- userMiningBalance
- previous-month ad totals
- 12-month earnings history

Key fields:

| Field | Source / Calculation |
| --- | --- |
| `lifetimeEarned` | Lifetime earnings from referred ad watches, including amounts already withdrawn. |
| `currentMonthEarnings` | Current calendar month earnings. |
| `pendingUnverified` | Current calendar month earnings pending month-end completion. |
| `availableWithdrawalBalance` | Withdrawal-ready balance from `userMiningBalance.transferableBalance`. |
| `allocationRate` | Revenue share percent. |
| `nextPayoutAt` | First day of next month. |
| `earningsHistory` | Last 12 months grouped by month. |
| `revenueSources` | Current implementation returns ad impressions plus zero placeholder rows for referral/performance bonus. |
| `growthVsLastMonth` | Current-month earnings compared to previous-month earnings. |

## GET /api/v1/mining/station/referrals

Paginated referral list.

Query params:

- `email` admin only
- `range`
- `from`
- `to`
- `timezone`
- `page`
- `pageSize`

Generated from:

- owner referral code
- referred user profiles
- ad counts for selected range
- ad counts for current month
- Mining records for referred users

Key fields:

| Field | Source / Calculation |
| --- | --- |
| `totals.totalReferrals` | Number of referred users. |
| `totals.activeReferrals` | Referrals with mining active or current-month ad count > 0. |
| `totals.newReferralsThisMonth` | Referred users whose ObjectId timestamp falls in current month. |
| `totals.earnedThisMonth` | Sum of current-month earnings from all referrals. |
| `referrals[].adsWatchedCurrentRange` | Ad count in requested range. |
| `referrals[].earnedCurrentRange` | Earnings in requested range. |
| `referrals[].earnedThisMonth` | Earnings in current month. |
| `referrals[].lastActiveAt` | Latest of user lastActive, ad watch, or mining last claim. |
| `referrals[].status` | `active` if mining active or current-month ad count > 0. |

## GET /api/v1/mining/station/miners

Paginated miner list.

Query params:

- `email` admin only
- `page`
- `pageSize`

Current behavior:

- Ad counts include all ad types.
- Miner table ad count is all-time/lifetime ad count, not current month.
- `adsWatchedMonthly` is currently kept as an alias of `adsWatchedTotal` for frontend compatibility.

Generated from:

- owner referral code
- referred user profiles
- all-time ad counts grouped by referral email
- last-7-days ad counts grouped by referral email
- Mining records only for the returned page
- Mining streak records only for the returned page
- referral counts only for the returned page

Key fields:

| Field | Source / Calculation |
| --- | --- |
| `totals.totalMiners` | Number of referred users. |
| `totals.activeLast7Days` | Referred users with at least one ad watch in the last 7 days. |
| `totals.totalAdsWatched` | Sum of all-time ad watches for all referred users. |
| `totals.avgAdsWatched` | `totalAdsWatched / totalMiners`. |
| `totals.avgMonthlyAds` | Backward-compatible alias of `avgAdsWatched`. |
| `miners[].adsWatchedTotal` | All-time ad watches for that miner. |
| `miners[].adsWatchedMonthly` | Alias of `adsWatchedTotal`. |
| `miners[].isMining` | Mining record `isMiningActive`. |
| `miners[].referralsCount` | Number of users who used that miner's referral code. |
| `miners[].lastActiveAt` | Latest of user lastActive, latest ad watch, and mining last claim. |

Sorting:

1. Descending `adsWatchedTotal`
2. Ascending email

Example:

```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  "https://api.v1.indexx.ai/api/v1/mining/station/miners?page=0&pageSize=20"
```

## GET /api/v1/mining/station/analytics

Analytics charts and engagement metrics.

Query params:

- `email` admin only
- `timezone`

Generated from current-month and previous-month ad aggregates.

Key fields:

| Field | Source / Calculation |
| --- | --- |
| `revenueGrowthPercent` | Current-month earnings vs previous-month earnings. |
| `revenueGrowthDelta` | Current-month earnings USD minus previous-month earnings USD. |
| `avgDailyActive` | Average daily unique active referred users in current month. |
| `avgAdImpressionsPerDay` | Current-month ads divided by elapsed current-month days. |
| `engagementRate` | Active current-month referrals / total referrals * 100. |
| `revenueTrend` | Last 12 months grouped by month. |
| `minerActivityByHour` | Current-month ads grouped by hour and unique active miners. |
| `engagementDistribution` | Current-month referrals bucketed by ad count: 0, 1-10, 11-25, 26+. |
| `weeklyReferralPerformance` | Last 8 weeks of ad count, active miners, and earnings. |

## GET /api/v1/mining/station/withdrawals

Withdrawal page data.

Query params:

- `email` admin only
- `page`
- `pageSize`

Generated from:

- owner User BTCY wallets
- `userMiningBalance`
- `WithdrawRequest` history
- pending withdrawal aggregation

Key fields:

| Field | Source / Calculation |
| --- | --- |
| `availableWithdrawalBalance` | `userMiningBalance.transferableBalance`. |
| `minimumWithdrawal` | Fixed `1,000,000 BTCY`. |
| `supportedMethods` | USDT 10% fee, USDC 10% fee, BTCY 3% fee. |
| `savedPayoutDestinations` | User wallets where `coinSymbol` is BTCY. |
| `pendingWithdrawalSummary.count` | Count of pending requests. |
| `pendingWithdrawalSummary.requestedAmount` | Sum of pending requested amounts. |
| `pendingWithdrawalSummary.approvedAmount` | Sum of pending approved/net amounts. |
| `withdrawalHistory` | Paginated `WithdrawRequest` rows sorted by `createdAt` descending. |

Example:

```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  "https://api.v1.indexx.ai/api/v1/mining/station/withdrawals?page=0&pageSize=20"
```

## POST /api/v1/mining/station/withdrawals

Creates a pending withdrawal request.

Body:

```json
{
  "amount": 1000000,
  "method": "usdt",
  "walletAddress": "SOLANA_WALLET_ADDRESS",
  "network": "Solana Network"
}
```

Allowed methods:

- `usdt`
- `usdc`
- `btcy`

Validation:

- User must be authenticated.
- `amount` must be greater than `0` and is interpreted as BTCY.
- `method` must be `usdt`, `usdc`, or `btcy`.
- `walletAddress` is required for `usdt` and `usdc`.
- Mining record must exist for BTCY.
- `mining.totalMined` must be at least `1,000,000`.
- `userMiningBalance.transferableBalance` must cover the requested amount.
- Requested amount must not exceed method max.

Successful response:

```json
{
  "status": 200,
  "data": {
    "message": "Withdrawal request submitted successfully",
    "withdrawal": {
      "orderId": "1780000000000",
      "email": "user@example.com",
      "requestedAmount": 1000000,
      "approvedAmount": 900000,
      "status": "Pending",
      "withdrawalMethod": "USDT",
      "walletAddress": "SOLANA_WALLET_ADDRESS",
      "network": "Solana Network",
      "txHash": "",
      "createdAt": "2026-06-03T00:00:00.000Z"
    }
  }
}
```

Common failure messages:

```json
{ "status": 400, "data": { "message": "amount must be greater than 0" } }
```

```json
{ "status": 400, "data": { "message": "method must be USDT, USDC, or BTCY" } }
```

```json
{ "status": 400, "data": { "message": "You must have at least 1,000,000 BTCY to withdraw." } }
```

```json
{ "status": 400, "data": { "message": "Insufficient available withdrawal balance." } }
```

## Related Earnings Routes

These routes use the same `MiningStationEarningsService` but are mounted at `/api/v1/earnings`.

### GET /api/v1/earnings/overview

Returns the base earnings overview used internally by station overview/earnings.

Data generated from:

- owner profile
- owner referral code
- referred users
- ad aggregates for lifetime, current range, current month, and history

### GET /api/v1/earnings/user

Returns earnings for one user's own ad watches, not station referral earnings.

Data generated from:

- lifetime ad watches for that email
- selected range ad watches for that email
- current-month ad watches for that email

### GET /api/v1/earnings/users

Admin-style paginated list of all users with ad-watch earnings in a range.

Data generated from:

- `AdMiningWatch` grouped by email
- selected range only
- sorted by ad count descending

## Troubleshooting

### Ads Watched Looks Higher Than Before

This is expected after the latest change. Counts now include every recorded ad type instead of only `rewarded` and `interstitial`.

Revenue still only uses `rewarded` and `interstitial` CPM calculations.

### Miners API Ads Are Not Current Month

`GET /miners` now returns all-time/lifetime ad counts:

- `adsWatchedTotal`
- `adsWatchedMonthly` as a compatibility alias

Current-month ad metrics still exist in overview, earnings, referrals, and analytics where fields explicitly say current month.

### Withdrawal Balance Is Zero But Ads Exist

The withdrawal balance uses:

```text
userMiningBalance.transferableBalance
```

It does not directly equal ad counts or calculated lifetime earnings. Check the process that moves verified earnings into `transferableBalance`.

### Last Active Exists But Ads Watched Is Zero

`lastActiveAt` may come from:

- User `lastActive`
- latest ad watch
- Mining `lastClaimTime`

A user can be active in the app or mining without having counted ad-watch records.

### Response Still Shows Old Data

Responses can be cached for up to 5 minutes in Redis. Withdrawal submission invalidates station caches for that owner.

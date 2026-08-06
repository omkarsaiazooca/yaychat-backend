# Mining Station — End-to-End Walkthrough

This document covers the complete lifecycle of the Mining Station: referral setup, ad watching, real-time earnings crediting, withdrawal (all three methods), and admin processing.

---

## The Cast

| Person | Role |
|---|---|
| **Alice** | Mining Station owner. Referral code `ALICE2026`. |
| **Bob** | Alice's referred miner. Watches ads in the app. |
| **Carol** | Another referred miner of Alice. |

Current rates used throughout:

| Rate | Value | Source |
|---|---|---|
| Rewarded ad CPM | $0.9785 | AdMob Reporting API (7-day avg, Redis cache 24 h) |
| Interstitial CPM | $0.00 | AdMob Reporting API |
| Revenue share | 30% | `MINING_STATION_REFERRAL_REVENUE_SHARE_PCT` env var |
| BTCY price | ~$0.063 | Live price API (in-memory cache 5 min) |

---

## Stage 1 — Referral Setup

Bob downloads the app and signs up using Alice's referral link.

```
User collection — Bob's record
──────────────────────────────
email:            bob@example.com
referralCodeUsed: ALICE2026
kycStatus:        approved
```

The station API resolves Alice's miners by querying:

```js
User.find({ referralCodeUsed: "ALICE2026" })
```

Alice's station now shows `totalMiners: 1`.

---

## Stage 2 — Bob Watches an Ad

There are **two separate screens** in the app where Bob watches ads. Both now credit Alice's station.

---

### Path A — Mining Ad Watch

Bob watches an ad as part of his mining activity. The app calls:

```bash
POST /api/v1/adMiningWatch/record
{
  "email": "bob@example.com",
  "adType": "rewarded",
  "placement": "mining_block"
}
```

```
AdMiningWatchService.record():
  1. AdMiningWatch document written { adType: "rewarded", timestamp: now }
  2. adRevenueCreditingService.creditAdWatch("bob", "rewarded") [fire-and-forget]
     → credits Alice only if adType is "rewarded" or "interstitial"
     → skipped/failed types ("rewarded_ad_skipped", "rewarded_ad_failed") are ignored
```

---

### Path B — Daily Ads Reward Screen

Bob watches ads on the daily rewards screen to earn mining time. The app calls:

```bash
POST /api/v1/rewards/new-watch
{
  "email": "bob@example.com",
  "adId":  "ad_unit_001",
  "watchId": "unique_watch_session_id",
  "secondsWatched": 30
}
```

This endpoint is only called for **completed** rewarded ads. Skipped ads are handled by the client and never reach the backend.

```
dailyAdsService.logWatchV2():
  1. DailyAds count++ (daily limit = 25 ads/day, duplicates by watchId ignored)
  2. AdMiningWatch record written { adType: "rewarded", txId: watchId }
     → drives adsWatchedTotal on the miners page
  3. adRevenueCreditingService.creditAdWatch("bob", "rewarded") [fire-and-forget]
     → always "rewarded" — skipped ads never reach this endpoint
```

---

### What `creditAdWatch()` Does (Same for Both Paths)

```
1. Find Bob's referralCodeUsed   → "ALICE2026"
2. Find owner of "ALICE2026"     → alice@example.com
3. Get CPM from AdMob API        → $0.9785  (Redis cache 24h)
4. Get BTCY price                → $0.063   (in-memory cache 5min)
5. Calculate per-ad earnings:
     grossUsdPerAd = $0.9785 / 1000          = $0.0009785
     earningsUsd   = $0.0009785 × 30%        = $0.00029355
     earningsBtcy  = $0.00029355 / $0.063    = 0.004659 BTCY
6. Write StationEarningsHistory record (rates locked at this moment):
   {
     ownerEmail:      "alice@example.com",
     minerEmail:      "bob@example.com",
     adType:          "rewarded",
     cpmUsd:          0.9785,
     revenueSharePct: 30,
     grossUsdPerAd:   0.0009785,
     earningsUsd:     0.00029355,
     earningsBtcy:    0.004659,
     usdPerBtcy:      0.063,
     createdAt:       2026-06-05T08:15:00Z
   }
7. Alice's balance updated:
     adRevenueTransferableBalance += 0.004659 BTCY  ← immediate
```

Bob's response is returned before step 3 completes — crediting never delays the miner.

### Ad Type Revenue Rules

| Path | adType | Generates station revenue |
|---|---|---|
| `/rewards/new-watch` (Daily Reward Screen) | `rewarded` (always) | ✅ |
| `/adMiningWatch/record` with `rewarded` | `rewarded` | ✅ |
| `/adMiningWatch/record` with `interstitial` | `interstitial` | ✅ |
| `/adMiningWatch/record` with `rewarded_ad_skipped` | `rewarded_ad_skipped` | ❌ |
| `/adMiningWatch/record` with `rewarded_ad_failed` | `rewarded_ad_failed` | ❌ |

---

## Stage 3 — After Many Ad Watches

By end of the day, Bob and Carol have both completed ads:

| Miner | Completed (new-watch calls) | Skipped (no API call) | Revenue-Generating |
|---|---|---|---|
| Bob | 4 | 1 | 4 |
| Carol | 2 | 0 | 2 |
| **Total** | **6** | **1** | **6** |

Alice's `adRevenueTransferableBalance` after 6 credited ads:

```
6 ads × 0.004659 BTCY = 0.027954 BTCY
```

Alice's dashboard (`GET /api/v1/mining/station/earnings`):

```json
{
  "lifetimeEarned":             { "usd": 0.00176, "btcy": 0.027954 },
  "currentMonthEarnings":       { "usd": 0.00176, "btcy": 0.027954 },
  "pendingUnverified":          { "usd": 0.00176, "btcy": 0.027954 },
  "availableWithdrawalBalance": { "btcy": 0.027954, "usd": 0.00176 },
  "allocationRate": 30,
  "growthVsLastMonth": { "percent": 100, "delta": { "usd": 0.00176, "btcy": 0.027954 } },
  "earningsHistory": [
    { "bucket": "2026-01", "adsWatched": 0, "grossRevenueUsd": 0,        "earningsUsd": 0,      "earningsBtcy": 0        },
    { "bucket": "2026-02", "adsWatched": 0, "grossRevenueUsd": 0,        "earningsUsd": 0,      "earningsBtcy": 0        },
    { "bucket": "2026-03", "adsWatched": 0, "grossRevenueUsd": 0,        "earningsUsd": 0,      "earningsBtcy": 0        },
    { "bucket": "2026-04", "adsWatched": 0, "grossRevenueUsd": 0,        "earningsUsd": 0,      "earningsBtcy": 0        },
    { "bucket": "2026-05", "adsWatched": 0, "grossRevenueUsd": 0,        "earningsUsd": 0,      "earningsBtcy": 0        },
    { "bucket": "2026-06", "adsWatched": 6, "grossRevenueUsd": 0.005871, "earningsUsd": 0.00176, "earningsBtcy": 0.027954 }
  ]
}
```

**Data source:** All earnings fields read from `StationEarningsHistory` — rates are locked at the moment each ad was watched. CPM or BTCY price changes never retroactively affect historical earnings.

---

## Stage 4 — Alice Withdraws (Three Methods)

Minimum withdrawal: **$50 USD**. Maximum: **$1,000 USD**. Amount is always in USD.

### Method 1 — USDT (Solana)

```bash
POST /api/v1/mining/station/withdrawals
{
  "amount": 50,
  "method": "usdt",
  "walletAddress": "ALICE_SOLANA_ADDRESS"
}
```

```
Fee: 10%
feeAmountUsd        = $50 × 10%       = $5
approvedAmountUsd   = $50 - $5        = $45
amountBtcy          = $50 / $0.063    = 793.65 BTCY  ← deducted immediately
requestedAmountBtcy = 793.65 BTCY     ← stored for balance restore on reject

DB changes (immediate):
  adRevenueTransferableBalance -= 793.65 BTCY
  WithdrawRequest { requestedAmount: $50, approvedAmount: $45,
                    payoutCurrency: USDT, source: ad_revenue, status: Pending }
```

Admin sends $45 USDT to Alice's Solana wallet externally, then:

```bash
PUT /api/v1/admin/mining/station/withdrawals/:id/approve
{ "txHash": "solana_tx_hash" }
```

```
DB changes on approval:
  migratedBalance       += 793.65 BTCY
  WithdrawRequest.status = "Approved"
  WithdrawRequest.txHash = "solana_tx_hash"
```

---

### Method 2 — USDC (Solana)

Identical to USDT. Fee: **10%**. Admin sends USDC externally then approves.

```bash
POST /api/v1/mining/station/withdrawals
{
  "amount": 50,
  "method": "usdc",
  "walletAddress": "ALICE_SOLANA_ADDRESS"
}
```

---

### Method 3 — BTCY (Internal — Ying Yang Chain)

No wallet address needed. BTCY credited to wallet immediately on submission.

```bash
POST /api/v1/mining/station/withdrawals
{
  "amount": 50,
  "method": "btcy"
}
```

```
Fee: 3%
feeAmountUsd       = $50 × 3%         = $1.50
approvedAmountUsd  = $50 - $1.50      = $48.50
amountBtcy         = $50 / $0.063     = 793.65 BTCY  ← deducted immediately
payoutBtcy         = $48.50 / $0.063  = 769.84 BTCY  ← credited to wallet immediately

DB changes (immediate):
  adRevenueTransferableBalance -= 793.65 BTCY
  userWallets[coinSymbol=BTCY, coinNetwork="Ying Yang Chain"].coinBalance += 769.84
  WithdrawRequest { payoutCurrency: BTCY, source: ad_revenue, status: Pending }
```

Admin approves (BTCY already in wallet — just marks it):

```bash
PUT /api/v1/admin/mining/station/withdrawals/:id/approve
{ "txHash": "" }
```

```
DB changes on approval:
  migratedBalance       += 793.65 BTCY
  WithdrawRequest.status = "Approved"
```

---

### Rejection (Any Method)

```bash
PUT /api/v1/admin/mining/station/withdrawals/:id/reject
{ "reason": "Invalid wallet address" }
```

```
ad_revenue source:
  adRevenueTransferableBalance += 793.65 BTCY  ← fully restored
  WithdrawRequest.status = "Rejected"
```

---

## Stage 5 — Admin Withdrawal Management

```bash
GET /api/v1/admin/mining/station/withdrawals?status=Pending&page=0&pageSize=20
```

Filters: `email`, `status` (Pending/Approved/Rejected), `method`, `from`, `to`

`source` field in each row distinguishes station ad revenue withdrawals (`ad_revenue`) from miner's own mining withdrawals (`mining_balance`).

---

## Balance Fields Explained

```
userMiningBalance collection (Alice):
─────────────────────────────────────
transferableBalance:          72 BTCY   ← Alice's own mining sessions only
adRevenueTransferableBalance: 0.027954  ← station ad revenue credits only
migratedBalance:              0         ← lifetime withdrawn (all sources)
unverifiedBalance:            0
```

| Field | Credited by | Debited by |
|---|---|---|
| `transferableBalance` | Mining stop/claim process | Mining withdrawal |
| `adRevenueTransferableBalance` | `adRevenueCreditingService` on every completed ad watch | Station ad revenue withdrawal |

---

## Full Flow Diagram

```
Alice shares referral code ALICE2026
         │
         ▼
Bob & Carol sign up with referralCodeUsed = ALICE2026
         │
         ▼
Bob watches an ad — two possible screens:
         │
    ┌────┴──────────────────────────────────┐
    │                                       │
    ▼                                       ▼
PATH A: Mining Ad Screen             PATH B: Daily Reward Screen
POST /api/v1/adMiningWatch/record    POST /api/v1/rewards/new-watch
{ email, adType: "rewarded" }        { email, adId, watchId, secondsWatched }
    │                                       │
    ├─ AdMiningWatch written                ├─ DailyAds.count++ (max 25/day)
    │                                       ├─ AdMiningWatch written { adType: "rewarded" }
    │  (skipped adTypes → no credit)        │  (always "rewarded" — skipped never call this)
    │                                       │
    └──────────────┬────────────────────────┘
                   │
                   ▼
    adRevenueCreditingService.creditAdWatch() [fire-and-forget]
      ├─ Find referrer → alice@example.com
      ├─ CPM from AdMob API (Redis 24h cache) → $0.9785
      ├─ BTCY price (in-memory 5min cache)   → $0.063
      ├─ earningsBtcy = (0.9785/1000) × 30% / 0.063 = 0.004659
      ├─ Write StationEarningsHistory record (rates locked)
      └─ adRevenueTransferableBalance += 0.004659 BTCY
         │
         ▼  (Bob's response already returned — no delay)
         │
Alice opens earnings dashboard
  StationEarningsHistory → lifetimeEarned, currentMonthEarnings, earningsHistory (6 months)
  userMiningBalance.adRevenueTransferableBalance → availableWithdrawalBalance
         │
         ▼
Alice submits withdrawal
  Validate: adRevenueTransferableBalance × usdPerBtcy >= $50 (min)
  amountBtcy = requestedUsd / usdPerBtcy
  Fee: 10% (USDT/USDC) or 3% (BTCY)
  adRevenueTransferableBalance -= amountBtcy  (immediate)
  BTCY method: userWallets[Ying Yang Chain] += payoutBtcy  (immediate)
  WithdrawRequest { status: Pending, source: ad_revenue }
         │
         ▼
Admin: GET /api/v1/admin/mining/station/withdrawals?status=Pending
         │
    ┌────┴────┐
    ▼         ▼
 Approve    Reject
    │         │
    │         └─ adRevenueTransferableBalance += amountBtcy (restored)
    │            WithdrawRequest.status = "Rejected"
    │
    └─ USDT/USDC: admin sends tokens externally → approves with txHash
       BTCY: already in wallet → just marks approved
       migratedBalance += amountBtcy
       WithdrawRequest.status = "Approved"
```

---

## Key Numbers Reference

| Variable | Value | Source |
|---|---|---|
| Rewarded CPM | ~$0.9785 | AdMob Reporting API, 7-day avg, refreshed daily |
| Interstitial CPM | $0 | AdMob Reporting API |
| CPM divisor | 1000 | Fixed — definition of CPM (cost per mille / per 1,000 impressions) |
| Revenue share | 30% | `MINING_STATION_REFERRAL_REVENUE_SHARE_PCT` |
| BTCY price | ~$0.063 | Live price API, refreshed every 5 min |
| Daily ad limit per miner | 25 | Hard-coded in `logWatchV2` |
| Min withdrawal | $50 USD | Hard-coded |
| Max withdrawal | $1,000 USD | Hard-coded |
| USDT fee | 10% | Hard-coded |
| USDC fee | 10% | Hard-coded |
| BTCY fee | 3% | Hard-coded |
| BTCY wallet network | Ying Yang Chain | Hard-coded |
| CPM cache TTL | 24 hours | Redis |
| BTCY price cache TTL | 5 minutes | In-memory |
| Station response cache TTL | 5 minutes | Redis |
| Earnings history window | Last 6 months | Always 6 buckets shown (0-filled) |

---

## Collections Involved

| Collection | Purpose |
|---|---|
| `DailyAds` | Per-miner daily ad count and limit tracking |
| `AdMiningWatch` | Raw ad watch events — drives miners page `adsWatchedTotal` |
| `StationEarningsHistory` | Per-ad credit records for station owners (rates locked at watch time) |
| `userMiningBalance` | `transferableBalance` (mining) + `adRevenueTransferableBalance` (ad revenue) |
| `WithdrawRequest` | Withdrawal requests tagged `source: "ad_revenue"` or `"mining_balance"` |
| `User` | Profiles, referral codes, `userWallets` array |
| `Mining` | Miner's active plan and `totalMined` |

---

## API Endpoints

### Miner (App) — Two Ad Watch Paths

| Method | Path | Screen | Purpose |
|---|---|---|---|
| POST | `/api/v1/adMiningWatch/record` | Mining screen | Record ad watch with explicit adType — credits station owner for `rewarded`/`interstitial` only |
| POST | `/api/v1/rewards/new-watch` | Daily reward screen | Record completed rewarded ad — always `rewarded`, credits station owner + updates daily count |

### Station Owner (Authenticated)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/mining/station/overview` | Station dashboard overview |
| GET | `/api/v1/mining/station/earnings` | Earnings page with 6-month history |
| GET | `/api/v1/mining/station/referrals` | Paginated referral list |
| GET | `/api/v1/mining/station/miners` | Paginated miner list with ad counts |
| GET | `/api/v1/mining/station/analytics` | Charts and engagement metrics |
| GET | `/api/v1/mining/station/withdrawals` | Owner's withdrawal page |
| POST | `/api/v1/mining/station/withdrawals` | Submit withdrawal (USDT/USDC/BTCY) |

### Admin Only (`Admin` / `SuperAdmin` role required)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/admin/mining/station/withdrawals` | List all withdrawals with filters |
| PUT | `/api/v1/admin/mining/station/withdrawals/:id/approve` | Approve and record txHash |
| PUT | `/api/v1/admin/mining/station/withdrawals/:id/reject` | Reject and restore balance |

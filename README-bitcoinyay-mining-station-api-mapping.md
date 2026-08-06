# Bitcoinyay Mining Station API Mapping

This file maps the requested Mining Station frontend APIs to the routes that already exist in this backend.

It separates them into:

- `Available`: can be used now, possibly with only frontend field mapping.
- `Partial`: related backend routes exist, but a wrapper/new endpoint is still recommended.
- `Missing`: no mounted route currently satisfies the requirement.

## Main Existing Route Prefixes

- `/api/v1/inex/user`
- `/api/v1/mining`
- `/api/v1/chat`
- `/api/v1/notification`
- `/api/v1/admining`
- `/api/v1/inex/admin`
- `/api/v1/wallet`

## Requested Endpoint Mapping

| Requested frontend API | Status | Related existing backend routes | Notes |
|---|---|---|---|
| `GET /me` | `Partial` | `GET /api/v1/inex/user/getProfileDetails/:email`, `GET /api/v1/inex/user/getUserByEmail/:email`, `GET /api/v1/mining/getUserMiningBalance/BTCY/:email`, `GET /api/v1/mining/getUserMiningPlanWithPaymentMethod/BTCY/:email`, `GET /api/v1/inex/user/linked-accounts?includeBonusHistory=true` | No direct `/me` route exists. `fullName`, `email`, `profilePic` are available. `initials` should be client-derived. `qualificationStatus` is not stored as a field with that name, but can be inferred from `isKYCPass` and `kycStatus`. `stationId` is not present in current models. `monthlyRewardsUsd` does not exist as an exact backend field/aggregate. |
| `GET /notifications` | `Available` | `GET /api/v1/notification/getAllNotifications/:email?page=&limit=` | Good fit for bell dropdown list. |
| `POST /notifications/read` | `Available` | `POST /api/v1/notification/:id/read`, `POST /api/v1/notification/read-all` | Existing backend supports single-read and read-all, but not a unified `/notifications/read` wrapper path. |
| `GET /dashboard/overview` | `Partial` | `GET /api/v1/mining/getMiningDetails/:email`, `GET /api/v1/mining/getMiningHistory/:email`, `GET /api/v1/mining/getUserMiningBalance/BTCY/:email`, `GET /api/v1/admining/count/:email?from=&to=`, `GET /api/v1/inex/admin/getAllBTCYAnalystics`, `GET /api/v1/inex/admin/btcyMinedRange?days=`, `GET /api/v1/inex/admin/newUsersRange?start=&end=` | No single overview route exists. Most cards can be composed from existing routes. `total impressions` can be approximated from ad watch count. User-scoped dashboard wrapper is still recommended. |
| `GET /miners?search=&sort=&page=&limit=` | `Partial` | `GET /api/v1/mining/getAllMiningUsers/BTCY`, `GET /api/v1/inex/admin/getAllBTCYUsers` | There is no mounted miners list with server-side `search`, `sort`, `page`, or `limit`. `/getAllMiningUsers/BTCY` is the best related route because it already enriches rows with name, email, phone, balance, mining status, profile pic, username, referral code. |
| `GET /miners/summary` | `Partial` | `GET /api/v1/inex/admin/getAllBTCYMiningUsersCount`, `GET /api/v1/inex/admin/getAllBTCYAnalystics`, `GET /api/v1/inex/admin/totalBTCYMined` | Data exists, but there is no dedicated miners summary route. |
| `GET /analytics/overview?range=` | `Partial` | `GET /api/v1/inex/admin/btcyMinedRange?days=`, `GET /api/v1/inex/admin/btcyMinedWindows?hours=`, `GET /api/v1/inex/admin/newUsersRange?start=&end=`, `GET /api/v1/inex/admin/getAllBTCYAnalystics`, `GET /api/v1/admining/count/:email?from=&to=` | Revenue/mining trend style data exists only in pieces. No single route returns revenue trend, hourly miner activity, engagement distribution, weekly referrals, and top metrics together. Several requested analytics slices are currently missing as first-class APIs. |
| `GET /messages/recipients?search=` | `Partial` | `GET /api/v1/inex/user/getAllUsersLite`, `GET /api/v1/inex/user/getHiveUsersLite`, `GET /api/v1/inex/user/getUserByEmail/:email`, `GET /api/v1/inex/user/getUserByUsername/:username` | No dedicated recipient search route exists. Best current option is fetch-all-lite plus client-side search, or exact search by email/username. |
| `GET /messages/recent?type=` | `Partial` | `GET /api/v1/chat/lastmessages/:email`, `GET /api/v1/chat/groups?email=` | Direct recent chats already exist via `/lastmessages/:email`. Group recent chats exist via `/groups?email=` with `lastMessage` and `lastMessageAt`. No unified `type`-based endpoint exists. |
| `POST /messages` for direct + broadcast | `Partial` | `POST /api/v1/chat/messages`, `POST /api/v1/chat/sendGroupmessage`, `POST /api/v1/chat/groups/custom`, `POST /api/v1/chat/groups/referral` | Direct messaging is already available through `/chat/messages` with payload `{ email, to, message, ... }`. Broadcast/group send is a separate API: `/chat/sendGroupmessage` with payload `{ email, groupId? or groupName?, message, ... }`. The requested unified payload `{ type, recipientId?, message }` does not exist yet. |
| `GET /referrals/overview` | `Partial` | `GET /api/v1/inex/user/referrals/:email`, `GET /api/v1/inex/user/getAllRefferedUsers/:email`, `GET /api/v1/inex/user/getReferredUserDetails/:email`, `GET /api/v1/inex/user/validatereferralcode/:referralCode`, `GET /api/v1/inex/user/getMiningLiteDetails/:email`, `GET /api/v1/inex/user/referral-code` | Referral-related APIs already exist. `recent referrals list`, `count`, and `referral earnings` are available from existing routes. There is no dedicated overview wrapper yet, but there is now a dedicated auth-based API for the current user's referral code and referral URL. |
| `GET /referral-code` | `Available` | `GET /api/v1/inex/user/referral-code`, `GET /api/v1/inex/user/getMiningLiteDetails/:email` | `GET /api/v1/inex/user/referral-code` is the new dedicated auth-based endpoint for the current user. It returns `referralCode` and `referralUrl` without requiring `:email`. |
| `GET /referrals/qr` | `Not needed` | Use `GET /api/v1/inex/user/referral-code` | Better to return the referral URL and generate the QR client-side, as requested. |
| `GET /earnings/overview` | `Available` | `GET /api/v1/earnings/overview`, `GET /api/v1/inex/user/referrals/:email`, `GET /api/v1/inex/user/getAllRefferedUsers/:email`, `GET /api/v1/admining/count/:email?from=&to=`, `GET /api/v1/admining/list/:email?from=&to=&limit=` | Now implemented as `GET /api/v1/earnings/overview` behind auth. It derives earnings from `AdMiningWatch` activity of the authenticated user's referrals. Primary formula is now `rewarded ads / 1000 * AdMob CPM * referral share %`, with range support for `range`, `from`, `to`, `timezone`, and optional admin `email` override. |
| `GET /withdrawals/overview` | `Partial` | `GET /api/v1/mining/getUserMiningBalance/BTCY/:email`, `POST /api/v1/inex/user/getTransactions/:email`, `GET /api/v1/inex/admin/getAllCrytoWithdrawRequests` | There is no user-facing withdrawals overview route that returns available balance, minimum, supported methods, and history together. History can be approximated from transactions filtered by withdrawal types. |
| `POST /withdrawals/requests` | `Missing` | Nearby but not matching: `POST /api/v1/inex/user/withdrawBTCY`, `POST /api/v1/wallet/sendCrypto` | No mounted route matches the requested payload `{ method, walletAddress, amountUsd }`. `withdrawBTCY` migrates mining balance to wallet and does not accept method/address/amount. `wallet/sendCrypto` sends crypto from an existing wallet and is a different workflow. |
| `POST /withdrawals/validate-address` | `Missing/buggy` | Nearby: `POST /api/v1/wallet/verify/:coin`, `POST /api/v1/inex/wallet/verify/:coin` | A wallet verification route is mounted, but the controller currently expects `req.params.email` even though the route does not provide `:email`. This is not usable as a clean address-validation API in its current state. |

## Best Existing APIs By Feature

### Header and profile

- `GET /api/v1/inex/user/getProfileDetails/:email`
- `GET /api/v1/inex/user/getUserByEmail/:email`
- `GET /api/v1/mining/getUserMiningBalance/BTCY/:email`
- `GET /api/v1/mining/getUserMiningPlanWithPaymentMethod/BTCY/:email`

### Notifications

- `GET /api/v1/notification/getAllNotifications/:email?page=&limit=`
- `GET /api/v1/notification/countUnread/:email`
- `POST /api/v1/notification/:id/read`
- `POST /api/v1/notification/read-all`

### Mining dashboard and miners

- `GET /api/v1/mining/getMiningDetails/:email`
- `GET /api/v1/mining/getMiningHistory/:email`
- `GET /api/v1/mining/getCurrentMiningRewards/BTCY/:email`
- `GET /api/v1/mining/getMiningRewardSummary/BTCY?email=...`
- `GET /api/v1/mining/getAllMiningUsers/BTCY`
- `GET /api/v1/inex/admin/getAllBTCYMiningUsersCount`
- `GET /api/v1/inex/admin/getAllBTCYAnalystics`
- `GET /api/v1/inex/admin/btcyMinedRange?days=`
- `GET /api/v1/inex/admin/btcyMinedWindows?hours=`

### Ad impressions / ad activity

- `GET /api/v1/admining/count/:email?from=&to=`
- `GET /api/v1/admining/list/:email?from=&to=&limit=`

### Chat and messaging

- `POST /api/v1/chat/messages`
- `POST /api/v1/chat/sendGroupmessage`
- `GET /api/v1/chat/messages/:email`
- `GET /api/v1/chat/lastmessages/:email`
- `POST /api/v1/chat/messages/read`
- `GET /api/v1/chat/counts/unread?email=...`
- `GET /api/v1/chat/groups?email=...`
- `POST /api/v1/chat/groups/:groupId/read`

### Referrals

- `GET /api/v1/inex/user/referral-code`
- `GET /api/v1/inex/user/referrals/:email`
- `GET /api/v1/inex/user/getAllRefferedUsers/:email`
- `GET /api/v1/inex/user/getReferredUserDetails/:email`
- `GET /api/v1/inex/user/validatereferralcode/:referralCode`
- `GET /api/v1/inex/user/getMiningLiteDetails/:email`

### Earnings and transaction history

- `GET /api/v1/earnings/overview`
- `GET /api/v1/inex/user/referrals/:email`
- `GET /api/v1/inex/user/getAllRefferedUsers/:email`
- `GET /api/v1/admining/count/:email?from=&to=`
- `GET /api/v1/admining/list/:email?from=&to=&limit=`

Note:

- `/api/v1/earnings/overview` is the aggregate API for Mining Station earnings.
- The supporting referral/ad-watch routes remain the raw source APIs.
- The legacy mining/reward routes are not the source if earnings must come from referral ad-watch activity.

## Exact Fields Or Behaviors That Are Not Available Today

- No mounted `/me` endpoint.
- No stored `stationId` field found in current user, mining, chat, notification, or referral models.
- No exact `qualificationStatus` field. The closest existing fields are `isKYCPass` and `kycStatus`.
- No exact `monthlyRewardsUsd` field or monthly BTCY-to-USD aggregate route.
- No miners endpoint with server-side `search`, `sort`, `page`, and `limit`.
- No single `/dashboard/overview` route.
- No single `/analytics/overview` route.
- No single `/withdrawals/overview` route.
- No `/messages/recipients?search=` route.
- No unified `/messages/recent?type=` route.
- No unified `/messages` route that accepts `{ type, recipientId?, message }` for both direct and broadcast.
- No mounted `/withdrawals/requests` route even though `services/miningWithdrawRequest.service.ts` already exists.
- No clean address-validation route matching `/withdrawals/validate-address`.

## Practical Recommendation

If the goal is to move fast without rewriting existing logic, the cleanest approach is:

- Reuse existing `chat` routes as-is for direct chat and group/broadcast chat.
- Reuse existing `user`, `mining`, `notification`, `admining`, and `referral` routes for raw data sources.
- Add thin wrapper endpoints for:
  - `/me`
  - `/dashboard/overview`
  - `/miners`
  - `/miners/summary`
  - `/analytics/overview`
  - `/messages/recipients`
  - `/messages/recent`
  - `/referrals/overview`
  - `/withdrawals/overview`
  - `/withdrawals/requests`
  - `/withdrawals/validate-address`

That gives the frontend stable Mining Station contracts without breaking the older legacy routes already used elsewhere in the backend.

## Earnings API

Mounted route:

- `GET /api/v1/earnings/overview`

Authentication:

- Requires `Authorization: Bearer <token>`
- Uses the authenticated user's email by default
- Supports `?email=` override only for `Admin` and `SuperAdmin`

Supported query params:

- `range=7d|30d|90d|all`
- `from=<ISO date>`
- `to=<ISO date>`
- `timezone=<IANA timezone>`

Response includes:

- owner info
- selected range info
- totals for `lifetime`, `current`, `currentMonth`, `pending`, `withdrawable`
- allocation info and top referrals
- `revenueSources`
- `metrics`
- `history`
- `referralBreakdown`

Rate config:

- `GOOGLE_ADMOB_REWARDED_CPM_USD`
- `MINING_STATION_ADMOB_CPM_USD`
- `MINING_STATION_REFERRAL_REVENUE_SHARE_PCT`
- `MINING_STATION_USD_PER_BTCY`

Legacy fallback config still supported when CPM is not set:

- `MINING_STATION_EARNING_USD_PER_AD`
- `MINING_STATION_EARNING_BTCY_PER_AD`

Formula:

- `grossRevenueUsd = adsWatched / 1000 * admobCpmUsd`
- `earningsUsd = grossRevenueUsd * (revenueSharePct / 100)`
- `earningsBtcy = earningsUsd / usdPerBtcy` when `MINING_STATION_USD_PER_BTCY` is configured

If no AdMob CPM env is set, the API falls back to the older fixed per-ad envs. If neither CPM nor fixed per-ad envs are set, the API still returns referral ad counts and breakdowns, but monetary/token earnings default to `0`.

## Updated Earnings Requirement

For this Mining Station flow, earnings should be derived like this:

1. Resolve the user's referrals.
2. Read `AdMiningWatch` records for those referred users.
3. Count watched ads in the requested range.
4. Apply the business earning formula using AdMob CPM and the referral revenue share.
5. Return totals, allocation/source breakdown, and history from that derived ad-watch dataset.

What exists today:

- Referral lookup exists.
- Ad watch storage exists.
- User-level ad count/list APIs exist.

What did not exist before this change:

- A referral-ad aggregate route.
- A ready-made earnings history built from referral ad-watch events.

What still needs configuration:

- The AdMob CPM value via env vars.
- The referral revenue share percent if it should differ from the default `30%`.
- Optional BTCY conversion rate if `earningsBtcy` should be populated from USD.

## Referral Code API

Mounted route:

- `GET /api/v1/inex/user/referral-code`

Authentication:

- Requires `Authorization: Bearer <token>`
- Uses the authenticated user's email from `validateAuthHeader`

Response includes:

- `email`
- `username`
- `fullName`
- `referralCode`
- `referralUrl`

Notes:

- This is the dedicated Mining Station-friendly API for fetching the current user's referral code.
- It avoids exposing `:email` in the route for the common "share my referral link" flow.
- `referralUrl` is built from `BITCOINYAY_REFERRAL_BASE_URL` when set.
- Default referral URL pattern is `https://bitcoinyay.com/referral=<code>`, which matches the existing Bitcoinyay email/share flow currently in the repo.

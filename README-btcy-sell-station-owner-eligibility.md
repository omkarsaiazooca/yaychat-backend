# BTCY Sell — Mining Station Owner Eligibility Gate

## Summary

Selling BTCY via `POST /createSellOrder` is now restricted to users who qualify as
**mining station owners** — defined as having **25 or more referrals**
(`user.relationships.length >= 25`). This gate applies only to the primary
user-facing sell flow. It does **not** apply to the EMMM-partner BTCY debit path
(`debitBtcyForEmmm`), which is a separate integration.

## Where it lives

| Piece | File |
| --- | --- |
| Constant | `MIN_STATION_OWNER_REFERRALS = 25` — `platform/sell.operation.ts` |
| Helper | `isEligibleStationOwnerForSell(user)` — `platform/sell.operation.ts` |
| Enforcement | `createSellBtcyOrder()` — `platform/sell.operation.ts` |
| Preflight (read-only) | `getSellBtcyEligibility()` (`GET /eligibility`) — `platform/sell.operation.ts` |

`isEligibleStationOwnerForSell` reuses the `user.relationships` array already
loaded by `userService.findOne({ email })` — no extra DB query is made. This
mirrors the referral-count pattern used in `services/daoUser.service.ts`
(`referralCount = userDoc?.relationships?.length || 0`).

## Old vs. new checks (`createSellBtcyOrder`)

| # | Check | Before | After |
| --- | --- | --- | --- |
| 1 | KYC approved | Required | Unchanged |
| 2 | **Mining station owner (25+ referrals)** | Not checked | **New** — checked immediately after the KYC gate |
| 3 | Eligible BTCY (purchased via USDT/USDC/PayPal/Stripe or completed Alchemy session, not mined) | Required | Unchanged |
| 4 | Sell amount > 0 | Required | Unchanged |
| 5 | Minimum $10 receive value | Required | Unchanged |
| 6 | Amount within remaining eligible allowance | Required | Unchanged |
| 7 | Sell service open (admin `sellConfig.status`) | Required | Unchanged |
| 8 | Sufficient BTCY wallet balance (Ying Yang Chain) | Required | Unchanged |

Order of evaluation: **KYC → station owner (25+ referrals) → purchase-eligible BTCY
→ amount validity → min $10 → within allowance → service open → wallet balance**.

## Failure response

If the user has fewer than 25 referrals:

```json
{
  "status": 403,
  "message": "Only mining station owners with 25 or more referrals can sell BTCY."
}
```

## Read-only eligibility endpoint

`GET /eligibility` (`getSellBtcyEligibility`) now also returns:

```json
{
  "isStationOwner": false,
  "message": "Only mining station owners with 25 or more referrals can sell BTCY."
}
```

This lets the frontend show the restriction before the user attempts a sell.

## Explicitly out of scope

- `debitBtcyForEmmm` (EMMM-partner BTCY debit) — untouched, no station-owner gate.
- Admin-side order flows (`approveSellOrder`, `completeSellOrderManually`,
  `cancelSellBtcyOrder`) — untouched, since eligibility is enforced at order
  creation time only.

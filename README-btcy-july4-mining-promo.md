# Bitcoin-yay — July 4th (US Independence Day) Mining Promo Proposal

Campaign window proposed: **July 3–7, 2026** (4th of July + surrounding weekend).
All offers below are built entirely from existing reward primitives — no new
mining-rate systems or wallets are required.

## Existing building blocks these offers reuse

| Primitive | File | What it does |
| --- | --- | --- |
| `pendingRewards` turbo-time queue | `services/btcyReward.service.ts`, `services/miningStreak.service.ts` (`queueTurboDays`/`queueTurboMinutes`) | Grants N days/minutes of Electric or Turbo Power, deduped by a `source` string, auto-applies when the user's session/plan ends |
| Airdrop Campaign container | `README-airdrop-campaign-api.md` (`POST /airdrop-campaign`) | Date-scoped campaign with banner/title/body/CTA — `startDate`/`endDate`/`active` |
| Mining streak bonus | `services/miningStreak.service.ts` | Template for "mine N consecutive days → auto-grant days of Electric/Turbo Power" |
| Group-owner bonus anti-abuse pattern | `README-btcy-chat-group-owner-bonus-plan.md` | Once-per-user, cooldown-capped reward-history template to prevent double-claiming |
| Daily boost claim | `services/btcyReward.service.ts` (`claimDailyBoost`, +120 min/day) | Existing once-daily turbo-minute grant we can temporarily 2x |
| Special mining eligibility whitelist | `services/specialMiningEligibility.service.ts` | Per-user override for extended session hours / ad-skip — usable for a VIP tier of this promo |

## Proposed offers

### 1. "Independence Boost" — flat claim, everyone eligible
- **What:** Any user who opens the app during July 3–7 can claim **4 days of Turbo Power** (mirrors the existing BTCY Tron Airdrop's "7 days Turbo" one-time claim pattern).
- **Mechanism:** New Airdrop Campaign entry (banner: "🎆 Independence Day Mining Blast") + one `queueTurboDays(user, 4, source: "july4_2026_promo")` call, deduped so it can only be claimed once.
- **Why this one:** Zero new code paths — it's the Tron-airdrop claim flow with a different `source` key and a shorter grant.

### 2. "4 Days of Freedom" — mining streak challenge
- **What:** Mine on all 4 days (July 3–7, need any 3 of the 5 days) → auto-unlock **4 additional days of Turbo Power**, stacked on top of offer #1 if also claimed.
- **Mechanism:** Reuse `miningStreak.service.ts`'s existing 7-day-streak logic, but with a campaign-scoped threshold (3-of-5 days) and its own `source` key so it doesn't collide with the standing 7-day streak reward.
- **Why this one:** Drives daily re-engagement across the holiday weekend, not just a single claim-and-leave.

### 3. Double Daily Boost
- **What:** During the campaign window, `claimDailyBoost` grants **240 minutes instead of 120** (2x, capped once/day as today).
- **Mechanism:** Feature-flag the existing boost amount for the date range — no new endpoint, just a campaign-aware multiplier read from the Airdrop Campaign config.
- **Why this one:** Cheapest to ship (one constant becomes campaign-conditional); rewards existing daily-active users without requiring them to learn a new flow.

### 4. "Bring a Friend to the Cookout" — referral bonus
- **What:** Referrer and referred user each get **1,440 minutes (1 day) of Turbo Power** if the referred user completes their first mining session during the campaign window.
- **Mechanism:** Same pattern as the existing chat-group-owner bonus (`README-btcy-chat-group-owner-bonus-plan.md`) — once-per-referral-pair reward-history record, capped total grants per referrer to prevent farming (e.g., max 5 referral bonuses per user during the campaign).
- **Why this one:** Reuses the referral relationship already tracked on `User.relationships`/`referralCode`, and directly supports the mining-station-owner eligibility work just shipped (more referrals = station-owner status *and* now a holiday bonus).

## Anti-abuse guardrails (borrowed from the group-owner-bonus template)
- Every grant deduped by a unique `source` string per user per offer.
- Referral bonus capped per referrer to block farming via throwaway accounts.
- Streak challenge requires real mining activity (not just app open) on each qualifying day.
- All offers auto-expire via the Airdrop Campaign's `endDate` — no manual cleanup needed.

## Suggested rollout order
1. Ship #1 (flat claim) and #3 (2x daily boost) first — lowest engineering lift, highest visible "we did something for July 4th" impact.
2. Add #2 (streak challenge) if there's time before the 3rd — needs the campaign-scoped streak threshold.
3. #4 (referral) is the highest-leverage but needs the anti-farming cap reviewed before launch given it touches account creation incentives.

## Open questions for the Bitcoin-yay team
- Budget/ceiling on total Turbo-minutes issued (all four offers are additive if a user completes all of them).
- Whether the VIP/special-eligibility whitelist (`specialMiningEligibility.service.ts`) should get an enhanced version (e.g., ad-free Turbo for the whole weekend) as a loyalty tier on top of the public offers.
- Marketing asset needs (banner copy/art — e.g. the flag/coin artwork already provided) for the Airdrop Campaign entry.

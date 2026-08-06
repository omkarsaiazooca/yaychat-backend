# BTCY Chat Group Owner Bonus Plan

## TL;DR

Starting **June 17, 2026**, a BTCY Chat group owner earns **7 days of Turbo Power mining** when their newly created group reaches **5 or more joined members**. The reward is applied only to the owner, can be granted only once per group, and is capped at **1 reward per owner every 30 days** with only **1 active BTCY Chat group bonus** at a time.

## Effective Date

This promotion is effective from **June 17, 2026**.

The reward should apply to eligible BTCY Chat groups created on or after this date. Groups created before this date should not receive the bonus unless the business explicitly approves a backfill.

## Recommended Offer

**Create a BTCY Chat group with 5 or more joined members and get 7 days of Turbo Power mining.**

This is the best reward option because it is easy for users to understand, valuable enough to motivate group creation, and directly increases mining engagement. The bonus is applied only to the group owner.

## User-Facing Message

Primary campaign copy:

> Create a BTCY Chat group with 5+ members and get 7 days of Turbo Power mining.

Success notification:

> You earned 7 days of Turbo Power mining for creating an active BTCY Chat group.

Short push notification:

> BTCY Chat bonus unlocked: 7 days of Turbo Power mining is now active.

## Eligibility Rules

1. The user must create a BTCY Chat group on or after **June 17, 2026**.
2. The group must reach **5 or more joined members**.
3. The reward is granted to the **group owner only**.
4. The reward can be granted only **once per group**.
5. The group must be an active, non-deleted group when the reward is granted.
6. Members must be real joined users, not pending invites.

## Member Count Rule

Recommended definition:

- **5 or more total joined members including the owner**.

This is easier to communicate as "5+ members" and avoids confusion for users. The backend should treat this as a `joinedMemberCount >= 5` rule.

## Sample Email-Based Example

Example group creation input:

```json
{
  "groupName": "BTCY Mining Friends",
  "ownerEmail": "owner@example.com",
  "memberEmails": [
    "owner@example.com",
    "alice@example.com",
    "bob@example.com",
    "carol@example.com",
    "dave@example.com"
  ]
}
```

Eligibility result:

- Joined member count: `5`
- Owner: `owner@example.com`
- Reward receiver: `owner@example.com`
- Reward: `7 days of Turbo Power mining`
- Result: qualifies because `joinedMemberCount >= 5`

The backend should normalize emails before counting members:

- Trim spaces.
- Convert emails to lowercase.
- Remove duplicate emails.
- Count only users who have successfully joined the group.
- Do not count pending invites or invalid/deleted users.

Example duplicate-safe count:

```ts
const normalizedJoinedEmails = Array.from(
  new Set(
    joinedMembers
      .filter((member) => member.status === "joined" && !member.isDeleted)
      .map((member) => member.email.trim().toLowerCase())
  )
);

const joinedMemberCount = normalizedJoinedEmails.length;
const qualifies = joinedMemberCount >= 5;
```

Non-qualifying example:

```json
{
  "groupName": "Small BTCY Group",
  "ownerEmail": "owner@example.com",
  "memberEmails": [
    "owner@example.com",
    "alice@example.com",
    "bob@example.com",
    "carol@example.com"
  ]
}
```

This group has only `4` joined members, so the owner does not receive the bonus yet. If another valid member joins later, the eligibility check should run again.

## Reward Details

Reward type:

- Turbo Power mining access

Reward duration:

- 7 days

Mining rate:

- Use the existing Turbo Power rate configured by the backend. Current docs list Turbo Power as **9 BTCY/hour**.

Payment method/source:

- Store as a promotional source such as `btcy_chat_group_bonus`.

Recommended subscription/reward label:

- `BTCY Chat Group Bonus - Turbo Power 7 Days`

## Anti-Abuse Controls

Required controls:

1. Grant once per group.
2. Grant only after the group reaches the member threshold with joined members.
3. Do not count deleted, blocked, duplicate, or pending members.
4. Do not grant if the group is deleted before the reward check completes.
5. Store reward history with group ID, owner email/user ID, reward type, effective date, and granted timestamp.

Recommended controls:

1. Limit to **1 BTCY Chat group bonus per owner per 30 days**.
2. Add a **24-hour stability check** before granting, so users cannot create a group, claim the reward, and immediately remove members.
3. At reward time, confirm the group still has at least 5 joined members.
4. Exclude system/global groups from the promotion.

Recommended launch setting:

- Start with the 30-day owner cooldown.
- Add the 24-hour stability check if early abuse appears or if group creation volume is high.

## Maximum Criteria and Reward Caps

Recommended maximum criteria:

- **Minimum group size:** 5 joined members.
- **Maximum reward per group:** 1 reward.
- **Maximum reward per owner:** 1 reward every 30 days.
- **Maximum active BTCY Chat group bonuses per owner:** 1 active bonus at a time.
- **Maximum bonus extension from this campaign:** 7 days per qualifying reward.
- **Lifetime cap per owner:** optional, recommended at 3 total BTCY Chat group bonuses if abuse becomes a concern.

Do not set a maximum group member count. Bigger groups are better for BTCY Chat growth, so the backend should reward the owner once when the group reaches the minimum threshold and then ignore additional member growth for bonus purposes.

Recommended launch rule:

> A user can receive this BTCY Chat group owner bonus once every 30 days, with only one active bonus at a time.

## Backend Implementation Plan

1. Add a reward history model or collection if one does not already exist for promotional mining bonuses.
2. Track these fields:
   - `ownerEmail` or `ownerUserId`
   - `groupId`
   - `rewardType`
   - `plan`
   - `durationDays`
   - `effectiveFrom`
   - `expiresAt`
   - `status`
   - `createdAt`
   - `metadata`
3. Add an eligibility service for BTCY Chat group bonus checks.
4. Trigger the eligibility check in both places:
   - After group creation
   - After a member successfully joins or is added
5. Check whether the group was created on or after **June 17, 2026**.
6. Count joined, active members.
7. Confirm no reward already exists for the group.
8. Confirm the owner has not received this bonus within the cooldown window.
9. Confirm the owner does not already have an active BTCY Chat group bonus.
10. Apply a 7-day Turbo Power promotional mining plan to the owner.
11. Send an in-app/push/email notification to the owner.
12. Log the reward grant for admin review and support.

## Suggested Grant Logic

```ts
if (group.createdAt < new Date("2026-06-17T00:00:00.000Z")) return;
if (group.isDeleted) return;
if (group.isGlobal || group.type === "global") return;

const joinedMemberCount = await countActiveJoinedGroupMembers(group.id);
if (joinedMemberCount < 5) return;

const alreadyRewarded = await rewardHistory.exists({
  groupId: group.id,
  rewardType: "btcy_chat_group_turbo_7d",
});
if (alreadyRewarded) return;

const ownerRecentlyRewarded = await rewardHistory.exists({
  ownerEmail: group.ownerEmail,
  rewardType: "btcy_chat_group_turbo_7d",
  createdAt: { $gte: thirtyDaysAgo },
});
if (ownerRecentlyRewarded) return;

const ownerActiveBonus = await rewardHistory.exists({
  ownerEmail: group.ownerEmail,
  rewardType: "btcy_chat_group_turbo_7d",
  status: "active",
});
if (ownerActiveBonus) return;

await grantTurboPowerMining({
  email: group.ownerEmail,
  durationDays: 7,
  source: "btcy_chat_group_bonus",
  groupId: group.id,
});
```

## Mining Plan Behavior

Recommended behavior:

- If the owner is on Free or Electric Power, upgrade them to Turbo Power for 7 days.
- If the owner already has Turbo Power or Nuclear Power active, queue the 7-day Turbo bonus as a pending promotional reward or extend only if the existing plan is lower/equal. Do not downgrade a stronger active plan.
- If the owner is actively mining when the bonus is granted, apply the plan to the subscription record immediately, but let the existing mining session rules decide whether the current session should continue or restart.

## Admin and Reporting Requirements

Admin should be able to see:

- Total rewards granted
- Owner email/user ID
- Group ID
- Group member count at grant time
- Reward grant date
- Reward expiration date
- Reward status
- Any blocked reason, such as cooldown or duplicate group reward

Recommended dashboard filters:

- Date range
- Owner email
- Group ID
- Reward status

Admin API:

```http
GET /api/v1/chat/admin/groups/bonus-rewards
```

Auth:

- Requires bearer token.
- Requires `Admin` or `SuperAdmin` role.

Query filters:

- `from` or `startDate`: reward date lower bound.
- `to` or `endDate`: reward date upper bound.
- `owner` or `ownerEmail`: owner email.
- `groupId`: BTCY Chat group ID.
- `status` or `rewardStatus`: reward status.
- `page`: zero-based page number, default `0`.
- `pageSize` or `limit`: default `25`, max `100`.

Example:

```bash
curl -H "Authorization: Bearer <token>" \
  "https://api.v1.indexx.ai/api/v1/chat/admin/groups/bonus-rewards?owner=sunkuomkarsai12121@gmail.com&status=active&page=0&pageSize=25"
```

Response fields:

- `summary.totalRewardsGranted`
- `summary.totalRecords`
- `summary.byStatus`
- `rewards[].owner`
- `rewards[].groupId`
- `rewards[].groupMemberCount`
- `rewards[].rewardDate`
- `rewards[].expiryDate`
- `rewards[].rewardStatus`
- `rewards[].rejectionReason`

## Acceptance Criteria

1. A group owner who creates a group with 5 joined members on or after June 17, 2026 receives 7 days of Turbo Power mining.
2. The bonus is applied only to the owner, not all group members.
3. A group can trigger the bonus only once.
4. An owner cannot receive the same bonus more than once within 30 days.
5. An owner cannot have more than one active BTCY Chat group bonus at the same time.
6. Pending invites do not count toward the 5-member threshold.
7. Deleted or global groups do not qualify.
8. The owner receives a notification after the bonus is granted.
9. Reward history is stored for audit and support.

## E2E Test Script

Script:

```bash
scripts/test-btcy-chat-group-bonus.ts
```

Dry-run:

```bash
npm run build
node dist/scripts/test-btcy-chat-group-bonus.js
```

Apply real test:

```bash
npm run build
node dist/scripts/test-btcy-chat-group-bonus.js --apply
```

The script uses `sunkuomkarsai12121@gmail.com` as the group owner, selects 5 registered relationship/referral users, creates a real custom group with 6 total members, evaluates the BTCY Chat group bonus, and verifies:

- Group has at least 5 joined members.
- Bonus history exists.
- Owner notification exists.
- Owner subscription has the 7-day Turbo reward applied or queued.

If the owner is actively mining, the reward remains in `pendingRewards` and applies when the existing mining session is no longer active.

## Launch Recommendation

Launch with this exact offer:

**Create a BTCY Chat group with 5+ members and get 7 days of Turbo Power mining.**

This is the clearest and most attractive version. It gives users a meaningful reason to invite others while keeping backend risk controlled through once-per-group and once-per-owner-per-30-days limits.

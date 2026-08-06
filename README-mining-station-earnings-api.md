# Mining Station Earnings API

This README documents the earnings routes mounted at:

`/api/v1/earnings`

These endpoints are read-only API endpoints for Mining Station ad-watch earnings.

## Authentication

All endpoints require:

`Authorization: Bearer <JWT_TOKEN>`

If the header is missing or invalid, `validateAuthHeader` returns `401`.

Example:

```bash
curl --request GET \
  --url 'http://localhost:3000/api/v1/earnings/overview' \
  --header 'Authorization: Bearer <JWT_TOKEN>'
```

## Important Notes

- There are no route params in these endpoints.
- All filters are passed as query params.
- Earnings are calculated from ad-watch data, not stored as precomputed earnings rows in MongoDB.
- Responses are cached in Redis for 5 minutes.
- Only ad types `rewarded` and `interstitial` are included in earnings calculations.

## Common Query Params

These query params are supported across the earnings endpoints:

| Query | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `email` | string | No | Logged-in user email | Only admins and super admins can request another user's data. |
| `range` | string | No | `30d` | Supports values like `7d`, `30d`, `90d`, `365d`, or `all`. |
| `from` | string | No | - | ISO date/time string. If `from` or `to` is present, API uses `custom` range. |
| `to` | string | No | Current time | ISO date/time string. |
| `timezone` | string | No | `Asia/Kolkata` | Used for current month and history grouping. |
| `page` | number | No | Varies by endpoint | Zero-based page index. |
| `pageSize` | number | No | Varies by endpoint | Page size is capped per endpoint. |

## 1. Overview Endpoint

### Route

`GET /api/v1/earnings/overview`

### Purpose

Returns a referral earnings dashboard for one user:

- owner profile
- referral totals
- current period earnings
- lifetime earnings
- current month earnings
- referral leaderboard
- referral history series

### Access Rules

- Normal user: can fetch only their own overview
- Admin or SuperAdmin: can fetch any user's overview using `?email=...`

### Query Params

| Query | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `email` | string | No | Logged-in user | Optional for admins to fetch another user. |
| `range` | string | No | `30d` | Example: `7d`, `30d`, `all`. |
| `from` | string | No | - | Overrides `range` behavior into custom range. |
| `to` | string | No | now | Overrides `range` behavior into custom range. |
| `timezone` | string | No | `Asia/Kolkata` | Used for history and current month boundaries. |
| `page` | number | No | `0` | Zero-based pagination for `referralBreakdown`. |
| `pageSize` | number | No | `20` | Max `100`. |

### Example Requests

Own overview:

```bash
curl --request GET \
  --url 'http://localhost:3000/api/v1/earnings/overview?range=30d&page=0&pageSize=20' \
  --header 'Authorization: Bearer <JWT_TOKEN>'
```

Admin fetching another user's overview:

```bash
curl --request GET \
  --url 'http://localhost:3000/api/v1/earnings/overview?email=user@example.com&range=all&page=0&pageSize=10' \
  --header 'Authorization: Bearer <JWT_TOKEN>'
```

Custom date range:

```bash
curl --request GET \
  --url 'http://localhost:3000/api/v1/earnings/overview?from=2026-03-01T00:00:00.000Z&to=2026-03-31T23:59:59.999Z&timezone=Asia/Kolkata' \
  --header 'Authorization: Bearer <JWT_TOKEN>'
```

### Success Response

```json
{
  "status": 200,
  "data": {
    "owner": {
      "email": "owner@example.com",
      "referralCode": "ABC123",
      "fullName": "John Doe",
      "firstName": "John",
      "lastName": "Doe",
      "username": "johndoe",
      "profilePic": null
    },
    "range": {
      "key": "30d",
      "from": "2026-03-05T10:00:00.000Z",
      "to": "2026-04-03T10:00:00.000Z",
      "timezone": "Asia/Kolkata",
      "historyGranularity": "day",
      "historyFrom": "2026-03-05T10:00:00.000Z",
      "historyTo": "2026-04-03T10:00:00.000Z"
    },
    "totals": {
      "lifetime": {
        "adsWatched": 2400,
        "grossRevenueUsd": 12.4,
        "revenueSharePct": 30,
        "earningsUsd": 3.72,
        "earningsBtcy": 124.55
      },
      "current": {
        "adsWatched": 180,
        "grossRevenueUsd": 0.95,
        "revenueSharePct": 30,
        "earningsUsd": 0.29,
        "earningsBtcy": 9.71
      },
      "currentMonth": {
        "adsWatched": 54,
        "grossRevenueUsd": 0.28,
        "revenueSharePct": 30,
        "earningsUsd": 0.08,
        "earningsBtcy": 2.83
      },
      "pending": {
        "adsWatched": 0,
        "grossRevenueUsd": 0,
        "revenueSharePct": 30,
        "earningsUsd": 0,
        "earningsBtcy": 0
      },
      "withdrawable": {
        "adsWatched": 2400,
        "grossRevenueUsd": 12.4,
        "revenueSharePct": 30,
        "earningsUsd": 3.72,
        "earningsBtcy": 124.55
      }
    },
    "allocation": {
      "rate": {
        "model": "admob_cpm_share",
        "admobCpmUsd": 5,
        "revenueSharePct": 30,
        "rewarded": {
          "admobCpmUsd": 5,
          "grossUsdPerAd": 0.01,
          "usdPerAd": 0,
          "btcyPerAd": 0
        },
        "interstitial": {
          "admobCpmUsd": 2,
          "grossUsdPerAd": 0,
          "usdPerAd": 0,
          "btcyPerAd": 0
        },
        "usdPerBtcy": 0.03
      },
      "referrals": {
        "total": 42,
        "active": 17,
        "inactive": 25,
        "activeRatePct": 40.48
      },
      "topReferrals": [
        {
          "email": "ref1@example.com",
          "fullName": "Alice Smith",
          "firstName": "Alice",
          "lastName": "Smith",
          "username": "alice",
          "profilePic": null,
          "adsWatched": 24,
          "rewardedAdsWatched": 18,
          "interstitialAdsWatched": 6,
          "grossRevenueUsd": 0.12,
          "revenueSharePct": 30,
          "earningsUsd": 0.04,
          "earningsBtcy": 1.3,
          "lastAdWatchedAt": "2026-04-03T08:10:00.000Z"
        }
      ]
    },
    "revenueSources": [
      {
        "key": "referral_ad_watch",
        "label": "Referral Ad Revenue Share",
        "adsWatched": 180,
        "grossRevenueUsd": 0.95,
        "revenueSharePct": 30,
        "earningsUsd": 0.29,
        "earningsBtcy": 9.71,
        "sharePct": 100
      }
    ],
    "metrics": {
      "averageAdsPerReferral": 4.29,
      "averageAdsPerActiveReferral": 10.59,
      "averageEarningsUsdPerReferral": 0.01,
      "averageEarningsBtcyPerReferral": 0.23,
      "lastAdWatchedAt": "2026-04-03T08:10:00.000Z",
      "adsWatchedThisMonth": 54
    },
    "history": [
      {
        "bucket": "2026-04-01",
        "adsWatched": 11,
        "rewardedAdsWatched": 9,
        "interstitialAdsWatched": 2,
        "grossRevenueUsd": 0.05,
        "revenueSharePct": 30,
        "earningsUsd": 0.02,
        "earningsBtcy": 0.61
      }
    ],
    "pagination": {
      "page": 0,
      "pageSize": 20,
      "total": 42,
      "totalPages": 3
    },
    "referralBreakdown": [
      {
        "email": "ref1@example.com",
        "fullName": "Alice Smith",
        "firstName": "Alice",
        "lastName": "Smith",
        "username": "alice",
        "profilePic": null,
        "adsWatched": 24,
        "rewardedAdsWatched": 18,
        "interstitialAdsWatched": 6,
        "grossRevenueUsd": 0.12,
        "revenueSharePct": 30,
        "earningsUsd": 0.04,
        "earningsBtcy": 1.3,
        "lastAdWatchedAt": "2026-04-03T08:10:00.000Z"
      }
    ]
  }
}
```

## 2. User Earnings Endpoint

### Route

`GET /api/v1/earnings/user`

### Purpose

Returns one user's own ad-watch earnings summary, not referral breakdown.

### Access Rules

- Normal user: can fetch only their own earnings
- Admin or SuperAdmin: can fetch any user's earnings using `?email=...`

### Query Params

| Query | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `email` | string | No | Logged-in user | Optional for admins to fetch another user. |
| `range` | string | No | `30d` | Example: `7d`, `30d`, `all`. |
| `from` | string | No | - | Custom start date. |
| `to` | string | No | now | Custom end date. |
| `timezone` | string | No | `Asia/Kolkata` | Used for month boundary calculation. |

### Example Request

```bash
curl --request GET \
  --url 'http://localhost:3000/api/v1/earnings/user?range=30d' \
  --header 'Authorization: Bearer <JWT_TOKEN>'
```

### Success Response

```json
{
  "status": 200,
  "data": {
    "email": "user@example.com",
    "range": {
      "key": "30d",
      "from": "2026-03-05T10:00:00.000Z",
      "to": "2026-04-03T10:00:00.000Z"
    },
    "lifetime": {
      "adsWatched": 320,
      "rewardedAdsWatched": 280,
      "interstitialAdsWatched": 40,
      "grossRevenueUsd": 1.62,
      "earningsUsd": 0.49,
      "earningsBtcy": 16.27
    },
    "current": {
      "adsWatched": 42,
      "rewardedAdsWatched": 39,
      "interstitialAdsWatched": 3,
      "grossRevenueUsd": 0.21,
      "earningsUsd": 0.06,
      "earningsBtcy": 2.06
    },
    "currentMonth": {
      "adsWatched": 13,
      "rewardedAdsWatched": 12,
      "interstitialAdsWatched": 1,
      "grossRevenueUsd": 0.06,
      "earningsUsd": 0.02,
      "earningsBtcy": 0.64
    },
    "rates": {
      "model": "admob_cpm_share",
      "rewardedCpmUsd": 5,
      "interstitialCpmUsd": 2,
      "revenueSharePct": 30,
      "usdPerBtcy": 0.03
    }
  }
}
```

## 3. All Users Earnings Endpoint

### Route

`GET /api/v1/earnings/users`

### Purpose

Returns paginated earnings across all users. This endpoint is for admin usage.

### Access Rules

- Admin or SuperAdmin only
- Non-admin users receive `403`

### Query Params

| Query | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `range` | string | No | `30d` | Example: `7d`, `30d`, `all`. |
| `from` | string | No | - | Custom start date. |
| `to` | string | No | now | Custom end date. |
| `timezone` | string | No | `Asia/Kolkata` | Accepted for consistency. |
| `page` | number | No | `0` | Zero-based page index. |
| `pageSize` | number | No | `100` | Max `500`. |

### Example Request

```bash
curl --request GET \
  --url 'http://localhost:3000/api/v1/earnings/users?page=0&pageSize=100&range=30d' \
  --header 'Authorization: Bearer <JWT_TOKEN>'
```

### Success Response

```json
{
  "status": 200,
  "data": {
    "range": {
      "key": "30d",
      "from": "2026-03-05T10:00:00.000Z",
      "to": "2026-04-03T10:00:00.000Z"
    },
    "pagination": {
      "page": 0,
      "pageSize": 100
    },
    "summary": {
      "totalAdsWatched": 1400,
      "totalGrossRevenueUsd": 7.2,
      "totalEarningsUsd": 2.16
    },
    "rates": {
      "model": "admob_cpm_share",
      "rewardedCpmUsd": 5,
      "revenueSharePct": 30
    },
    "users": [
      {
        "email": "user1@example.com",
        "adsWatched": 94,
        "rewardedAdsWatched": 81,
        "interstitialAdsWatched": 13,
        "grossRevenueUsd": 0.47,
        "earningsUsd": 0.14,
        "earningsBtcy": 4.73,
        "lastAdWatchedAt": "2026-04-03T08:10:00.000Z"
      }
    ]
  }
}
```

## Error Responses

### Auth Middleware Errors

These come directly from `validateAuthHeader` and do not use the `{ status, data }` response shape:

```json
{
  "message": "Unauthorized: Missing or invalid Authorization header"
}
```

```json
{
  "message": "Unauthorized: Missing token"
}
```

```json
{
  "message": "Unauthorized: Invalid or expired token"
}
```

```json
{
  "message": "Unauthorized: Token verification failed"
}
```

### Controller / Service Errors

Unauthorized inside controller:

```json
{
  "status": 401,
  "data": {
    "message": "Authentication required"
  }
}
```

Forbidden:

```json
{
  "status": 403,
  "data": {
    "message": "Forbidden"
  }
}
```

Admin-only endpoint forbidden:

```json
{
  "status": 403,
  "data": {
    "message": "Forbidden: Admin only"
  }
}
```

User not found:

```json
{
  "status": 404,
  "data": {
    "message": "User not found"
  }
}
```

Server error:

```json
{
  "status": 500,
  "data": {
    "message": "Internal Server Error"
  }
}
```

## Quick Summary

- Base path: `/api/v1/earnings`
- Auth: `Authorization: Bearer <JWT_TOKEN>`
- Path params: none
- Query params: yes
- `/overview`: referral dashboard for one user
- `/user`: direct ad-watch earnings for one user
- `/users`: paginated earnings for all users, admin only

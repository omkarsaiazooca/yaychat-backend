# Airdrop Campaign API

This README documents the basic airdrop campaign endpoints used by the frontend to read the active campaign and allow admins to create/update campaign metadata.

Base path (prod/dev): `POST /api/v1/inex/basic/...`

## 1) Get Active Airdrop Status
Endpoint:
```
GET /api/v1/inex/basic/airdrop-status
```

Purpose:
Returns a simple active flag and label for the currently active campaign.

Success Response (200):
```json
{
  "status": 200,
  "data": {
    "active": true,
    "name": "btcy-loyalty-airdrop-2026",
    "title": "BTCY Loyalty Airdrop"
  }
}
```

If no campaign is active, the API still returns 200 with empty fields:
```json
{
  "status": 200,
  "data": {
    "active": false,
    "name": "",
    "title": ""
  }
}
```

## 2) Get Airdrop Campaign (by name or active)
Endpoint:
```
GET /api/v1/inex/basic/airdrop-campaign
```

Query params:
- `name` (optional) — when provided, fetches that specific campaign

Success Response (200):
```json
{
  "status": 200,
  "data": {
    "_id": "65d2aa1234567890abcd1234",
    "name": "btcy-loyalty-airdrop-2026",
    "title": "BTCY Loyalty Airdrop",
    "imageUrl": "https://cdn.example.com/airdrop/banner.png",
    "startDate": "2026-01-26T00:00:00.000Z",
    "endDate": "2026-02-02T23:59:59.000Z",
    "active": true,
    "body": "Rewarding consistent miners — register now to qualify.",
    "termsUrl": "https://indexx.ai/airdrop-terms",
    "ctaText": "Register Now",
    "ctaUrl": "https://bitcoinyay.com/airdrop",
    "createdAt": "2026-01-20T12:00:00.000Z",
    "updatedAt": "2026-01-26T07:45:00.000Z"
  }
}
```

If no campaign exists, `data` is `null`.

## 3) Create or Update Airdrop Campaign (Admin)
Endpoint:
```
POST /api/v1/inex/basic/airdrop-campaign
```

Behavior:
- If `_id` is provided in the payload, the campaign is **updated** (200).
- If `_id` is not provided, a **new** campaign is created (201).

### Request Body
```json
{
  "_id": "65d2aa1234567890abcd1234",
  "name": "btcy-loyalty-airdrop-2026",
  "title": "BTCY Loyalty Airdrop",
  "imageUrl": "https://cdn.example.com/airdrop/banner.png",
  "startDate": "2026-01-26T00:00:00.000Z",
  "endDate": "2026-02-02T23:59:59.000Z",
  "active": true,
  "body": "Rewarding consistent miners — register now to qualify.",
  "termsUrl": "https://indexx.ai/airdrop-terms",
  "ctaText": "Register Now",
  "ctaUrl": "https://bitcoinyay.com/airdrop"
}
```

### Required
- `name` (string)

### Optional
- `title` (string)
- `imageUrl` (string)
- `startDate` (ISO date string)
- `endDate` (ISO date string)
- `active` (boolean)
- `body` (string)
- `termsUrl` (string)
- `ctaText` (string)
- `ctaUrl` (string)

### Success Response (update)
**Status:** `200`
```json
{
  "status": 200,
  "data": { "matchedCount": 1, "modifiedCount": 1 }
}
```

### Success Response (create)
**Status:** `201`
```json
{
  "status": 201,
  "data": {
    "_id": "65d2aa1234567890abcd1234",
    "name": "btcy-loyalty-airdrop-2026",
    "active": true,
    "createdAt": "2026-01-26T07:45:00.000Z",
    "updatedAt": "2026-01-26T07:45:00.000Z"
  }
}
```

### Error Response (missing name)
**Status:** `400`
```json
{
  "status": 400,
  "data": { "message": "name is required" }
}
```

## Notes
- `GET /airdrop-status` is intended for frontend gating (show/hide airdrop UI).
- `GET /airdrop-campaign` returns the **active** campaign when `name` is not provided.
- `POST /airdrop-campaign` is an admin-only action; lock it down behind auth in production.

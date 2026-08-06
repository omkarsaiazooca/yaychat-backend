# Mining Station — Admin API Reference

Admin-only endpoints for managing station withdrawal requests.

**Base URL:** `https://api.v1.indexx.ai`

**Auth:** All endpoints require a valid JWT with role `Admin` or `SuperAdmin`.

```http
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

Any other role receives:
```json
{ "message": "Forbidden: Admin access required" }
```

---

## 1. List Withdrawal Requests

```
GET /api/v1/admin/mining/station/withdrawals
```

### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `email` | string | No | Filter by station owner email |
| `status` | string | No | `Pending`, `Approved`, or `Rejected` |
| `method` | string | No | `USDT`, `USDC`, or `BTCY` |
| `from` | ISO date | No | Filter `createdAt >= from` |
| `to` | ISO date | No | Filter `createdAt <= to` |
| `page` | number | No | Zero-based page index (default `0`) |
| `pageSize` | number | No | Results per page (default `20`) |

### Example Request

```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://api.v1.indexx.ai/api/v1/admin/mining/station/withdrawals?status=Pending&page=0&pageSize=20"
```

### Success Response `200`

```json
{
  "status": 200,
  "data": {
    "pagination": {
      "page": 0,
      "pageSize": 20,
      "total": 2,
      "totalPages": 1
    },
    "withdrawalRequests": [
      {
        "id": "6849f1a2c3d4e5f6a7b8c9d0",
        "orderId": "1780000000001",
        "email": "alice@example.com",
        "requestedAmount": 50,
        "approvedAmount": 45,
        "requestedAmountUsd": 50,
        "approvedAmountUsd": 45,
        "payoutAmount": 714.28,
        "payoutCurrency": "BTCY",
        "feeAmountUsd": 5,
        "feePercentage": 0.1,
        "source": "ad_revenue",
        "status": "Pending",
        "withdrawalMethod": "BTCY",
        "walletAddress": "",
        "network": "Ying Yang Chain",
        "createdAt": "2026-06-05T14:00:00.000Z",
        "processedAt": null,
        "txHash": ""
      },
      {
        "id": "6849f1a2c3d4e5f6a7b8c9d1",
        "orderId": "1780000000002",
        "email": "bob@example.com",
        "requestedAmount": 100,
        "approvedAmount": 90,
        "requestedAmountUsd": 100,
        "approvedAmountUsd": 90,
        "payoutAmount": 90,
        "payoutCurrency": "USDT",
        "feeAmountUsd": 10,
        "feePercentage": 0.1,
        "source": "ad_revenue",
        "status": "Pending",
        "withdrawalMethod": "USDT",
        "walletAddress": "BOB_SOLANA_WALLET_ADDRESS",
        "network": "Solana Network",
        "createdAt": "2026-06-05T15:30:00.000Z",
        "processedAt": null,
        "txHash": ""
      }
    ]
  }
}
```

### Response Field Reference

| Field | Description |
|---|---|
| `id` | MongoDB `_id` — use this as `:id` in approve/reject |
| `orderId` | Timestamp-based order ID shown to users |
| `email` | Station owner who submitted the request |
| `requestedAmountUsd` | Amount requested in USD (before fee) |
| `approvedAmountUsd` | Amount after fee deduction in USD |
| `payoutAmount` | Actual payout: BTCY tokens (BTCY method) or USD (USDT/USDC method) |
| `payoutCurrency` | `BTCY`, `USDT`, or `USDC` |
| `feeAmountUsd` | Fee deducted in USD |
| `feePercentage` | `0.10` (10%) for USDT/USDC or `0.03` (3%) for BTCY |
| `source` | `ad_revenue` (station earnings) or `mining_balance` (own mining) |
| `status` | `Pending`, `Approved`, or `Rejected` |
| `walletAddress` | Destination wallet (empty for BTCY internal transfers) |
| `network` | `Solana Network` (USDT/USDC) or `Ying Yang Chain` (BTCY) |
| `txHash` | Blockchain tx hash (set on approve, or rejection reason on reject) |

---

## 2. Approve a Withdrawal

```
PUT /api/v1/admin/mining/station/withdrawals/:id/approve
```

| Param | Location | Description |
|---|---|---|
| `id` | URL path | The `id` from the list response |
| `txHash` | Request body | Blockchain transaction hash (leave empty for BTCY internal transfers) |

### Example — Approve USDT Withdrawal

```bash
curl -X PUT \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "txHash": "5XjK9mNpQr2vWY8zAbCdEfGhIjKlMn3oPqRsTuVwXyZ" }' \
  "https://api.v1.indexx.ai/api/v1/admin/mining/station/withdrawals/6849f1a2c3d4e5f6a7b8c9d1/approve"
```

### Example — Approve BTCY Internal Transfer

```bash
curl -X PUT \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "txHash": "" }' \
  "https://api.v1.indexx.ai/api/v1/admin/mining/station/withdrawals/6849f1a2c3d4e5f6a7b8c9d0/approve"
```

### Success Response `200`

```json
{
  "status": 200,
  "message": "Withdrawal approved successfully",
  "data": {
    "requestId": "6849f1a2c3d4e5f6a7b8c9d0",
    "txHash": ""
  }
}
```

### What Happens in the DB

**`source: "ad_revenue"` + `payoutCurrency: "BTCY"`:**
```
userWallets[coinSymbol=BTCY, coinNetwork="Ying Yang Chain"].coinBalance += payoutAmount
userMiningBalance.migratedBalance += requestedAmountBtcy
WithdrawRequest.status   = "Approved"
WithdrawRequest.txHash   = txHash
WithdrawRequest.processedAt = now
```

**`source: "ad_revenue"` + `payoutCurrency: "USDT"` or `"USDC"`:**
```
(Admin sends tokens externally — no on-chain action in DB)
userMiningBalance.migratedBalance += requestedAmountBtcy
WithdrawRequest.status   = "Approved"
WithdrawRequest.txHash   = txHash
WithdrawRequest.processedAt = now
```

**`source: "mining_balance"`:**
```
userWallets[coinSymbol=BTCY].coinBalance += approvedAmount
userMiningBalance.migratedBalance       += requestedAmount
WithdrawRequest.status   = "Approved"
WithdrawRequest.txHash   = txHash
WithdrawRequest.processedAt = now
```

### Error Responses

```json
{ "status": 400, "data": { "message": "id is required" } }
```
```json
{ "status": 404, "message": "No pending withdrawal request found." }
```

---

## 3. Reject a Withdrawal

```
PUT /api/v1/admin/mining/station/withdrawals/:id/reject
```

| Param | Location | Description |
|---|---|---|
| `id` | URL path | The `id` from the list response |
| `reason` | Request body | Optional rejection reason shown in `txHash` field |

### Example Request

```bash
curl -X PUT \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "reason": "Invalid wallet address provided" }' \
  "https://api.v1.indexx.ai/api/v1/admin/mining/station/withdrawals/6849f1a2c3d4e5f6a7b8c9d1/reject"
```

### Success Response `200`

```json
{
  "status": 200,
  "message": "Withdrawal rejected and balance restored",
  "data": {
    "requestId": "6849f1a2c3d4e5f6a7b8c9d1"
  }
}
```

### What Happens in the DB

**`source: "ad_revenue"`:**
```
userMiningBalance.adRevenueTransferableBalance += requestedAmountBtcy  ← fully restored
WithdrawRequest.status      = "Rejected"
WithdrawRequest.txHash      = reason (rejection message)
WithdrawRequest.processedAt = now
```

**`source: "mining_balance"`:**
```
userMiningBalance.transferableBalance += requestedAmount  ← fully restored
Mining.totalMined                     += requestedAmount  ← restored
WithdrawRequest.status      = "Rejected"
WithdrawRequest.txHash      = reason
WithdrawRequest.processedAt = now
```

### Error Responses

```json
{ "status": 400, "data": { "message": "id is required" } }
```
```json
{ "status": 404, "message": "No pending withdrawal request found." }
```

---

## Common Error Responses

| Status | Message | Cause |
|---|---|---|
| `401` | `Unauthorized: Missing or invalid Authorization header` | No Bearer token |
| `401` | `Unauthorized: Invalid or expired token` | Token expired or tampered |
| `403` | `Forbidden: Admin access required` | Valid token but role is not `Admin`/`SuperAdmin` |
| `500` | `Internal Server Error` | Unexpected server error |

---

## Workflow Guide

### Processing a USDT / USDC Withdrawal

1. List pending requests:
   ```
   GET /api/v1/admin/mining/station/withdrawals?status=Pending&method=USDT
   ```
2. Note the `walletAddress`, `network`, and `approvedAmountUsd` from the row.
3. Send the USDT/USDC externally to the wallet address on Solana.
4. Once confirmed on-chain, approve with the transaction hash:
   ```
   PUT /api/v1/admin/mining/station/withdrawals/:id/approve
   { "txHash": "<solana_tx_hash>" }
   ```

### Processing a BTCY Withdrawal

BTCY is credited to the user's Ying Yang Chain wallet **at the time of submission** — no manual transfer needed.

1. List pending BTCY requests:
   ```
   GET /api/v1/admin/mining/station/withdrawals?status=Pending&method=BTCY
   ```
2. Verify the payout was received by the user (check their wallet).
3. Approve:
   ```
   PUT /api/v1/admin/mining/station/withdrawals/:id/approve
   { "txHash": "" }
   ```

### Rejecting a Request

Rejecting **fully restores** the balance to the user's `adRevenueTransferableBalance` (for `ad_revenue` source). Always reject before the user withdraws a second time for the same amount.

```
PUT /api/v1/admin/mining/station/withdrawals/:id/reject
{ "reason": "Reason visible in order history" }
```

---

## `source` Field Values

| Value | Meaning | Balance debited/restored |
|---|---|---|
| `ad_revenue` | Station owner's ad revenue earnings | `adRevenueTransferableBalance` |
| `mining_balance` | Owner's own mining session earnings | `transferableBalance` |

# Quantum Order API

Base path: `/api/order`

---

## 1. POST `/createOrderForQuantum`

Creates a new Quantum order for purchasing BTCY.

### Payload

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `currencyIn` | string | Yes | Payment currency. Allowed: `USDT`, `USDC`, `USD`, `PayPal`, `WireTransfer`, `Stripe` |
| `currencyOut` | string | Yes | Must be `BTCY` |
| `amount` | number | Yes | Amount to pay (positive number) |
| `outAmount` | number | Yes | Expected BTCY to receive (positive number) |
| `blockchain` | string | Conditional | Required only when `currencyIn` is `USDT` or `USDC`. Allowed: `Ethereum`, `Solana` |
| `paymentMethod` | string | No | Informational: `"crypto"`, `"paypal"`, `"card"`, `"wire-transfer"` |

**Example — Crypto (USDT/USDC):**
```json
{
  "email": "user@example.com",
  "currencyIn": "USDT",
  "currencyOut": "BTCY",
  "amount": 100,
  "outAmount": 500,
  "blockchain": "Ethereum"
}
```

**Example — PayPal/USD:**
```json
{
  "email": "user@example.com",
  "currencyIn": "PayPal",
  "currencyOut": "BTCY",
  "amount": 50,
  "outAmount": 250
}
```

**Example — Stripe:**
```json
{
  "email": "user@example.com",
  "currencyIn": "Stripe",
  "currencyOut": "BTCY",
  "amount": 100,
  "outAmount": 500
}
```

### Response

**200 OK — Crypto (USDT/USDC) order created:**
```json
{
  "status": 200,
  "data": {
    "orderId": "CRYPTO_1712345678_abc123xyz",
    "paymentMethod": "usdt",
    "amount": 100,
    "outAmount": 500,
    "bonusAmount": 0,
    "receiverAddress": "0xABC...DEF",
    "expiresAt": "2026-04-06T12:10:00.000Z",
    "message": "Transfer 100 USDT to 0xABC...DEF within 10 minutes, then use the payment check API to verify the transfer.",
    "blockchain": "Ethereum"
  }
}
```

> Note: If a bonus applies (e.g. IWD event), `bonusAmount` will be non-zero and `outAmount` will include the bonus.

**200 OK — Stripe order created:**
```json
{
  "status": 200,
  "data": {
    "sessionId": "cs_test_...",
    "url": "https://checkout.stripe.com/..."
  }
}
```

**400 Bad Request:**
```json
{ "status": 400, "data": { "message": "Quantum orders are only for buying BTCY" } }
{ "status": 400, "data": { "message": "Invalid currency for Quantum. Allowed: USDT, USDC, WireTransfer, PayPal, USD, Stripe" } }
{ "status": 400, "data": { "message": "Blockchain is required for USDT/USDC payments. Allowed: Ethereum, Solana" } }
{ "status": 400, "data": { "message": "amount and outAmount must be valid positive numbers" } }
```

**500 Internal Server Error:**
```json
{ "status": 500, "data": { "message": "Failed to create crypto payment order", "error": "..." } }
```

---

## 2. POST `/quantum/crypto/check-payment`

Manually triggers a payment check for a pending USDT/USDC crypto order. Polls the blockchain for a matching transaction.

### Payload

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderId` | string | Yes | The order ID returned at order creation |
| `paymentType` | string | Yes | `"USDT"` or `"USDC"` |
| `amount` | number | Yes | Amount that was paid (positive number) |
| `addressPaidTo` | string | Yes | The wallet address the payment was sent to |

**Example:**
```json
{
  "orderId": "CRYPTO_1712345678_abc123xyz",
  "paymentType": "USDT",
  "amount": 100,
  "addressPaidTo": "0xABC...DEF"
}
```

### Response

**200 — Payment found and confirmed:**
```json
{
  "status": 200,
  "data": {
    "orderId": "CRYPTO_1712345678_abc123xyz",
    "paymentReceived": true,
    "message": "Payment confirmed",
    "txHash": "0xTXHASH..."
  }
}
```

**200 — Payment not yet detected:**
```json
{
  "status": 200,
  "data": {
    "orderId": "CRYPTO_1712345678_abc123xyz",
    "paymentReceived": false,
    "status": "Pending",
    "attempts": 3,
    "message": "Payment not received"
  }
}
```

**200 — Order already completed:**
```json
{
  "status": 200,
  "data": {
    "orderId": "CRYPTO_1712345678_abc123xyz",
    "paymentReceived": true,
    "status": "Completed",
    "message": "Order already completed"
  }
}
```

**400 Bad Request (schema validation failed):**
```json
{
  "status": 400,
  "data": { "message": "badRequest", "error": { "fieldErrors": { "paymentType": ["..."] } } }
}
```

**404 Not Found:**
```json
{
  "status": 404,
  "data": { "orderId": "...", "paymentReceived": false, "message": "Order not found" }
}
```

**409 Conflict — tx hash already used:**
```json
{
  "status": 409,
  "data": {
    "orderId": "...",
    "paymentReceived": false,
    "message": "Transaction hash already used for another order",
    "txHash": "0xTXHASH...",
    "existingOrderId": "CRYPTO_OTHER_ORDER"
  }
}
```

**500 Internal Server Error:**
```json
{ "status": 500, "data": { "message": "Unhandled error", "error": "..." } }
```

---

## 3. POST `/quantum/crypto/check-payment-by-tx`

Verifies a payment using a known transaction hash. Pulls order details automatically — no need to supply `paymentType`, `amount`, or `addressPaidTo`.

### Payload

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderId` | string | Yes | The order ID to check |
| `txHash` | string | Yes | On-chain transaction hash of the payment |

**Example:**
```json
{
  "orderId": "CRYPTO_1712345678_abc123xyz",
  "txHash": "0xABCDEF1234567890..."
}
```

### Response

Same response shapes as [check-payment](#2-post-quantumcryptocheck-payment) above.

**200 — Confirmed:**
```json
{
  "status": 200,
  "data": {
    "orderId": "CRYPTO_1712345678_abc123xyz",
    "paymentReceived": true,
    "message": "Payment confirmed",
    "txHash": "0xABCDEF..."
  }
}
```

**200 — Not found on chain:**
```json
{
  "status": 200,
  "data": {
    "orderId": "CRYPTO_1712345678_abc123xyz",
    "paymentReceived": false,
    "status": "Pending",
    "attempts": 1,
    "message": "Payment not received"
  }
}
```

**409 Conflict — tx hash already used:**
```json
{
  "status": 409,
  "data": {
    "orderId": "...",
    "paymentReceived": false,
    "message": "Transaction hash already used for another order",
    "txHash": "0xTXHASH...",
    "existingOrderId": "CRYPTO_OTHER_ORDER"
  }
}
```

---

## 4. POST `/quantum/cancel`

Cancels a pending or unconfirmed Quantum crypto order. Completed orders cannot be cancelled.

### Payload

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderId` | string | Yes | The order ID to cancel |

**Example:**
```json
{
  "orderId": "CRYPTO_1712345678_abc123xyz"
}
```

### Response

**200 — Cancelled successfully:**
```json
{
  "status": 200,
  "data": {
    "orderId": "CRYPTO_1712345678_abc123xyz",
    "status": "OrderCancelled",
    "message": "Order cancelled successfully"
  }
}
```

**200 — Already cancelled:**
```json
{
  "status": 200,
  "data": {
    "orderId": "CRYPTO_1712345678_abc123xyz",
    "status": "OrderCancelled",
    "message": "Order already cancelled"
  }
}
```

**400 Bad Request:**
```json
{
  "status": 400,
  "data": { "orderId": "...", "message": "Completed orders cannot be cancelled" }
}
```

**400 Bad Request (schema validation failed):**
```json
{
  "status": 400,
  "data": { "message": "badRequest", "error": { "fieldErrors": { "orderId": ["..."] } } }
}
```

**404 Not Found:**
```json
{
  "status": 404,
  "data": { "orderId": "...", "message": "Order not found" }
}
```

**500 Internal Server Error:**
```json
{ "status": 500, "data": { "orderId": "...", "message": "..." } }
```

---

## Flow Summary

```
1. createOrderForQuantum  →  get orderId + receiverAddress (for crypto)
2. User sends USDT/USDC on-chain to receiverAddress
3. checkQuantumCryptoPaymentByTxHash (if tx hash known)
   OR
   checkQuantumCryptoPayment (polls blockchain using amount + address)
4. On success → order is marked Completed, BTCY is credited
   On failure / change of mind → cancelQuantumCryptoOrder
```

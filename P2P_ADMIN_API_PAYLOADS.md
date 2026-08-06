# P2P Admin API Payloads

This document contains the request and response payloads for all P2P admin-related APIs.

## Table of Contents
1. [Admin Authentication](#admin-authentication)
2. [Admin Offer Management](#admin-offer-management)
3. [Admin Escrow Management](#admin-escrow-management)
4. [Admin Trade Management](#admin-trade-management)
5. [Admin Wallet Management](#admin-wallet-management)

---

## Admin Authentication

### 1. Admin Signup
**Endpoint:** `POST /api/v1/p2p/admin/signup`

**Request Payload:**
```json
{
  "email": "support@azooca.com",
  "password": "securePassword123",
  "username": "admin_user",        // Optional, defaults to email prefix
  "firstName": "Admin",             // Optional, defaults to "Admin"
  "lastName": "User"                // Optional, defaults to "User"
}
```

**Response Payload (Success - 201):**
```json
{
  "message": "Admin created successfully",
  "admin": {
  "email": "support@azooca.com",
  "username": "admin_user",
  "role": "Admin"
  }
}
```

**Response Payload (Error - 400/500):**
```json
{
  "message": "Email and password are required" // or error message
}
```

---

### 2. Admin Login
**Endpoint:** `POST /api/v1/p2p/admin/login`

**Request Payload:**
```json
{
  "email": "support@azooca.com",
  "password": "securePassword123"
}
```

**Response Payload (Success - 200):**
```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "refreshToken": "refresh_token_here",
  // ... other token fields from JWT issueToken response
}
```

**Response Payload (Error - 400/401/403/500):**
```json
{
  "message": "Email and password are required" // or "Invalid email or password" or "Access denied. Admin role required."
}
```

---

## Admin Offer Management

### 3. Get All Offers (Admin)
**Endpoint:** `GET /api/v1/p2p/admin/offers`

**Request Payload:**
- Query parameters (all optional):
  - `status` (optional): Filter by offer status (e.g., "Active", "Paused", "Cancelled")
  - `creatorEmail` (optional): Filter by creator email
  - `offerType` (optional): Filter by offer type ("Buy" | "Sell")
  - `cryptoCurrency` (optional): Filter by cryptocurrency symbol
  - `fiatCurrency` (optional): Filter by fiat currency
  - `side` (optional): Filter by side ("BUY" | "SELL")
  - `settlement` (optional): Filter by settlement type ("INTERNAL_USD" | "REAL_FIAT")
  - `limit` (optional): Number of results per page (default: 100)
  - `skip` (optional): Number of results to skip (default: 0)

**Example Request:**
```
GET /api/v1/p2p/admin/offers?status=Active&creatorEmail=support@azooca.com&limit=50&skip=0
```

**Response Payload (Success - 200):**
```json
{
  "status": 200,
  "message": "All P2P offers retrieved successfully",
  "data": [
    {
      "offerId": "P2P_1234567890_abc123",
      "creatorEmail": "support@azooca.com",
      "offerType": "Buy" | "Sell",
      "cryptoCurrency": "USD",
      "fiatCurrency": "INEX",
      "pricePerUnit": 0.25,
      "baseToken": "USD",
      "quoteToken": "INEX",
      "side": "BUY" | "SELL",
      "settlement": "INTERNAL_USD" | "REAL_FIAT",
      "priceType": "FIXED" | "FLOAT",
      "price": 0.25,
      "minAmount": 10,
      "maxAmount": 1000,
      "availableAmount": 5000,
      "acceptedPaymentMethods": ["bank_transfer"],
      "paymentMethods": ["bank_transfer"],
      "paymentInstructions": {},
      "terms": "Terms and conditions",
      "status": "Active" | "Paused" | "Cancelled",
      "autoReply": "Auto-reply message",
      "completionRate": 0,
      "totalTrades": 0,
      "avgReleaseTime": 0,
      "isOnline": true,
      "lastSeen": "2024-01-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "skip": 0,
    "total": 1
  },
  "filters": {
    "status": "Active",
    "creatorEmail": "support@azooca.com",
    "offerType": "all",
    "cryptoCurrency": "all",
    "fiatCurrency": "all",
    "side": "all",
    "settlement": "all"
  }
}
```

**Response Payload (Error - 401/403/500):**
```json
{
  "status": 403,
  "message": "Access denied. Admin role required.",
  "userRole": "User"
}
```

---

### 4. Create Offer (Admin)
**Endpoint:** `POST /api/v1/p2p/admin/offers`

**Request Payload:**
```json
{
  "email": "support@azooca.com",            // Optional, uses JWT token if available (defaults to support@azooca.com)
  // New field names
  "type": "BUY" | "SELL",                    // Required (or use offerType)
  "baseToken": "USD",                        // Required (or use cryptoCurrency)
  "quoteToken": "INEX",                      // Required (or use fiatCurrency)
  "price": 0.25,                            // Required (or use pricePerUnit)
  "priceType": "FIXED" | "FLOAT",            // Optional, defaults to "FIXED"
  "settlement": "INTERNAL_USD" | "REAL_FIAT", // Optional, defaults based on type
  "acceptedPaymentMethods": ["bank_transfer", "paypal"], // Optional
  "paymentInstructions": {                   // Optional, JSON object for Case 2 payment details
    "bankAccount": "...",
    "swiftCode": "..."
  },
  "status": "active" | "paused" | "closed", // Optional, defaults to "active"
  // Legacy field names (for backward compatibility)
  "offerType": "BUY" | "SELL",
  "cryptoCurrency": "USD",
  "cryptoNetwork": "Ying Yang Chain",        // Optional
  "fiatCurrency": "INEX",
  "pricePerUnit": 0.25,
  // Common fields
  "minAmount": 10,                          // Required
  "maxAmount": 1000,                        // Required
  "availableAmount": 5000,                   // Required
  "paymentMethods": ["bank_transfer"],      // Optional (legacy)
  "terms": "Terms and conditions",          // Optional
  "autoReply": "Auto-reply message"         // Optional
}
```

**Response Payload (Success - 201):**
```json
{
  "status": 201,
  "data": {
    "offerId": "P2P_1234567890_abc123",
    "creatorEmail": "support@azooca.com",
    "offerType": "Buy" | "Sell",
    "cryptoCurrency": "USD",
    "fiatCurrency": "INEX",
    "pricePerUnit": 0.25,
    "baseToken": "USD",
    "quoteToken": "INEX",
    "side": "BUY" | "SELL",
    "settlement": "INTERNAL_USD" | "REAL_FIAT",
    "priceType": "FIXED" | "FLOAT",
    "price": 0.25,
    "minAmount": 10,
    "maxAmount": 1000,
    "availableAmount": 5000,
    "acceptedPaymentMethods": ["bank_transfer"],
    "paymentMethods": ["bank_transfer"],
    "paymentInstructions": {},
    "terms": "Terms and conditions",
    "status": "Active" | "Paused" | "Cancelled",
    "autoReply": "Auto-reply message",
    "completionRate": 0,
    "totalTrades": 0,
    "avgReleaseTime": 0,
    "isOnline": true,
    "lastSeen": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "P2P offer created successfully"
}
```

**Response Payload (Error - 400/500):**
```json
{
  "message": "Missing required fields",
  "required": {
    "type": "BUY or SELL (or offerType)",
    "baseToken": "e.g., USD (or cryptoCurrency)",
    "quoteToken": "e.g., INEX (or fiatCurrency)",
    "price": "0.25 (or pricePerUnit)",
    "minAmount": "minimum trade amount",
    "maxAmount": "maximum trade amount",
    "availableAmount": "total available amount"
  }
}
```

---

### 5. Update Offer (Admin)
**Endpoint:** `PATCH /api/v1/p2p/admin/offers/:offerId`

**Request Payload:**
```json
{
  // Only these fields can be updated
  "price": 0.30,                           // Optional
  "pricePerUnit": 0.30,                    // Optional (legacy)
  "priceType": "FIXED" | "FLOAT",          // Optional
  "minAmount": 20,                         // Optional
  "maxAmount": 2000,                       // Optional
  "availableAmount": 10000,                // Optional
  "acceptedPaymentMethods": ["paypal"],    // Optional
  "paymentMethods": ["paypal"],            // Optional (legacy)
  "paymentInstructions": {                 // Optional
    "bankAccount": "updated..."
  },
  "terms": "Updated terms",                // Optional
  "autoReply": "Updated auto-reply"        // Optional
}
```

**Response Payload (Success - 200):**
```json
{
  "status": 200,
  "data": {
    // Updated offer object
    "offerId": "P2P_1234567890_abc123",
    // ... all offer fields with updated values
  },
  "message": "Offer updated"
}
```

**Response Payload (Error - 400/403/404/500):**
```json
{
  "status": 400,
  "message": "No updatable fields provided"
}
```

---

### 6. Delete Offer (Admin)
**Endpoint:** `DELETE /api/v1/p2p/admin/offers/:offerId`

**Request Payload:**
- No body required
- URL parameter: `offerId`

**Response Payload (Success - 200):**
```json
{
  "status": 200,
  "message": "Offer deleted (cancelled)"
}
```

**Response Payload (Error - 403/404/500):**
```json
{
  "status": 500,
  "message": "Failed to delete offer",
  "error": "error message"
}
```

---

### 7. Pause/Resume Offer (Admin)
**Endpoint:** `POST /api/v1/p2p/admin/offers/:offerId/pause`

**Request Payload:**
```json
{
  "action": "pause" | "resume"  // Required
}
```

**Response Payload (Success - 200):**
```json
{
  "status": 200,
  "data": {
    // Updated offer object with new status
    "status": "Paused" | "Active"
  },
  "message": "Offer paused" | "Offer resumed"
}
```

**Response Payload (Error - 400/403/404/500):**
```json
{
  "status": 500,
  "message": "Failed to modify offer status",
  "error": "error message"
}
```

---

### 8. Set Offer Paused (Admin)
**Endpoint:** `POST /api/v1/p2p/admin/offers/:offerId/status/pause`

**Request Payload:**
- No body required
- URL parameter: `offerId`

**Response Payload (Success - 200):**
```json
{
  "status": 200,
  "data": {
    // Updated offer object
    "status": "Paused"
  },
  "message": "Offer paused"
}
```

---

### 9. Set Offer Closed (Admin)
**Endpoint:** `POST /api/v1/p2p/admin/offers/:offerId/status/closed`

**Request Payload:**
- No body required
- URL parameter: `offerId`

**Response Payload (Success - 200):**
```json
{
  "status": 200,
  "data": {
    // Updated offer object
    "status": "Cancelled"
  },
  "message": "Offer closed"
}
```

---

## Admin Escrow Management

### 10. List Escrows for Offer (Admin)
**Endpoint:** `GET /api/v1/p2p/admin/offers/:offerId/escrows`

**Request Payload:**
- No body required
- URL parameter: `offerId`
- Query parameters: None

**Response Payload (Success - 200):**
```json
{
  "status": 200,
  "data": [
    {
      "escrowId": "ESCROW_1234567890_xyz",
      "tradeId": "TRADE_1234567890_abc",
      "offerId": "P2P_1234567890_abc123",
      "status": "ACTIVE" | "APPROVED" | "RELEASED" | "CANCELLED",
      "userEmail": "user@example.com",
      "adminEmail": "support@azooca.com",
      "user_sends_asset": "USD",
      "user_sends_amount": 100,
      "user_receives_asset": "INEX",
      "user_receives_amount": 400,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "approvedAt": "2024-01-01T00:00:00.000Z",
      "approvedBy": "support@azooca.com"
      // ... other escrow fields
    }
  ],
  "message": "Escrows retrieved successfully",
  "offerId": "P2P_1234567890_abc123"
}
```

**Response Payload (Error - 401/403/404/500):**
```json
{
  "status": 403,
  "message": "Not authorized to view escrows for this offer"
}
```

---

### 11. Approve Escrow (Admin)
**Endpoint:** `POST /api/v1/p2p/admin/escrows/:escrowId/approve`

**Request Payload:**
- No body required
- URL parameter: `escrowId`

**Response Payload (Success - 200):**
```json
{
  "status": 200,
  "message": "Escrow approved and trade completed successfully. Transaction records created and notifications sent.",
  "data": {
    "escrow": {
      "escrowId": "ESCROW_1234567890_xyz",
      "status": "APPROVED",
      "approvedAt": "2024-01-01T00:00:00.000Z",
      "approvedBy": "support@azooca.com"
      // ... other escrow fields
    },
    "trade": {
      "tradeId": "TRADE_1234567890_abc",
      "status": "Completed",
      "completedAt": "2024-01-01T00:00:00.000Z"
      // ... other trade fields
    }
  }
}
```

**Response Payload (Error - 400/401/403/404/500):**
```json
{
  "status": 400,
  "message": "Escrow status must be ACTIVE to approve. Current status: APPROVED"
}
```

---

## Admin Trade Management

### 12. Get All Trades (Admin)
**Endpoint:** `GET /api/v1/p2p/admin/trades`

**Request Payload:**
- Query parameters:
  - `status` (optional): Filter by trade status (e.g., "Pending", "Completed", "Cancelled")
  - `limit` (optional): Number of results per page (default: 100)
  - `skip` (optional): Number of results to skip (default: 0)
  - `offerId` (optional): Filter by offer ID
  - `userEmail` (optional): Filter by user email (matches buyer or seller)

**Example Request:**
```
GET /p2p/admin/trades?status=Completed&limit=50&skip=0&offerId=P2P_123&userEmail=user@example.com
```

**Response Payload (Success - 200):**
```json
{
  "status": 200,
  "message": "All P2P trades retrieved successfully",
  "data": [
    {
      "tradeId": "TRADE_1234567890_abc",
      "offerId": "P2P_1234567890_abc123",
      "buyerEmail": "buyer@example.com",
      "sellerEmail": "seller@example.com",
      "amount": 100,
      "price": 0.25,
      "status": "Completed",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "completedAt": "2024-01-01T00:00:00.000Z",
      // ... other trade fields
      "escrowId": "ESCROW_1234567890_xyz",
      "escrowStatus": "APPROVED",
      "escrowDetails": {
        "escrowId": "ESCROW_1234567890_xyz",
        "status": "APPROVED",
        "userEmail": "user@example.com",
        "adminEmail": "support@azooca.com",
        "user_sends_asset": "USD",
        "user_sends_amount": 100,
        "user_receives_asset": "INEX",
        "user_receives_amount": 400,
        "approvedAt": "2024-01-01T00:00:00.000Z",
        "approvedBy": "support@azooca.com",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    }
  ],
  "pagination": {
    "limit": 50,
    "skip": 0,
    "total": 1
  },
  "filters": {
    "status": "Completed",
    "offerId": "P2P_123",
    "userEmail": "user@example.com"
  }
}
```

**Response Payload (Error - 401/403/500):**
```json
{
  "status": 403,
  "message": "Access denied. Admin role required.",
  "userRole": "User"
}
```

---

## Admin Wallet Management

### 13. Create Admin Asset Wallet
**Endpoint:** `POST /p2p/admin/wallet/create`

**Request Payload:**
```json
{
  "email": "support@azooca.com",  // Optional, uses JWT token or userId if available
  "symbol": "USD"                 // Required - currency/token symbol
}
```

**Response Payload (Success - 201):**
```json
{
  "message": "Asset wallet for USD created successfully",
  "symbol": "USD",
  "balance": 0
}
```

**Response Payload (Error - 400/401/403/404/500):**
```json
{
  "message": "Symbol (currency code) is required"
}
```

---

### 14. Fund Admin Asset Wallet
**Endpoint:** `POST /p2p/admin/wallet/fund`

**Request Payload:**
```json
{
  "email": "support@azooca.com",  // Optional, uses JWT token or userId if available
  "symbol": "USD",                // Required - currency/token symbol
  "amount": 1000                  // Required - must be > 0
}
```

**Response Payload (Success - 200):**
```json
{
  "message": "Wallet funded successfully",
  "symbol": "USD",
  "amount": 1000,
  "newBalance": 5000
}
```

**Response Payload (Error - 400/401/403/404/500):**
```json
{
  "message": "Symbol and amount are required" // or "Amount must be greater than 0"
}
```

---

### 15. Get Admin Balance
**Endpoint:** `GET /p2p/admin/wallet/balance`

**Request Payload:**
- Query parameter:
  - `email` (optional): Admin email (uses JWT token or userId if available)

**Example Request:**
```
GET /p2p/admin/wallet/balance?email=support@azooca.com
```

**Response Payload (Success - 200):**
```json
{
  "email": "support@azooca.com",
  "totalWallets": 3,
  "totalUSDValue": 15000.50,
  "wallets": [
    {
      "symbol": "USD",
      "balance": 5000,
      "balanceInUSD": 5000,
      "balanceInBTC": 0.125,
      "lastUsed": "2024-01-01T00:00:00.000Z"
    },
    {
      "symbol": "INEX",
      "balance": 10000,
      "balanceInUSD": 2500,
      "balanceInBTC": 0.0625,
      "lastUsed": "2024-01-01T00:00:00.000Z"
    },
    {
      "symbol": "BTC",
      "balance": 0.5,
      "balanceInUSD": 7500.50,
      "balanceInBTC": 0.5,
      "lastUsed": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Response Payload (Error - 401/403/404/500):**
```json
{
  "message": "Authentication required"
}
```

---

## Notes

1. **Authentication**: Most admin endpoints require authentication via JWT token. The email can be passed in the request body/query or extracted from the JWT token.

2. **Authorization**: All admin endpoints verify that the user has `Admin` or `SuperAdmin` role.

3. **Status Values**:
   - Offer Status: `Active`, `Paused`, `Cancelled`
   - Escrow Status: `ACTIVE`, `APPROVED`, `RELEASED`, `CANCELLED`
   - Trade Status: `Pending`, `Paid`, `Completed`, `Cancelled`, `Disputed`

4. **Settlement Types**:
   - `INTERNAL_USD`: Internal settlement using USD (Case 1)
   - `REAL_FIAT`: Real fiat payment rails (Case 2)

5. **Price Types**:
   - `FIXED`: Fixed price per unit
   - `FLOAT`: Price floats with market

6. **Error Responses**: All error responses follow the format:
   ```json
   {
     "status": <HTTP_STATUS_CODE>,
     "message": "<ERROR_MESSAGE>",
     "error": "<DETAILED_ERROR>" // Optional
   }
   ```


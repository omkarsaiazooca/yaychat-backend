# Alchemy v2 Workflow

## Start a session

- **Endpoint**: `POST /api/v2/bitcoinyay/alchemy/process` (protected via `validateAuthHeader`)
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "userType": "electric",            // any supported user tier
    "nuggetTokens": 1000,             // required fixed input amount
    "withdrawalType": "indexx"         // optional, defaults to "indexx"
  }
  ```
- **Response**:
  ```json
  {
    "status": 200,
    "message": "Alchemy session started successfully",
    "data": {
      "sessionId": "...",
      "email": "...",
      ...
    }
  }
  ```
- **Rules enforced**:
  * Only selected users (hardcoded whitelist) may call v2.
  * Fixed 1,000 BTCY input and 15-day cooldown.
  * Minimum 50,000 BTCY available on the Stellar wallet.
  * Result multiplier is referral-weighted and capped by the active liquidity pool.

## Complete a session

- **Endpoint**: `POST /api/v2/bitcoinyay/alchemy/complete`
- **Body**:
  ```json
  {
    "sessionId": "...",
    "withdrawalType": "indexx" | "solana" | "tron",
    "withdrawalAddress": "external wallet (required for solana/tron)"
  }
  ```
- **Behavior**:
  * Internal `indexx` withdrawals credit the user’s BTCY wallet on the Ying Yang Chain.
  * External withdrawals log the address/network without touching in-system balances.
  * Records the chosen `withdrawalType`, `targetNetwork` and address on the session document.

- **Response**:
  ```json
  {
    "status": 200,
    "message": "Alchemy session completed successfully",
    "data": { ...updated session record... }
  }
  ``*

## Supporting endpoints

- `GET /api/v2/bitcoinyay/alchemy/config` returns `alchemyConfig` plus the `selectedUsersOnlyLabel`.
- `GET /api/v2/bitcoinyay/alchemy/sessions` lists all sessions; `/sessions/:email` and `/session/:email/:sessionId` filter by user/session.
- Admins can manage liquidity pools via `/api/v1/inex/alchemy/pools` (list/create/active).

Refer to `services/alchemy.service.ts` and `platform/alchemy.operations.ts` for the detailed validation flow. 

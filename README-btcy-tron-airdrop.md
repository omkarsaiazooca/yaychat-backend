# BTCY Tron Airdrop Flow

## Overview
This flow collects BTCY Tron airdrop users into a dedicated collection and enables a Turbo Power claim for non-winners.

- Winners come from the CSV export.
- Non-winners come from `WIBSAirdrop29SepData` with `tokenName == BTCY`, excluding the CSV emails.
- The claim API grants **7 days of Turbo Power** only when the user clicks the app CTA (manual claim).

## Data Storage
Collection: `BTCYTronAirdropUsers`

Key fields:
- `email` (unique)
- `isWinner`, `source` (`csv` or `wibs`)
- `isWinnerPopupSeen`
- `tronRegistered`
- `turboClaimed`, `turboClaimedAt`, `turboExpiresAt`
- Airdrop fields (wallet, network, status, created/airdrop dates)
- Mining fields (if present in CSV)

## Import Script
Script: `scripts/import-btcy-tron-airdrop.ts`

### Full import (CSV winners + WIBS non-winners)
```powershell
npx ts-node scripts/import-btcy-tron-airdrop.ts --csv="exports/tron-btcy-mined-1767693526136.csv"
```

### WIBS-only import (skip upserting CSV winners)
```powershell
npx ts-node scripts/import-btcy-tron-airdrop.ts --wibsOnly=true --csv="exports/tron-btcy-mined-1767693526136.csv"
```

### Options
- `--csv`: CSV path (default: `exports/tron-btcy-mined-1767693526136.csv`)
- `--token`: token name filter for WIBS import (default: `BTCY`)
- `--wibsOnly=true`: only import WIBS non-winners, still uses CSV to exclude winners
- `--wibsAll=true`: import all WIBS BTCY entries (do not skip winners)
- `--winnersFile`: CSV with `email,walletAddress` to mark winners as completed
- `--skipCsv=true`: skip CSV processing entirely (use with `--winnersFile`)

### WIBS BTCY + Manual Winners
```powershell
npx ts-node scripts/import-btcy-tron-airdrop.ts --wibsAll=true --winnersFile="exports/btcy-tron-winners.csv" --skipCsv=true
```

## API: Claim Turbo Power (Non-Winners Only)
Endpoint:
```
POST /api/v1/btcy/reward/claim/airdrop-turbo
```

Request body:
```json
{
  "email": "user@example.com"
}
```

Responses:
- `200`: Turbo activated, returns `turboExpiresAt`
- `400`: Not eligible (winner or invalid)
- `404`: User or airdrop entry not found
- `409`: Turbo already claimed

### Success Output (200)
```json
{
  "status": 200,
  "message": "Turbo activated",
  "data": {
    "turboExpiresAt": "2026-02-20T18:45:12.345Z"
  }
}
```

### Error Output Example (409)
```json
{
  "message": "Turbo already claimed"
}
```

Side effects:
- Marks `turboClaimed`, `turboClaimedAt`, `turboExpiresAt` on `BTCYTronAirdropUsers`
- Queues a 7-day Turbo grant via BTCY reward/subscription flow

## API: Airdrop Status Check
Endpoint:
```
GET /api/v1/btcy/reward/airdrop/status?email=user@example.com
```

Input:
- Query param: `email` (required)

Response:
```json
{
  "status": 200,
  "data": {
    "participated": true,
    "isWinner": false,
    "isWinnerPopupSeen": false,
    "turboClaimed": false,
    "isEligibleForTurbo": true
  }
}
```

### Not Found Output Example (no airdrop entry)
```json
{
  "status": 200,
  "data": {
    "participated": false,
    "isWinner": false,
    "isWinnerPopupSeen": false,
    "turboClaimed": false,
    "isEligibleForTurbo": false
  }
}

## API: Mark Winner Popup Seen
Endpoint:
```
POST /api/v1/btcy/reward/airdrop/winner-popup-seen
```

Request body:
```json
{
  "email": "user@example.com"
}
```

### Success Output (200)
```json
{
  "status": 200,
  "message": "Winner popup marked as seen",
  "data": {
    "isWinnerPopupSeen": true
  }
}
```
```

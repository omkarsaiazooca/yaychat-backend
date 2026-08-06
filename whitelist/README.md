# Whitelist Management

This directory contains whitelist-related files and documentation.

## Structure

- `initial-emails.txt` - List of initial whitelisted emails
- `README.md` - This file

## Database Structure

The whitelist is stored in MongoDB in the `Whitelist` collection with the following schema:

```typescript
{
  email: string (unique, indexed, lowercase)
  addedBy: string (admin email who added this)
  addedAt: Date
  notes: string (optional)
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

## API Endpoints

All endpoints require admin authentication via Bearer token.

### Base URL
`/api/v1/whitelist`

### Endpoints

1. **POST** `/api/v1/whitelist`
   - Add an email to whitelist
   - Body: `{ "email": "user@example.com", "notes": "optional notes" }`
   - Returns: Created whitelist entry

2. **GET** `/api/v1/whitelist`
   - Get all whitelisted emails
   - Returns: Array of all whitelist entries

3. **PUT** `/api/v1/whitelist`
   - Update a whitelist entry
   - Body: `{ "oldEmail": "old@example.com", "newEmail": "new@example.com", "notes": "optional" }`
   - Returns: Updated whitelist entry

4. **DELETE** `/api/v1/whitelist/:email`
   - Remove an email from whitelist
   - Returns: Success message

5. **GET** `/api/v1/whitelist/check/:email`
   - Check if an email is whitelisted
   - Returns: `{ "email": "...", "whitelisted": true/false }`

## User Response Enhancement

When user routes return user data, the response automatically includes a `whitelisted` field:

```json
{
  "status": 200,
  "data": {
    "email": "user@example.com",
    "whitelisted": true,
    ...
  }
}
```

## Seeding Initial Emails

To seed the database with initial emails:

```bash
npx ts-node scripts/seedWhitelist.ts
```

Or using tsx:

```bash
tsx scripts/seedWhitelist.ts
```

## Files Location

- Data interface: `data/whitelist.ts`
- Model: `models/whitelist.ts`
- Service: `services/whitelist.service.ts`
- Controller: `controllers/whitelistAPI.ts`
- Routes: `routes/whitelist.routes.ts`
- Middleware: `helpers/middleware.ts` (addWhitelistStatus function)
- Seed script: `scripts/seedWhitelist.ts`



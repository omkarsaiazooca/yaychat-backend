# Testing Whitelist APIs

## Prerequisites

1. Make sure the server is running
2. You need an admin JWT token to test the APIs

## Getting an Admin Token

First, login as admin to get a token:

```bash
curl -X POST http://localhost:5000/api/v1/inex/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-admin-email@example.com",
    "password": "your-admin-password"
  }'
```

Save the `token` from the response.

## Test Commands

Replace `YOUR_ADMIN_TOKEN` with the token from above.

### 1. Add Email to Whitelist (POST)

```bash
curl -X POST http://localhost:5000/api/v1/whitelist \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "email": "test@example.com",
    "notes": "Test email for whitelist"
  }'
```

### 2. Get All Whitelisted Emails (GET)

```bash
curl -X GET http://localhost:5000/api/v1/whitelist \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 3. Check if Email is Whitelisted (GET)

```bash
curl -X GET http://localhost:5000/api/v1/whitelist/check/test@example.com \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 4. Update Whitelist Entry (PUT)

```bash
curl -X PUT http://localhost:5000/api/v1/whitelist \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "oldEmail": "test@example.com",
    "newEmail": "updated@example.com",
    "notes": "Updated email"
  }'
```

### 5. Delete Email from Whitelist (DELETE)

```bash
curl -X DELETE http://localhost:5000/api/v1/whitelist/updated@example.com \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 6. Test User Route with Whitelist Status

After adding an email to whitelist, test a user route to see the whitelisted field:

```bash
curl -X POST http://localhost:5000/api/v1/inex/user/getUserDetails/test@example.com \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

The response should include `"whitelisted": true` in the data object.

## Using the Test Script

You can also use the provided test script:

1. Edit `test-apis.sh` and replace `YOUR_ADMIN_JWT_TOKEN_HERE` with your admin token
2. Make it executable: `chmod +x whitelist/test-apis.sh`
3. Run it: `./whitelist/test-apis.sh`

## Expected Responses

### Success Response (POST/PUT)
```json
{
  "status": 201,
  "message": "Email added to whitelist successfully",
  "data": {
    "_id": "...",
    "email": "test@example.com",
    "addedBy": "admin@example.com",
    "addedAt": "2024-01-01T00:00:00.000Z",
    "notes": "Test email for whitelist",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Success Response (GET)
```json
{
  "status": 200,
  "message": "Whitelist retrieved successfully",
  "data": [
    {
      "_id": "...",
      "email": "test@example.com",
      "addedBy": "admin@example.com",
      "addedAt": "2024-01-01T00:00:00.000Z",
      "notes": "Test email",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Error Response (Unauthorized)
```json
{
  "status": 403,
  "message": "Access denied. Admin role required.",
  "data": null
}
```

### Error Response (Duplicate)
```json
{
  "status": 409,
  "message": "Email already exists in whitelist",
  "data": null
}
```



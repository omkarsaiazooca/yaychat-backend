# Whitelist API Quick Reference

## Prerequisites

Get admin token first:
```bash
curl -X POST http://localhost:5000/api/v1/inex/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password"}'
```

Replace `YOUR_ADMIN_TOKEN` in commands below.

## Quick Commands

### Add Email
```bash
curl -X POST http://localhost:5000/api/v1/whitelist \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"email": "user@example.com"}'
```

### Get All Emails
```bash
curl -X GET http://localhost:5000/api/v1/whitelist \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Check Email
```bash
curl -X GET http://localhost:5000/api/v1/whitelist/check/user@example.com \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Update Email
```bash
curl -X PUT http://localhost:5000/api/v1/whitelist \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"oldEmail": "old@example.com", "newEmail": "new@example.com"}'
```

### Delete Email
```bash
curl -X DELETE http://localhost:5000/api/v1/whitelist/user@example.com \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Seed Initial Emails
```bash
npx ts-node scripts/seedWhitelist.ts
```



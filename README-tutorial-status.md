# Tutorial Status API (BTCY)

These endpoints track whether a user has watched the BitcoinYay (BTCY) tutorial.

Base path:
```
https://api.v1.indexx.ai/api/v1/inex/basic
```

---

## 1) Get tutorial status

**Request**
```
GET /tutorial-status?email=user%40example.com
GET /tutorial-status?email=user%40example.com&app=BTCY
```

**Response (not watched)**
```json
{
  "status": 200,
  "data": {
    "email": "user@example.com",
    "app": "BTCY",
    "watched": false,
    "watchedAt": null
  }
}
```

**Response (watched)**
```json
{
  "status": 200,
  "data": {
    "email": "user@example.com",
    "app": "BTCY",
    "watched": true,
    "watchedAt": "2026-01-27T12:34:56.000Z"
  }
}
```

---

## 2) Mark tutorial as watched

**Request**
```
POST /tutorial-status
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "app": "BTCY",
  "watched": true
}
```

**Success response**
```json
{
  "status": 200,
  "data": {
    "email": "user@example.com",
    "app": "BTCY",
    "watched": true,
    "watchedAt": "2026-01-27T12:34:56.000Z"
  }
}
```

**Error when mining is active**
```json
{
  "status": 409,
  "data": {
    "message": "Mining cycle active. Please wait unit mining cycle has concluded to rewatch tutorial"
  }
}
```

Notes:
- `app` defaults to `BTCY` if omitted.
- When `watched=true` and BTCY mining is active, the API blocks the request.

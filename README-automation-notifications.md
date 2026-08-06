# Automation Notification APIs

Base path:
```
/api/v1/notification
```

These endpoints return automation notifications that were **pushed** to users.
If no date range is provided, they default to **last 7 days**.

---

## 1) List automation notifications (paginated)

**Request**
```
GET /automation-notifications
GET /automation-notifications?email=user%40example.com
GET /automation-notifications?from=2025-01-01&to=2025-01-07
GET /automation-notifications?date=2025-01-01
GET /automation-notifications?channel=mining_first_session_welcome
GET /automation-notifications?cursor=2025-01-07T12%3A34%3A56.000Z%7C65a1234abc...
```

**Query params**
- `email` (optional): filter by recipient email
- `channel` / `type` (optional): filter by automation notification type
- `from` (optional, ISO date): start date/time
- `to` (optional, ISO date): end date/time
- `date` (optional, YYYY-MM-DD): single-day filter (overrides `from`/`to`)
- `page` (optional): page number (default `1`)
- `limit` (optional): page size (default `1000`, max `1000`)
- `cursor` (optional): pagination cursor from previous response

**Response**
```json
{
  "success": true,
  "total": 123,
  "data": [
    {
      "_id": "65a123...",
      "email": "user@example.com",
      "type": "mining_first_session_welcome",
      "title": "Welcome to Bitcoin Yay",
      "body": "Your first session is ready.",
      "pushed": true,
      "createdAt": "2025-01-01T12:00:00.000Z",
      "pushedLottoAirdropDate": "2025-01-01T12:00:02.000Z"
    }
  ],
  "page": 1,
  "limit": 1000,
  "nextCursor": "2025-01-01T12:00:00.000Z|65a123...",
  "hasMore": true
}
```

---

## 2) Summary (grouped by channel)

**Request**
```
GET /automation-notifications/summary
GET /automation-notifications/summary?from=2025-01-01&to=2025-01-07
GET /automation-notifications/summary?date=2025-01-01
```

**Response**
```json
{
  "success": true,
  "total": 456,
  "data": [
    {
      "jobId": "automation_mining_first_session_welcome_2025-01-01_2025-01-07",
      "title": "Welcome to Bitcoin Yay",
      "channel": "mining_first_session_welcome",
      "status": "Active",
      "startDate": "2025-01-01T00:00:00.000Z",
      "endDate": "2025-01-07T23:59:59.999Z",
      "count": 200,
      "lastSentAt": "2025-01-07T12:34:56.000Z"
    }
  ]
}
```

---

## 3) Download CSV for a channel

**Request**
```
GET /automation-notifications/channel/:channel/download
GET /automation-notifications/channel/mining_first_session_welcome/download
GET /automation-notifications/channel/mining_first_session_welcome/download?from=2025-01-01&to=2025-01-07
```

**CSV columns**
```
email,type,title,createdAt,sentAt
```

**Notes**
- `sentAt` uses `pushedLottoAirdropDate` when available, otherwise `createdAt`.
- Defaults to last 7 days when no date range is provided.

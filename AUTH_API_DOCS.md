# Auth API Documentation

Base URL: `https://api.v1.indexx.ai/api/v1/inex/user`

---

## 1. Forgot Password Flow

The forgot password flow consists of three steps:

### Step 1 — Send Forgot OTP to Email

Sends a one-time password (OTP) to the user's registered email address.

**Endpoint**
```
POST /sendForgotOtp
```

**Request Body**
```json
{
  "email": "user@example.com"
}
```

**Success Response** `200`
```json
{
  "status": 200,
  "data": "OTP sent successfully"
}
```

**Error Responses**

| Status | Message | Reason |
|--------|---------|--------|
| 400 | `badRequest` | `email` field is missing |
| 500 | `emailNotRegistered` | Email is not registered |

---

### Step 2 — Validate Forgot OTP

Validates the OTP received in the email.

**Endpoint**
```
POST /validateForgotOtp
```

**Request Body**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Success Response** `200`
```json
{
  "status": 200,
  "data": "OTP validated successfully"
}
```

**Error Responses**

| Status | Message | Reason |
|--------|---------|--------|
| 400 | `badRequest` | `email` or `code` is missing |
| 500 | error message | OTP expired or invalid |

---

### Step 3 — Reset Password

Resets the user's password after OTP has been validated.

**Endpoint**
```
POST /resetPassword
```

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "NewPassword123!"
}
```

**Success Response** `200`
```json
{
  "status": 200,
  "data": "Password reset successfully"
}
```

**Error Responses**

| Status | Message | Reason |
|--------|---------|--------|
| 400 | `badRequest` | `email` or `password` is missing |
| 500 | error message | Internal server error |

---

### Alternative — Forgot Password (Email Link)

Sends a forgot-password email link (instead of OTP) to the user.

**Endpoint**
```
POST /forgotPassword
```

**Request Body**
```json
{
  "email": "user@example.com"
}
```

**Success Response** `200`
```json
{
  "status": 200,
  "data": "forgotPasswordEmailSent"
}
```

**Error Responses**

| Status | Message | Reason |
|--------|---------|--------|
| 400 | `badRequest` | `email` field is missing |
| 500 | `emailNotRegistered` | Email not found in system |

---

## 2. Register with Google

Registers a new user using a Google OAuth token. If the user already exists, it returns an appropriate response.

**Endpoint**
```
POST /register/google
```

**Request Body**
```json
{
  "googleToken": "<google-id-token>",
  "referralCode": "OPTIONAL_REFERRAL_CODE",
  "registerFrom": "web",
  "languageSelected": "en"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `googleToken` | string | Yes | Google ID token obtained from Google Sign-In |
| `referralCode` | string | No | Referral code from an existing user |
| `registerFrom` | string | No | Platform identifier (e.g. `web`, `mobile`) |
| `languageSelected` | string | No | User's preferred language (e.g. `en`, `ko`) |

**Success Response** `200`
```json
{
  "status": 200,
  "data": {
    "message": "User registered successfully",
    "email": "user@gmail.com"
  }
}
```

**Error Responses**

| Status | Message | Reason |
|--------|---------|--------|
| 400 | `Bad Request` | `googleToken` is missing |
| 400 | `Invalid Google token` | Token could not be verified with Google |
| 500 | error message | Internal server error |

---

## 3. Login with Google

Logs in an existing user using a Google OAuth token. Issues a JWT access token on success.

**Endpoint**
```
POST /login/google
```

> Note: This endpoint applies whitelist validation middleware before processing.

**Request Body**
```json
{
  "googleToken": "<google-id-token>"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `googleToken` | string | Yes | Google ID token obtained from Google Sign-In |

**Success Response** `200`
```json
{
  "status": 200,
  "data": {
    "accessToken": "<jwt-access-token>",
    "refreshToken": "<jwt-refresh-token>",
    "email": "user@gmail.com"
  }
}
```

**Error Responses**

| Status | Message | Reason |
|--------|---------|--------|
| 400 | `Bad Request` | `googleToken` is missing |
| 400 | `Invalid Google token` | Token could not be verified with Google |
| 500 | error message | User not found or internal error |

---

## How to Get a Google ID Token (Client Side)

1. Use [Google Sign-In for Web](https://developers.google.com/identity/gsi/web/guides/overview) or the mobile SDK.
2. After user signs in, obtain the `credential` (ID token) from the response.
3. Send this token as `googleToken` in the request body.

**Example using Google Identity Services (Web)**
```javascript
google.accounts.id.initialize({
  client_id: "YOUR_GOOGLE_CLIENT_ID",
  callback: (response) => {
    const googleToken = response.credential;
    // Send to /register/google or /login/google
  },
});
```

---

## Common Response Structure

All API responses follow this shape:

```json
{
  "status": 200,
  "data": "<string or object>"
}
```

Errors return an appropriate HTTP status code with `data.message` describing the error.

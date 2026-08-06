# Google Signup and Login API

Base URL:

```text
https://api.v1.indexx.ai
```

Base path:

```text
/api/v1/inex/user
```

## Google Signup

```http
POST /api/v1/inex/user/register/google
Content-Type: application/json
```

Full URL:

```text
https://api.v1.indexx.ai/api/v1/inex/user/register/google
```

Request body:

```json
{
  "googleToken": "GOOGLE_ACCESS_TOKEN",
  "referralCode": "optional",
  "registerFrom": "optional",
  "languageSelected": "English"
}
```

Required field:

- `googleToken`

Optional fields:

- `referralCode`
- `registerFrom`
- `languageSelected`

Current backend behavior:

- Validates `googleToken` by calling Google userinfo API.
- Reads the Google account `email` and `name` or `id`.
- Creates the user with auth provider `Google`.
- Creates first-time wallets.
- Creates task-center signup data.
- Issues app `access_token` and `refresh_token`.

Example success response shape:

```json
{
  "status": 200,
  "data": {
    "message": "createdUser",
    "email": "user@example.com",
    "role": "Standard",
    "userType": "Indexx Exchange",
    "access_token": "...",
    "refresh_token": "..."
  }
}
```

## Google Login

```http
POST /api/v1/inex/user/login/google
Content-Type: application/json
```

Full URL:

```text
https://api.v1.indexx.ai/api/v1/inex/user/login/google
```

Request body:

```json
{
  "googleToken": "GOOGLE_ACCESS_TOKEN"
}
```

Required field:

- `googleToken`

Current backend behavior:

- Validates `googleToken` by calling Google userinfo API.
- Looks up the user by the Google account email.
- Allows login only when the user has the `Google` auth provider.
- Issues app `access_token` and `refresh_token` through the normal token flow.

Example success response shape:

```json
{
  "status": 200,
  "data": {
    "access_token": "...",
    "refresh_token": "..."
  }
}
```

## Token Type

The current backend expects `googleToken` to be a Google OAuth access token.

It is validated through:

```text
https://www.googleapis.com/oauth2/v1/userinfo?access_token=<googleToken>
```

The backend currently does not use the ID-token verifier path for these endpoints.

## Known Current Behavior

If `/login/google` receives a valid Google token for an email that does not exist in the backend, the service currently returns the email, then token issuing fails because the user record does not exist.

In practice, clients should call `/register/google` for first-time Google users and `/login/google` only after the account exists.

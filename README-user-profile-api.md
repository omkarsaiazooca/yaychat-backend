# User Profile API

Base path: `https://api.v1.indexx.ai`

## Overview

Profile image upload uses the existing S3 presigned upload APIs under `/inex/basic`.
After the image is uploaded to S3, save the returned S3 key or final image URL through the profile save API under `/inex/user`.

## Recommended Flow

1. Get a presigned S3 upload URL.
2. Upload the image directly to S3.
3. Call the profile save API with either:
   - `profilePicKey`, or
   - `profilePic`
4. Fetch the profile with the profile details API.

## 1. Get S3 Presigned Upload URL

### Web Upload

`GET /api/v1/inex/basic/getS3PresignedUrl?fileType=image/png`

Response:

```json
{
  "status": 200,
  "data": {
    "url": "https://<bucket>.s3.<region>.amazonaws.com",
    "fields": {
      "key": "uploads/1710000000000-abc123.png",
      "Content-Type": "image/png"
    }
  }
}
```

Use the returned `url` and `fields` to submit a multipart form upload to S3.

### Mobile Upload

`GET /api/v1/inex/basic/getS3PresignedUrlForMobile?fileType=image/png`

Response:

```json
{
  "status": 200,
  "data": {
    "url": "https://<bucket>.s3.<region>.amazonaws.com/uploads/1710000000000-abc123.png?...",
    "key": "uploads/1710000000000-abc123.png",
    "contentType": "image/png"
  }
}
```

Use the returned `url` to upload the file directly with `PUT`.

## 2. Save Profile

### Main API

`POST /api/v1/inex/user/profile/save`

Headers:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Request body example:

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "username": "john_doe",
  "phone": "+1234567890",
  "country": "India",
  "walletAddress": "0x1234567890",
  "bio": "Trader and investor",
  "isPhonePublic": false,
  "isEmailPublic": false,
  "profilePicKey": "uploads/1710000000000-abc123.png"
}
```

You can also send a full image URL instead of a key:

```json
{
  "profilePic": "https://<bucket>.s3.<region>.amazonaws.com/uploads/1710000000000-abc123.png"
}
```

Supported fields:

- `firstName`
- `lastName`
- `username`
- `phone`
- `country`
- `walletAddress`
- `bio`
- `isPhonePublic`
- `isEmailPublic`
- `profilePic`
- `profilePicKey`
- `imageKey`
- `s3Key`
- `key`

Response shape:

```json
{
  "message": "User profile saved successfully",
  "status": 200,
  "data": {
    "email": "john@example.com",
    "referralCode": "ABCD1234",
    "username": "john_doe",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "country": "India",
    "walletAddress": "0x1234567890",
    "profilePic": "https://<bucket>.s3.<region>.amazonaws.com/uploads/1710000000000-abc123.png",
    "bio": "Trader and investor",
    "isPhonePublic": false,
    "isEmailPublic": false
  }
}
```

## 3. Legacy Profile Update API

`POST /api/v1/inex/user/updateprofile`

This route is still available for backward compatibility and now uses the same save logic as `/api/v1/inex/user/profile/save`.

Typical older payloads may send:

```json
{
  "email": "john@example.com",
  "updateData": {
    "firstname": "John",
    "lastname": "Doe",
    "username": "john_doe",
    "profilePic": "https://<bucket>.s3.<region>.amazonaws.com/uploads/1710000000000-abc123.png"
  }
}
```

## 4. View Profile

`GET /api/v1/inex/user/getProfileDetails/:email`

Example:

`GET /api/v1/inex/user/getProfileDetails/john@example.com`

Response:

```json
{
  "status": 200,
  "message": "OK",
  "data": {
    "email": "john@example.com",
    "referralCode": "ABCD1234",
    "username": "john_doe",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "country": "India",
    "walletAddress": "0x1234567890",
    "profilePic": "https://<bucket>.s3.<region>.amazonaws.com/uploads/1710000000000-abc123.png",
    "bio": "Trader and investor",
    "isPhonePublic": false,
    "isEmailPublic": false
  }
}
```

## Notes

- `profile/save` is the preferred API for profile changes.
- Use the S3 presigned upload APIs before saving a new profile image.
- If an S3 key is sent, the backend converts it into a public image URL before storing it in the user document.

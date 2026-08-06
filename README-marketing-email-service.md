# Marketing Email Service

This service powers the admin marketing email console at:

```text
/api/v1/marketing-email
```

Admin-protected endpoints require a bearer token with `Admin` or `SuperAdmin` role. Public endpoints are limited to unsubscribe and SES webhook handling.

## AWS Console Setup

1. Open AWS Console and go to Amazon SES.
2. Select the SES region used by the backend.
   - Current env already has `AWS_REGION=ap-northeast-1`.
   - Add `AWS_SES_REGION` only if SES should use a different region.
3. Verify the sender identity.
   - Go to SES > Verified identities.
   - Add and verify the domain or sender email used by `AWS_SES_FROM_EMAIL`.
   - For production bulk sending, prefer a verified domain with DKIM enabled.
4. Configure domain authentication.
   - Add SES DKIM DNS records.
   - Ensure SPF and DMARC are set for the sending domain.
5. Move SES out of sandbox if needed.
   - SES sandbox can only send to verified recipients.
   - Request production access from SES Account dashboard before real campaigns.
6. Optional: create an SES configuration set.
   - Use this only if you want event tracking or SNS/Kinesis destinations.
   - Put the name in `AWS_SES_CONFIGURATION_SET`.
7. Optional: configure SNS webhook events.
   - Create SNS topics for bounces and complaints.
   - Subscribe the backend endpoint:

```text
POST https://api.v1.indexx.ai/api/v1/marketing-email/ses/webhook
```

## SES Onboarding Screen Values

Use these values when AWS shows the "Get started with SES" setup steps.

### Step 1: Add Your Email Address

This verifies one exact sender address. It is useful for testing.

Recommended examples:

```text
marketing@indexx.ai
no-reply@indexx.ai
support@indexx.ai
```

SES sends a verification email to that address. Click the verification link before sending from it.

### Step 2: Add Your Sending Domain

This is the recommended production setup because it verifies the whole sending domain.

Recommended value:

```text
indexx.ai
```

Only use a domain where Indexx can edit DNS records. SES will provide DNS records, usually DKIM CNAME records. Add those records in the DNS provider for `indexx.ai`.

After the domain is verified, SES can send from addresses under that domain, for example:

```text
marketing@indexx.ai
no-reply@indexx.ai
support@indexx.ai
```

### MAIL FROM Domain

This is optional but recommended for better deliverability and DMARC alignment.

Recommended value:

```text
mail.indexx.ai
```

Alternative:

```text
bounce.indexx.ai
```

The MAIL FROM domain must be a subdomain of the verified sending domain. Do not use `.example.com`; that is only AWS placeholder text.

SES will provide DNS records for the custom MAIL FROM domain, usually:

- MX record
- TXT SPF record

### Behavior On MX Failure

Recommended:

```text
Use default MAIL FROM domain
```

This is safer. If the custom MAIL FROM DNS records are incorrect, SES can fall back to an Amazon SES MAIL FROM domain instead of failing every send.

Use `Reject message` only when strict MAIL FROM alignment is required and failed sends are preferred over fallback behavior.

### Step 3: Deliverability Enhancements

Optional, but recommended before production campaigns.

Enable or configure:

- DKIM signing
- SPF
- DMARC
- Custom MAIL FROM domain

These improve inbox placement, sender reputation, and recipient trust.

### Step 4: Dedicated IP Pool

Optional. Skip for now.

Dedicated IPs are useful for high-volume senders who need full control over IP reputation. They cost more and require warm-up. Shared SES IPs are fine for initial rollout.

### Step 5: Tenant Management

Optional. Skip for now.

Tenant management is for platforms sending email on behalf of multiple separate customers or business tenants. This service currently sends Indexx-owned marketing emails, so tenant management is not required.

### Step 6: Review And Get Started

Review the setup, submit it, then wait for SES DNS verification to complete.

For this project, the recommended setup is:

```text
Sending domain: indexx.ai
MAIL FROM domain: mail.indexx.ai
Behavior on MX failure: Use default MAIL FROM domain
Dedicated IP pool: Skip
Tenant management: Skip
```

## Environment Keys

Already present:

```env
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Required for marketing email:

```env
AWS_SES_FROM_EMAIL=verified-sender@indexx.ai
AWS_SES_FROM_NAME=Indexx
MARKETING_EMAIL_UNSUBSCRIBE_BASE_URL=https://api.v1.indexx.ai
```

Optional:

```env
AWS_SES_REGION=ap-northeast-1
AWS_SES_CONFIGURATION_SET=your-config-set-name
```

The code reads these through `config/keys.ts`:

```ts
keys.marketingEmail.awsSesRegion
keys.marketingEmail.awsAccessKeyId
keys.marketingEmail.awsSecretAccessKey
keys.marketingEmail.awsSesFromEmail
keys.marketingEmail.awsSesFromName
keys.marketingEmail.unsubscribeBaseUrl
keys.marketingEmail.awsSesConfigurationSet
```

## API Summary

Public:

```text
GET  /api/v1/marketing-email/unsubscribe
POST /api/v1/marketing-email/ses/webhook
```

Admin only:

```text
POST /api/v1/marketing-email/contacts/import
GET  /api/v1/marketing-email/contacts
POST /api/v1/marketing-email/templates
GET  /api/v1/marketing-email/templates
POST /api/v1/marketing-email/test-email
POST /api/v1/marketing-email/campaigns
GET  /api/v1/marketing-email/campaigns
GET  /api/v1/marketing-email/campaigns/:id
POST /api/v1/marketing-email/campaigns/:id/send
```

## Pre-Deploy Checks

Run:

```bash
npm run build
```

Before sending real campaigns, verify:

- `AWS_SES_FROM_EMAIL` is verified in the SES region.
- SES account is out of sandbox for unverified recipients.
- DKIM, SPF, and DMARC records are live.
- The frontend uses an Admin login token.
- Start with small send batches before increasing volume.

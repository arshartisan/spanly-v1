# Email setup (Gmail SMTP)

Spanlyfy sends all email — transactional + newsletters — through one mailer abstraction
(`src/server/mailer.ts`). It picks a transport automatically:

- **SMTP (Gmail)** when `SMTP_USER` **and** `SMTP_PASS` are both set.
- **Console (dev)** otherwise — every message (with its verify/reset/OTP link) is printed to the
  server terminal, so the whole flow works locally with no email account.

You never pick a transport in code; just fill the env vars to go live.

---

## 1. Get a Gmail App Password

Gmail SMTP does **not** accept your normal account password. You need a 16-character **App
Password**, which requires 2-Step Verification.

1. Use a Google account you control — ideally a dedicated one (e.g. `no-reply@yourdomain.com` on
   Google Workspace, or a plain Gmail address for testing).
2. Enable **2-Step Verification**: <https://myaccount.google.com/security> → *2-Step Verification* →
   turn it on.
3. Create an App Password: <https://myaccount.google.com/apppasswords>
   - If the page says it's unavailable, 2-Step Verification isn't fully enabled yet.
   - App name: `Spanlyfy` (anything). Click **Create**.
4. Google shows a 16-character code like `abcd efgh ijkl mnop`. **Remove the spaces** →
   `abcdefghijklmnop`. This is your `SMTP_PASS`. You can't view it again, only regenerate.

> Workspace admins: make sure SMTP/"less secure app" style access via App Passwords isn't blocked
> by org policy. App Passwords are the supported path; OAuth2 SMTP is overkill for this.

---

## 2. Fill the env vars

In `.env` (and `.env.example` documents them):

```dotenv
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_SECURE="true"                 # true for 465 (SSL); set false + port 587 for STARTTLS
SMTP_USER="your.address@gmail.com" # the account the App Password belongs to
SMTP_PASS="abcdefghijklmnop"       # 16-char App Password, spaces removed
EMAIL_FROM="Spanlyfy <your.address@gmail.com>"
EMAIL_REPLY_TO=""                  # optional, e.g. support@yourdomain.com
NEWSLETTER_BATCH_SIZE="20"         # bulk-send throttle (see limits below)
NEWSLETTER_BATCH_DELAY_MS="1000"
```

**About `EMAIL_FROM`:** Gmail rewrites the `From` to the authenticated account unless the address
is a verified *"Send mail as"* alias on that account. Keep `EMAIL_FROM` equal to `SMTP_USER` (or a
verified alias) or recipients will see your real Gmail address regardless.

Restart the dev server / worker after changing `.env`.

---

## 3. Verify it works

- **Quick check (no send):** the mailer exposes `verifyMailer()` (`src/server/mailer.ts`), which
  pings the SMTP connection and returns `{ ok, transport }`. Wire it into an admin health check, or
  call it from a one-off script.
- **End to end:** trigger any email — sign up, "Forgot password", or send a test broadcast from
  **Admin → Broadcast** (superadmin only). With SMTP unset, the message prints to the terminal
  instead.

---

## Gmail sending limits (important for newsletters)

| Account type        | Approx. daily limit |
| ------------------- | ------------------- |
| Free Gmail          | ~500 recipients/day |
| Google Workspace    | ~2,000 recipients/day |

Newsletter/broadcast sends are throttled in bounded chunks (`NEWSLETTER_BATCH_SIZE`) but a single
mailbox will still hit these caps on a large list. For real volume, move the broadcast send onto the
existing BullMQ queue (the send loop in `src/server/admin/support.ts#sendBroadcast` is already
shaped like a queue producer) or switch to a dedicated provider (SendGrid/SES/Resend) behind the
same `Mailer` interface — only `src/server/mailer.ts` changes.

---

## What email covers

| Email                         | Trigger                                              | Where it's sent from |
| ----------------------------- | ---------------------------------------------------- | -------------------- |
| Email verification            | Sign up / change email                               | `api/auth/signup`, `api/auth/change-email` |
| Password reset                | "Forgot password", admin-initiated reset             | `api/auth/forgot`, `server/admin/users.ts` |
| **Login OTP (new device)**    | Correct password from an unrecognized device         | `api/auth/login` → `api/auth/verify-otp` |
| Payment / trial confirmation  | Subscription activated (PayPal webhook or mock)      | `server/billing-emails.ts` |
| Payment failed                | `BILLING.SUBSCRIPTION.PAYMENT.FAILED`                | `server/billing-emails.ts` |
| Subscription canceled         | Cancel / expire                                      | `server/billing-emails.ts` |
| Newsletter (marketing)        | Admin → Broadcast with *"Send as marketing"* checked | `server/admin/support.ts` |
| Operational broadcast         | Admin → Broadcast (default)                          | `server/admin/support.ts` |

All emails render a branded HTML body (`src/server/email/`) with a plain-text fallback.

### Login OTP behaviour

- Only triggered on a **new/unrecognized device** (not every login). Google sign-in skips it.
- A device that completes OTP is trusted for **30 days** via the `spanly_device` cookie +
  `TrustedDevice` row, so it won't be asked again until that expires or the row is deleted.
- Codes are 6 digits, 10-minute TTL, max 5 attempts, single active code per user.

### Newsletter / unsubscribe

- Marketing sends only reach users with `marketingEmails = true`.
- Every marketing email includes a one-click unsubscribe link **and** a `List-Unsubscribe` header
  (RFC 8058), so Gmail/Apple Mail show a native "Unsubscribe" button.
- Unsubscribe tokens are stateless HMACs (`src/server/email/unsubscribe.ts`) — links never expire.
- Users can also toggle **Product news & newsletters** in **Settings → General → Email Preferences**.

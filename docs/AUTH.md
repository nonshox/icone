# icone — authentication

Passwordless only. Two providers, one session model.

| Provider | Flow | Appwrite user id |
| --- | --- | --- |
| Email | 6-digit one-time code | Appwrite-generated |
| Telegram | Mini App (`WebApp.initData`) → server verify | `tg_<telegram_id>` |

## Session model

- The Appwrite **session secret** is the credential. It is stored in the
  `icone_session` cookie: `HttpOnly`, `SameSite=Lax`, `Secure` in production,
  `Path=/`, expiring with the Appwrite session (1 year).
- The browser never sees an API key. All privileged calls use
  `createAdminClient()` (project API key) from the server only.
- `getCurrentUser()` builds a session-scoped client with the cookie value and
  calls `account.get()`. Any failure means "signed out".
- `POST /api/auth/logout` calls `deleteSession({ sessionId: "current" })` and
  clears the cookie. If the session is already gone, the cookie is still
  cleared.

## Route protection

Protection is layered, and each layer has one job:

| Layer | File | Checks | Result |
| --- | --- | --- | --- |
| Proxy (pre-render) | `proxy.ts` | cookie present | real `307` to `/sign-in?next=…` |
| Page (render) | `requireUser()` / `currentMember()` | session valid at Appwrite | streamed redirect to `/sign-in?next=…` |
| Page (render) | `currentMember()` on `/agenda` | `users.role` is staff | streamed redirect to `/account` |
| Route handler | `currentMember()` per handler | session + role | `401`/`403` |

`proxy.ts` is **not** authentication — it only avoids streaming private page
shells to anonymous visitors and gives a correct HTTP status. A cookie can be
forged; the page-level check is what actually authorizes. Matcher: `/account`,
`/book`, `/bookings`, `/agenda` plus their `:path*` children.

With Cache Components a page cannot read `cookies()` outside a `<Suspense>`
boundary, so a revoked session is redirected from inside the streamed hole
(Next emits a `NEXT_REDIRECT` instruction). No user data is rendered before the
redirect — the panel simply never renders.

Roles live in `users.role` (`client`, `barber`, `admin`). Set them with
`npm run db:staff`; see [`DATA.md`](./DATA.md#staff). Details in
[`API.md`](./API.md#staff).

## Email one-time code

1. `POST /api/auth/email/start { email }`
   - rate limit: 8 / 10 min per IP, 5 / 10 min per address
   - `account.createEmailToken({ userId: ID.unique(), email })`
   - Appwrite creates the account when the address is new; when it exists the
     supplied `userId` is ignored and `token.userId` is the real user
   - the returned `userId` is stored in the `icone_otp` cookie (HttpOnly,
     10 min) — the code itself is never stored
   - response is always `{ ok: true }`, so account existence is not leaked
2. `POST /api/auth/email/verify { code }`
   - rate limit: 20 / 10 min per IP, 10 / 10 min per user
   - `account.createSession({ userId, secret: code })`
   - the fresh session is validated with `account.get()` before the cookie is
     set
   - `icone_otp` is cleared, `icone_session` is set
   - invalid/expired code → `400 invalid_code`; Appwrite 429 → `429`

Codes are 6 characters, valid 15 minutes at Appwrite; the UI says 10 minutes
because the OTP cookie (the user id) expires first.

## Telegram sign-in

The Login Widget is **not used**. It asked for extra phone permissions and
needed a BotFather-registered domain; both caused friction in production.
`/sign-in` links to the bot with `?start=signin`, the bot replies with an inline
`web_app` button, and the Mini App at `/mini` signs the user in.

1. `/mini` loads `https://telegram.org/js/telegram-web-app.js`, calls `ready()`
   and `expand()`, then POSTs `WebApp.initData` to
   `POST /api/auth/telegram/mini`.
2. `verifyWebAppInitData()`:
   - `secret_key = HMAC_SHA256(bot_token, "WebAppData")`
   - `hash = HMAC_SHA256(data_check_string, secret_key)`, where
     `data_check_string` is every field except `hash`, sorted by key, joined as
     `key=value` with a newline
   - comparison uses `timingSafeEqual`, `auth_date` must be within 24h
3. `signInWithTelegram()` is the same create-or-login path for both Telegram
   entry points:
   - find `tg_<id>`; create it when missing (no email, no phone, no password)
   - store `telegramId`, `telegramUsername`, `telegramPhotoUrl` in user prefs
   - `users.createToken(...)` then `account.createSession(...)`
4. The `icone_session` cookie is set on the site origin and the Mini App shows
   links to `/book` and `/bookings`.

This is simple and safe: Telegram signs the payload, the server verifies it,
and the only credential issued is the HttpOnly session cookie. A bad signature
returns `401 bad_signature` and no cookie.

The old widget callback (`GET /api/auth/telegram/callback`) still exists for
backwards compatibility, but no UI links to it.

### Bot setup

No `/setdomain` is required. Send `/start` to `@icone_app_bot` to get the inline
Mini App button. Optionally set the persistent menu button in `@BotFather` →
Bot Settings → Menu Button with `https://icone-uz.vercel.app/mini`.

### Webhook

`TELEGRAM_WEBHOOK_SECRET` is registered as `secret_token` with Telegram and
compared against `X-Telegram-Bot-Api-Secret-Token` on
`POST /api/telegram/webhook` with a constant-time check. The route accepts only
that header, acknowledges every valid update with `200`, and replies to
`/start` with an inline `web_app` button. Reminders are not implemented yet;
the endpoint is the place they will be triggered from.

```powershell
cmd /c "npm run tg:webhook"        # getWebhookInfo
cmd /c "npm run tg:webhook -- set" # register against NEXT_PUBLIC_APP_URL
```

The script prints only non-secret webhook state; it never prints the bot token
or secret. `GET /api/telegram/webhook` is a health check for after a deploy.

## Environment

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | public | absolute base for redirects |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | public | `https://fra.cloud.appwrite.io/v1` |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | public | `icone` |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | public | `icone_app_bot` |
| `APPWRITE_ENDPOINT` | server | same value as the public endpoint |
| `APPWRITE_PROJECT_ID` | server | `icone` |
| `APPWRITE_API_KEY` | server | **secret** — rotate if leaked |
| `APPWRITE_DATABASE_ID` | server | `database` |
| `APPWRITE_BUCKET_ID` | server | `bucket` |
| `TELEGRAM_BOT_TOKEN` | server | **secret** |
| `TELEGRAM_WEBHOOK_SECRET` | server | **secret**, ≥16 chars |

`lib/env.ts` validates the server set lazily via zod and throws a readable
error listing missing keys. Public values live in `lib/public-config.ts`.

## Threat model / decisions

| Concern | Mitigation |
| --- | --- |
| Session theft via JS | HttpOnly cookie, no session in `localStorage` |
| CSRF | `SameSite=Lax` + `isSameOrigin()` on every mutation |
| Account enumeration | identical response for new and existing emails |
| OTP brute force | per-user and per-IP windows + Appwrite's own limits |
| Forged Telegram payload | HMAC with `WebAppData`, timing-safe compare, 24h freshness |
| Replay of a Telegram update | `auth_date` freshness window |
| API key leakage | server-only module, never `NEXT_PUBLIC_*` |
| Open redirect via `?next=` | only same-origin paths starting with a single `/` |

### Known limitations

- **Rate limiting is in-process.** It resets on redeploy and does not span
  instances. Before scaling horizontally, move the counters to a shared store
  (Appwrite collection or Redis) or rely on platform WAF limits.
- **No session refresh.** Appwrite sessions last a year; when one is revoked,
  the user is silently signed out on the next request.
- **Email deliverability** depends on Appwrite's SMTP configuration. Verify a
  sender domain in the Appwrite console before launch.
- **Telegram avatar URLs** are stored as-is; they can expire. Fetch and store
  the image in the Appwrite bucket if the UI starts relying on it.

## Testing checklist

```powershell
cmd /c "npm run build"
cmd /c "npm run dev"
node qa-auth.mjs     # auth probe: OTP, Telegram callback, logout, guards
node qa-booking.mjs  # booking probe (needs DB scopes)
```

`qa-auth.mjs` signs in through both providers with throwaway accounts, checks
the redirect guards, and deletes the users it created. It needs the real
`.env.local`; never commit its output.

# icone — authentication

Passwordless only. Two providers, one session model.

| Provider | Flow | Appwrite user id |
| --- | --- | --- |
| Email | 6-digit one-time code | Appwrite-generated |
| Telegram | Login Widget → server callback | `tg_<telegram_id>` |

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

## Telegram Login Widget

1. `/sign-in` loads `https://telegram.org/js/telegram-widget.js?22` into a
   container, with `data-telegram-login=<bot>`,
   `data-auth-url=<origin>/api/auth/telegram/callback`,
   `data-request-access=write`.
2. Telegram redirects to the callback with signed fields.
3. `verifyTelegramPayload()`:
   - `secret_key = SHA256(bot_token)`
   - `hash = HMAC_SHA256(data_check_string, secret_key)`, where
     `data_check_string` is every field except `hash` and `state`, sorted by
     key, joined as `key=value` with `\n`
   - comparison uses `timingSafeEqual`
   - `auth_date` must be within 24h (5 min future skew allowed)
4. `signInWithTelegram()`:
   - find `tg_<id>`; create it when missing (no email, no phone, no password)
   - store `telegramId`, `telegramUsername`, `telegramPhotoUrl` in user prefs
   - `users.createToken({ userId, length: 64, expire: 120 })` then
     `account.createSession({ userId, secret })`
5. Session cookie is set and the browser lands on `/account`.

Failures redirect to `/sign-in?error=telegram` or `?error=telegram_unavailable`;
the form maps those codes to human copy.

### Bot setup (required before Telegram works in production)

In `@BotFather`:

- `/setdomain` → the exact production host (no scheme, no path). Repeat for the
  dev host if you need Telegram locally.
- `/setcommands` → optional, for bot menu copy.

Without `/setdomain` the widget renders but Telegram refuses the login, showing
"Bot domain invalid" inside its frame. The domain must match the `data-auth-url`
host exactly.

Because localhost can't be registered, `.env.local` sets
`NEXT_PUBLIC_TELEGRAM_LOGIN_ENABLED=false`. That renders a designed fallback
("Continue in Telegram" → the bot) instead of Telegram's error frame. Flip it to
`true` on the deployed, registered domain. The callback route itself is always
active, so the flow can be tested end-to-end regardless.

### Webhook

`TELEGRAM_WEBHOOK_SECRET` is reserved for the bot webhook (booking reminders,
milestone 3). Register it with Telegram's `setWebhook` and compare the
`X-Telegram-Bot-Api-Secret-Token` header on the receiving route. Do not add a
webhook route until the booking milestone needs one.

## Environment

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | public | absolute base for redirects |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | public | `https://fra.cloud.appwrite.io/v1` |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | public | `icone` |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | public | `icone_app_bot` |
| `NEXT_PUBLIC_TELEGRAM_LOGIN_ENABLED` | public | `"true"` once the domain is registered with `/setdomain`; `"false"` on localhost and preview hosts |
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
| Forged Telegram payload | HMAC with `SHA256(bot_token)`, timing-safe compare, 24h freshness |
| Replay of a Telegram callback | `auth_date` freshness window |
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
node qa-auth.mjs   # end-to-end probe: OTP, Telegram, logout, guards
```

`qa-auth.mjs` signs in through both providers with throwaway accounts, checks
the redirect guards, and deletes the users it created. It needs the real
`.env.local`; never commit its output.

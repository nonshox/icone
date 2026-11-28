# Authentication

Telegram only. One account per person, identified by `tg_<telegram_id>`. No
email, SMS, Login Widget, `/mini` page, or second account. The same account is a
customer and can become a professional without signing in again.

## Web and in-app flow

1. On `/sign-in` (or wherever deep-linked), the member taps **Share phone**.
   `/api/auth/phone/start` creates a temporary `otp_<nonce>` user and asks the
   bot to request the Telegram contact with one tap.
2. The bot receives the contact and stores the phone on the temporary user's
   prefs, together with a 4-digit code. The request id lives in the HttpOnly
   `icone_otp` cookie; the code is never in the browser.
3. The member types the code where it was requested. `/api/auth/phone/verify`
   checks it in constant time, expires it after 5 minutes, allows five tries,
   creates the `tg_<id>` account/session and deletes the temporary user.
4. Inside the Telegram Mini App, signed `initData` signs the member in
   automatically on any page — the whole site is the Mini App. The in-app
   contact button saves the phone on the same `tg_<id>` account.

`?next=` preserves a protected deep link through sign-in. `lib/next-path.ts`
allows local paths only and rejects sign-in loops and protocol-relative URLs.

## Account surfaces after sign-in

The same account owns every surface. Clients land through `/customer`, which
now redirects to `/account` (the single account home) with its query string
preserved; profile editing lives only at `/settings`. The inbox at
`/notifications` accepts any signed-in account — the legacy
`/barber/notifications` URL redirects there with its query string instead of
rendering a second inbox.

## Public booking until confirm

`/book` is intentionally not a protected route: guests can browse services,
choose a professional and read live availability. `proxy.ts` does not match
`/book`, and the page renders without a session lookup. Authentication is
required only at the final submit:

- The form checks the cached `/api/me` read. A guest's confirm button signs in
  with `/sign-in?next=<encoded current booking URL>`; an expired session is
  caught from the `/api/bookings` 401 and takes the same path.
- `next` is the canonical draft URL (`business`, `branch`, `any`, repeated
  `services`, `date`, `start`, optional `note`), so the Zustand draft is
  restored even after a full reload. No session state is put in the URL.
- Writes remain server-guarded by `requireUser` in `/api/bookings`; browsing
  never grants booking rights, and prices are always resolved on the server.

## Session and threat model

- Session secret: `icone_session`, HttpOnly, server-set. No client SDK sessions
  and no tokens in `localStorage`.
- `proxy.ts` is a cheap cookie-presence redirect only. Every protected route
  validates the session against Appwrite in the page/route handler via
  `getCurrentUser()` / `getActor()`.
- `lib/domain/access.ts` is the single source of authorization truth. It
  resolves the actor's professional row, business memberships and per-member
  permission overrides. `lib/api/guard.ts` exposes `requireUser`,
  `requireCap` and `requireAdmin` for route handlers.
- Mutating route handlers check the same-origin header and apply rate limits.
- Bot token and webhook secret are server-only. The webhook verifies Telegram's
  signature before acting.
- Manual phone entry remains a fallback; it uses the same code path and account.
- Account deletion and suspension keep historical booking records; a suspended
  profile cannot sign in or receive new bookings.

## Professional states

Onboarding applications move through `not applied`, `draft`, `submitted`,
`under review`, `additional information required`, `approved`, `rejected` and
`suspended`. Only an approved, active professional receives workspace access
and a verification badge. Team members use their own accounts — credentials
are never shared between employees.

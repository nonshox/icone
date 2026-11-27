# Authentication

Telegram only. There is one account per person, identified by
`tg_<telegram_id>`. No email, SMS, Login Widget, `/mini` page, or second account.

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
   automatically and keeps them on the same page. The in-app contact button
   saves the phone on the same `tg_<id>` account.

`?next=` preserves a protected deep link through sign-in. `lib/next-path.ts`
allows local paths only and rejects sign-in loops and protocol-relative URLs.

## Session and threat model

- Session secret: `icone_session`, HttpOnly, server-set. No client SDK sessions
  and no tokens in `localStorage`.
- `proxy.ts` is a cheap cookie-presence redirect only. Every protected route
  validates the session against Appwrite in the page/route handler.
- Mutating route handlers check the same-origin header.
- Bot token and webhook secret are server-only. The webhook verifies Telegram's
  signature before acting.
- Manual phone entry remains a fallback; it uses the same code path and account.

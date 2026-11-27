# icone — project map

icone is a barber marketplace for Tashkent. One person is one Telegram account
(`tg_<telegram_id>`); there is no email, SMS, Login Widget or separate mini app
route. Production: <https://icone-uz.vercel.app>.

## What exists

- **Discovery:** `/barbers`, `/barbers/:id`, `/services`, `/favorites`.
- **Customer booking:** `/book`, `/bookings`, `/bookings/:id`, `/api/availability`.
  A profile slot link carries `barber`, `service`, `date` and `start` into the
  booking draft. Services shown and accepted are scoped to the chosen chair.
  The stored price includes the service's percentage discount.
- **Auth:** phone shared with one tap from web or Telegram; the bot sends a
  4-digit code. The request id is an HttpOnly cookie; the code lives briefly in
  an `otp_<nonce>` user's prefs and is deleted on success.
- **Barber business:** `/barber/**`, `/agenda`, `/agenda/me` for hours, menu,
  portfolio, promotions, customers and earnings. Any member can become a barber
  immediately through `/become-barber`; no admin approval step.
- **Admin:** `/admin/**` for platform management only. No admin account is seeded.
- **Messaging, reviews, payments, notifications:** booking-linked APIs and views.
- **Reminders:** `/api/cron/reminders`, called daily at 06:00 UTC by
  `.github/workflows/reminders.yml` with `CRON_SECRET`. Idempotent by design.

## What ships next

- Operator-driven improvements only. Keep additions simple and production-ready.
- No fake, seed or QA data in the live database. Local QA rows must be deleted
  before a change is called done.

## Source map

| Area | Files |
| --- | --- |
| App routes | `app/` |
| Shared UI | `components/ui/` (stock), `components/` (app-specific) |
| Server data | `lib/domain/` — all Appwrite access goes through here |
| Client queries/state | `lib/api/`, `lib/store/` |
| Auth | `lib/auth/`, `app/api/auth/`, `lib/domain/member.ts` |
| Translations | `lib/i18n/dictionaries.ts`, `components/i18n/t.tsx` |
| Schema setup | `scripts/setup-appwrite.mjs` |
| Telegram scripts | `scripts/telegram-*.mjs` |

## Done means

`cmd /c "npm run build"` and `cmd /c "npm run lint"` both pass; light and dark
are checked; 390px is checked; no secrets or throwaway data remain.

# Data

Appwrite Cloud is the only datastore. `scripts/setup-appwrite.mjs` creates the
schema idempotently and seeds only service categories. Barbers and services come
from real accounts; the live database must never contain fake, seed or QA rows.

## Naming

Collection ids and field keys are one lowercase word each. Access is only through
`lib/domain/*`; route handlers call domain functions, never the SDK directly.

| Table | Holds |
| --- | --- |
| `users` | `tg_<id>` members, temporary `otp_<nonce>` users, roles |
| `barbers` | chairs, profile, confirmation rule, `active` flag |
| `services` | menu, `price`, `time`, `discount`, optional `barber` owner |
| `hours` | weekly windows per barber and weekday (0 = Sunday) |
| `days` | per-date overrides: closed, or different hours |
| `bookings` | member, chair, service, date, start/end minutes, price, status |
| `reviews` | member rating bound to one booking and one chair |
| `favorites`, `promotions`, `portfolio`, `payments`, `notifications`, `messages`, `categories`, `applications`, `reminders`, `notes` | supporting records |

## Time and price

- Dates are `YYYY-MM-DD`; times are minutes from midnight in Tashkent time
  (`lib/domain/time.ts`, UTC+5). No local timezone is trusted during render.
- A service with a `barber` value belongs only to that chair. Empty `barber`
  means a shared service offered by every chair.
- `priceOf` in `lib/domain/pricing.ts` applies the percentage `discount` and
  rounds to whole UZS. `lib/domain/book.ts` stores that value on the booking and
  re-checks chair, service, date, lead time and overlap before inserting.
- Availability is slot-stepped around opening hours, date overrides and busy
  bookings. Two competing inserts are resolved after the fact: the oldest wins.

## Setup

Copy `.env.example` to `.env`, then run `cmd /c "npm run db:setup"`. The Appwrite
API key needs database and attribute scopes; see `.env.example` for every key.
Secrets stay server-only and are set in Vercel for production.

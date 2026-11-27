# Data

Appwrite Cloud is the only datastore. `scripts/setup-appwrite.mjs` creates the
schema idempotently and seeds Uzbekistan cities/districts and service
categories. Barbers, businesses and services come from real accounts; the live
database must never contain fake, seed or QA rows.

## Naming and access

Collection ids and field keys are one lowercase word each. All document access
goes through `lib/domain/*`; route handlers call domain functions and never the
Appwrite SDK directly. `lib/api/guard.ts` resolves the signed-in actor and
checks capabilities before any sensitive domain call.

| Table | Holds |
| --- | --- |
| `users` | `tg_<id>` accounts, temporary `otp_<nonce>` users, roles/prefs |
| `barbers` | professional profiles — independent barbers and shop employees |
| `businesses`, `branches` | barbershop profiles and locations |
| `memberships`, `invites` | team roles, per-member permission overrides, invitations |
| `services`, `empser` | shared catalog and per-employee price/duration overrides |
| `hours`, `breaks`, `days` | weekly windows, recurring breaks, date exceptions |
| `bookings`, `apptlog`, `clients` | appointments, status history, customer records/notes |
| `reviews`, `favorites`, `portfolio` | ratings, saved professionals, image galleries |
| `categories`, `places` | service categories, Uzbekistan cities/districts |
| `waits`, `reminders`, `notifications`, `messages` | waitlist, reminders, inbox, conversations |
| `applications`, `reports`, `tickets`, `audit`, `settings` | onboarding, moderation, support, audit trail, platform config |

`payments` and `promotions` remain in the live database from the previous
product but no code touches them: there are no online payments, commissions,
ads or promotional campaigns.

## Identity and isolation

- One person is one `tg_<telegram_id>` account. The same account is both a
  customer and a professional; no second login is created when someone becomes
  a barber.
- A barber row with an empty `business` is an independent professional (Model A).
  A barber row with a `business` id is a shop employee (Model B).
- `hours`/`breaks`/`days` store a generic `owner` id plus `kind`
  (`barber` or `branch`); always filter on both.
- Booking rows keep `business`, `branch`, `barber` and `client` context. Customer
  data is isolated: a professional only sees records attached to their own
  bookings, and a team member only sees records allowed by their role.

## Time, price and statuses

- Dates are `YYYY-MM-DD`; times are minutes from midnight in Asia/Tashkent
  (`lib/domain/time.ts`). No client clock is trusted for availability.
- Prices are whole UZS. `lib/domain/pricing.ts` resolves offered services and
  visit duration; the booking stores the price resolved at booking time.
- The canonical statuses are `pending`, `confirmed`, `rejected`, `cancelled`,
  `done`, `noshow`. Historical `booked`/`accepted`/`cancel` rows are normalized
  on read by `normalizeStatus()` — never rewrite history.
- Appwrite has no transactions. Booking safety is insert-then-verify: every
  competing insert is written, then exactly one deterministic winner (oldest
  `created`, then lowest `$id`) keeps the slot; the rest are cancelled.
- Walk-ins are real booking rows (`source: walkin`) and block the same slots as
  online bookings. Deactivated staff and retired services are not bookable.

## Images

Uploads go to Appwrite Storage through `POST /api/uploads` and
`lib/domain/upload.ts`. The route accepts `multipart/form-data` with a `file`
and a `folder` (`avatar`, `logo`, `cover`, `portfolio`, `service`), validates
type and size on the server, and returns the generated Appwrite **file id**.
Rows store that id — not a URL — in `photo`, `avatar`, `logo`, `cover`,
`portfolio.url` or `service.image`. `lib/client/files.ts` resolves an id to a
public view URL with the public endpoint, project and bucket id; legacy
absolute URLs still render as before.

## Setup

Copy `.env.example` to `.env`, then run `cmd /c "npm run db:setup"`. The Appwrite
API key needs database, attribute, document and collection scopes; see
`.env.example` for every key. Secrets stay server-only and are set in Vercel.

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

## Platform settings

The `settings` document holds only `applicationsOpen`, `autoVerify` and
`notice` — the fields the product actually reads (applications and the
sign-in notice). `maintenance`, `horizon` and `lead` were removed because no
code read them. Booking lead time and horizon are constants in
`lib/domain/availability.ts` (`LEAD_MINUTES` 30, `HORIZON_DAYS` 60), not
admin-editable values. Unknown legacy fields are dropped on read and on the
next write, so the stored document is cleaned without a migration script.

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

## Business root

The business, not the chair, is the default root of a professional workspace.
`activeBusiness(actor)` in `lib/domain/access.ts` is the single resolver: an
owned business (an active owner membership) wins, then an owner/manager
membership, then the first remaining membership. Every tier is sorted
explicitly, so Appwrite's list order cannot change the answer. It returns
`{ id, name, branch? }` and is exposed as `getActor().summary.active`; the
synchronous `activeBusinessId(actor)` helper is for pages and route handlers
that only need the id. An independent barber has no business root (`null`) and
keeps their own chair as the root.

`BusinessSwitcher` in the workspace header lets owners and managers choose
among their businesses and branches. The choice is UI-only: it lives in plain
`icone_business` / `icone_branch` cookies, never in a server row, and never
changes authorization, membership, booking context or prices. A saved cookie
that no longer matches an available option is ignored.

The report-only step in `scripts/migrate.mjs` prints how many businesses have
no active owner membership and how many barber rows have a business or branch
that disagrees with their memberships. It modifies nothing. Ownership is
inferred from active owner memberships, so the report is where legacy rows
whose `businesses.owner` field disagrees with memberships surface.

## Time, price and statuses

- Dates are `YYYY-MM-DD`; times are minutes from midnight in Asia/Tashkent
  (`lib/domain/time.ts`). No client clock is trusted for availability.
- Prices are whole UZS. `lib/domain/pricing.ts` resolves offered services and
  visit duration; the booking stores the price resolved at booking time.
- The canonical statuses are `pending`, `confirmed`, `rejected`, `cancelled`,
  `done`, `noshow`. Historical `booked`/`accepted`/`cancel` rows are normalized
  on read by `normalizeStatus()` — never rewrite history.
- `lib/domain/types.ts` is the one status authority: `HOLDING_STATUSES`
  (`pending`, `confirmed`) with `isHolding()`, `isCancellable()` and
  `CANCELLABLE`, plus `VISIT_STATUSES`, `COMPLETED_STATUSES` and
  `DISMISSED_STATUSES` for history. `done` is **historical**: it counts as a
  visit and as revenue but never holds a future slot. Availability, booking
  race checks and upcoming lists use `isHolding()`; CRM visit counts use
  `isVisit()` so completed visits stay in the customer's history. Never spell
  out a status group in a route handler or component.
- Appointment transitions re-read the booking and use the append-only
  `apptlog` as a best-effort claim: only the writer whose log row is the sole
  addition since its read may update the row; the other gets `409
  transition_conflict`. No database transactions are available; conflicts and
  failed log writes are logged for diagnosis.
- Appwrite has no transactions. Booking safety is insert-then-verify: every
  competing insert is written, then exactly one deterministic winner (oldest
  `created`, then lowest `$id`) keeps the slot; the rest are cancelled.
- Walk-ins are real booking rows (`source: walkin`) and block the same slots as
  online bookings. Deactivated staff and retired services are not bookable.
- `bookings.items` currently stores a JSON array of service ids.
  `parseItems()` in `lib/domain/booking.ts` reads that legacy shape and a future
  array of `BookingItemSnapshot` (`service`, `name`, `price`, `time`) into one
  snapshot list; write paths still store ids. `Offer`, `CustomerRecord` and
  `ConversationRecord` in `lib/domain/types.ts` are read-side shapes for the
  next slice of work, not new Appwrite columns.

## Images

Uploads go to Appwrite Storage through `POST /api/uploads` and
`lib/domain/upload.ts`. The route accepts `multipart/form-data` with a `file`
and a `folder` (`avatar`, `logo`, `cover`, `portfolio`, `service`), validates
type and size on the server, and returns the generated Appwrite **file id**.
Rows store that id — not a URL — in `photo`, `avatar`, `logo`, `cover`,
`portfolio.url` or `service.image`. `lib/client/files.ts` resolves an id to a
public view URL with the public endpoint, project and bucket id; legacy
absolute URLs still render as before.

## Materialised reads and migrations

- `offers` is the authoritative employee-service read model: it owns
  assignment, price and duration. `services` supplies the catalogue metadata
  and `empser` is kept only as the legacy mirror. `lib/domain/offers.ts`
  resolves one pair from `offers` first with a legacy fallback, and
  `lib/domain/catalog.ts` builds the full menu from `offers` with a
  per-service legacy fallback for rows not yet materialised. An inactive offer
  is an explicit unassignment, even if a legacy `empser` row still says active.
  Write paths (`/api/barber/services` and `/api/barber/services/assign`)
  materialise the offer first and mirror to `empser` afterwards; response
  shapes are unchanged. No `-1` sentinel is written to `offers`.
- `customers` is one canonical customer per business (owner = business id or
  an independent barber id). `clients` is retained for one release; no
  destructive merge. `bookings.customer` links a visit to that record, and
  `bookings.items` stores a `{service,name,price,time}` snapshot so renaming a
  service cannot rewrite history.
- `conversations` holds canonical participant pairs, last message preview and
  per-participant unread counters. Opening a thread clears that participant's
  unread count. Historical messages are untouched.
- `ratelimit` and `migrations` are shared infrastructure collections. The
  limiter is Appwrite-backed (per-instance memory is unsafe on serverless).
- Deploy order: `npm run db:setup` (fresh installs) or `npm run db:migrate`
  (existing installs), then `npm run db:backfill`, then deploy the app. All
  backfills are idempotent and report counts; none deletes rows.

## Setup

Copy `.env.example` to `.env`, then run `cmd /c "npm run db:setup"`. The Appwrite
API key needs database, attribute, document and collection scopes; see
`.env.example` for every key. Secrets stay server-only and are set in Vercel.

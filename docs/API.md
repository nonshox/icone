# API conventions

Route handlers are thin: validate input, resolve the actor through
`lib/api/guard.ts`, call a `lib/domain/*` function, return JSON. They never query
Appwrite directly and never export `runtime`. Errors use `lib/http.ts` as
`{ ok: false, error: { message, code } }`; success is `{ ok: true, ... }`.
Writes check the same-origin header and are rate limited.

## Public reads

| Route | Purpose |
| --- | --- |
| `GET /api/barbers`, `GET /api/barbers/:id` | bookable professionals and one public profile |
| `GET /api/services` | active services with resolved prices |
| `GET /api/availability?barber=&date=&services=` | real free slot starts for one professional; several `services` params are combined into one visit duration |
| `GET /api/health` | readiness probe |
| `GET /robots.txt`, `GET /sitemap.xml`, `GET /manifest.webmanifest` | crawler/PWA files |

Availability is computed on the server from working hours, breaks, date
exceptions, service duration and buffer, busy bookings (pending and confirmed),
employee qualifications and branch assignment. It rejects inactive
professionals and retired services before doing any slot work.

## Members

| Route | Purpose |
| --- | --- |
| `POST /api/auth/phone/start`, `POST /api/auth/phone/verify` | one-tap phone sign-in |
| `POST /api/auth/telegram/mini`, `POST /api/auth/telegram/phone` | in-app sign-in and phone save |
| `GET/POST /api/bookings`, `GET/POST/PATCH /api/bookings/:id` | create (one or several services), list, read, cancel and reschedule |
| `POST /api/reviews`, `GET /api/reviews?barber=` | write and read ratings |
| `GET/PATCH /api/me`, `/api/settings`, `/api/favorites`, `/api/notifications`, `/api/messages` | account and inbox |
| `GET/POST /api/applications` | professional onboarding with save/resume |

Members may cancel their own future bookings inside the cancellation window.
Only authorized staff can accept, reject, complete or mark a no-show. Status
history is appended to `apptlog` and never rewritten.

## Professional workspace

`/api/barber/**` and `/api/staff/**` are capability-gated through
`requireCap(capability, scope)`. An independent barber always controls their own
professional row; a team member is limited by their role and per-membership
overrides. Walk-ins are created through `bookWalkin` as real booking rows and
block online availability immediately.

## Platform admin

`/api/admin/**` calls `requireAdmin()` first. Every sensitive change writes an
entry to `audit`. Applications are decided through `decideApplication()`; no
verification badge appears before approval.

## Scheduled work

`/api/cron/reminders` is protected by `CRON_SECRET` and is idempotent: a
reminder row moves to `sent` before the Telegram message is attempted, so a
repeated run cannot send it twice.

## Booking deep links

`/book?barber=<id>&service=<id>&date=<YYYY-MM-DD>&start=<minutes>` seeds the
draft. Anonymous visitors are redirected to
`/sign-in?next=<encoded path>` and return to the exact link after sign-in.

## Moderation, support and platform operations

| Route | Purpose |
| --- | --- |
| `POST /api/reports` | member reports a user, review, booking or business |
| `GET/PATCH /api/admin/reports` | moderation queue (`?state=`) and decisions (`?days=` keeps the analytics view) |
| `POST /api/tickets`, `GET/PATCH /api/admin/tickets` | support requests and replies |
| `GET /api/admin/audit` | append-only audit trail with filters |
| `GET/PATCH /api/admin/settings` | platform switches and notice |
| `GET/PATCH /api/admin/professionals` | verification and suspension of professionals/businesses |
| `GET/POST/PATCH /api/admin/places` | cities and districts |
| `POST/PATCH /api/barber/reviews` | public replies to reviews |
| `GET/POST/PATCH/DELETE /api/barber/team` | invitations, roles, permissions, members |
| `GET/POST/PATCH/DELETE /api/barber/branches` | locations and branch settings |
| `GET /api/barber/analytics` | scoped operational statistics |
| `GET /api/invites`, `POST/DELETE /api/invites` | invitations for the signed-in account |
| `GET/POST/DELETE /api/waits` | waitlist requests |
| `POST /api/walkins` | slot-blocking walk-in visits |
| `POST /api/staff/clone` | copy the weekly hours template onto next week |
| `GET /api/search?q=` | unified Uzbek/Russian-aware discovery for barbers and shops |

## Image uploads

`POST /api/uploads` accepts `multipart/form-data` (`file`, `folder`), requires a
session, checks the origin and rate limit, and returns
`{ ok: true, id, url }`. The `id` is stored in the row; the `url` is only a
preview hint. Storage is Appwrite; no image is ever passed through JSON.

## No payment endpoints

There is no `/api/payments`, no commission and no subscription check. Customers
settle directly with the barbershop in cash or by a private arrangement.

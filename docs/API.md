# API conventions

Route handlers are thin: validate input, call a `lib/domain/*` function, return
JSON. They never query Appwrite directly and never export `runtime`. Errors use
`lib/http.ts` as `{ ok: false, error: { message, code } }`.

## Public reads

| Route | Purpose |
| --- | --- |
| `GET /api/barbers`, `GET /api/barbers/:id` | active chairs and one profile |
| `GET /api/services` | active menu |
| `GET /api/availability?barber=&date=&service=` | free slot starts for one chair |
| `GET /api/health` | readiness probe |
| `GET /robots.txt`, `GET /sitemap.xml`, `GET /manifest.webmanifest` | crawler/PWA files |

Availability rejects an inactive chair, an inactive service and a service owned
by another chair before doing any slot work.

## Member writes

| Route | Purpose |
| --- | --- |
| `POST /api/auth/phone/start`, `POST /api/auth/phone/verify` | one-tap phone sign-in |
| `POST /api/auth/telegram/mini`, `POST /api/auth/telegram/phone` | in-app sign-in and phone save |
| `GET/POST /api/bookings`, `GET/PATCH /api/bookings/:id` | create, list, read, cancel |
| `POST /api/reviews`, `GET /api/reviews?barber=` | write and read ratings |
| `GET/PATCH /api/me`, `/api/favorites`, `/api/notifications`, `/api/messages`, `/api/payments` | customer extras |

Members may cancel their own future booking in any active state (`pending`,
`accepted`, `booked`). Only staff may move a booking to other statuses. The
single-booking read includes the `reviewed` flag, so both visit views share one
review mutation and one cache key.

## Staff and admin

`/api/barber/**`, `/api/staff/**`, `/api/admin/**` are role-gated and
same-origin checked. `/api/cron/reminders` is protected by `CRON_SECRET` and is
idempotent: a reminder is never sent twice.

## Booking deep links

`/book?barber=<id>&service=<id>&date=<YYYY-MM-DD>&start=<minutes>` seeds the
draft. Anonymous visitors are redirected to
`/sign-in?next=<encoded path>` and return to the exact link after sign-in.

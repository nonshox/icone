# icone — HTTP API

All routes are App Router route handlers (dynamic, Node runtime). Every JSON
body uses the envelope from `lib/http.ts`:

```jsonc
{ "ok": true, ...payload }                              // 2xx
{ "ok": false, "error": { "message": "…", "code": "…" } } // 4xx / 5xx
```

`message` is a human sentence safe to show in a toast. `code` is a stable
snake_case identifier. `lib/api/client.ts` throws `ApiError` on `!ok`, so
TanStack Query hooks only deal with success payloads.

Status codes: `400` validation, `401` signed out, `403` forbidden / bad origin,
`404` missing resource, `409` conflict, `429` rate limited, `502` upstream
failure.

Every `POST`/`PATCH` checks `isSameOrigin(request)`. Requests without an
`Origin` header (curl, server-to-server) are allowed; the session cookie is
`SameSite=Lax`.

## Public

| Method | Path | Query / body | Response |
| --- | --- | --- | --- |
| GET | `/api/barbers` | — | `{ barbers: Barber[] }` (active only) |
| GET | `/api/barbers/:id` | — | `{ barber, hours, reviews }` |
| GET | `/api/services` | — | `{ services: Service[] }` (active only) |
| GET | `/api/services/:id` | — | `{ service }` |
| GET | `/api/availability` | `barber`, `date`, `service` | `{ slots: Slot[], time }` |
| GET | `/api/reviews` | `barber` | `{ reviews: Review[] }` |

`GET /api/availability` returns `400 no_barber`, `400 bad_date` or
`400 no_service` when a required parameter is missing.

## Auth

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/api/auth/email/start` | `{ email }` | `{ ok: true }` + OTP cookie |
| POST | `/api/auth/email/verify` | `{ code }` | `{ user }` + `icone_session` cookie |
| GET | `/api/auth/telegram/callback` | Telegram widget query | `303 /account` + cookie |
| POST | `/api/auth/telegram/mini` | `{ initData }` | `{ ok: true, user, webLoginUrl }` + cookie; `401 bad_signature` |
| GET | `/api/auth/ticket` | `ticket` | one-time login → `303 /account` + cookie |
| POST | `/api/auth/logout` | — | `{ ok: true }`, clears cookie |
| GET | `/api/telegram/webhook` | — | `{ ok: true, service }` health check |
| POST | `/api/telegram/webhook` | Telegram `Update` + `X-Telegram-Bot-Api-Secret-Token` | `200 { ok: true }`; `401` on bad secret |

See [`AUTH.md`](./AUTH.md) for the session and Telegram details.

## Member

| Method | Path | Query / body | Response |
| --- | --- | --- | --- |
| GET | `/api/me` | — | `{ profile, user }` |
| PATCH | `/api/me` | `{ name?, phone? }` | `{ profile }` |
| GET | `/api/bookings` | — | `{ bookings: BookingRow[] }` |
| POST | `/api/bookings` | `{ barber, service, date, start, note? }` | `201 { booking }` |
| GET | `/api/bookings/:id` | — | `{ booking }` |
| PATCH | `/api/bookings/:id` | `{ status: "cancel" }` | `{ booking }` |
| POST | `/api/reviews` | `{ booking, rate, note? }` | `201 { review, rating }` |

`BookingRow` is a booking plus `barberName`, `serviceName`, `serviceTime` and,
for the member list, a `reviewed` flag. `start` and `end` are minutes from
midnight; `price` is UZS.

Booking conflicts return `409 slot_taken` or `409 already_booked`. Bad times
return `400 bad_time`; too-soon same-day slots return `409 too_soon`.

## Staff / admin

| Method | Path | Query / body | Response |
| --- | --- | --- | --- |
| GET | `/api/bookings?date=YYYY-MM-DD` | optional `barber` | `{ bookings: BookingRow[] }` with `userName` |
| PATCH | `/api/bookings/:id` | `{ status: "done" \| "noshow" \| "cancel" }` | `{ booking }` |
| GET | `/api/admin/barbers` | — | `{ barbers }` incl. inactive (staff) |
| POST | `/api/admin/barbers` | `{ name, title, bio }` | `201 { barber }` (admin) |
| PATCH | `/api/admin/barbers` | `{ id, active }` | `{ barber }` (admin) |
| GET/POST | `/api/admin/services` | `{ name, note, price, time }` | list / `201` create |
| PATCH | `/api/admin/services` | `{ id, active }` | `{ service }` |
| GET/POST | `/api/admin/hours` | `{ barber, day, start, end }` | list / `201` create |
| DELETE | `/api/admin/hours` | `id` query | `{ ok: true }` |
| GET/POST | `/api/admin/days` | `{ barber, date, open, start, end, note }` | list / upsert |
| DELETE | `/api/admin/days` | `id` query | `{ ok: true }` |
| GET | `/api/admin/reviews` | — | `{ reviews }` for moderation |
| DELETE | `/api/admin/reviews` | `id` query | `{ ok: true }` |

Admin writes require `users.role = "admin"`; reads allow `barber` and `admin`.
Day overrides upsert per chair/date so availability never has two winners.

## Cron

| Method | Path | Header | Response |
| --- | --- | --- | --- |
| GET/POST | `/api/cron/reminders` | `x-cron-secret: <TELEGRAM_WEBHOOK_SECRET>` | `{ ok: true, counts }` |

`vercel.json` schedules this at 06:00 UTC daily. Vercel Cron sends
`Authorization: Bearer $CRON_SECRET`; set `CRON_SECRET` in Vercel to the same
value as `TELEGRAM_WEBHOOK_SECRET`. The route also accepts that Bearer header.
A 60-second in-process cooldown prevents accidental double runs.

Requires `users.role` = `barber` or `admin`. A `barber` is forced to own
chair (from `barbers.user`); an `admin` may pass any `barber`. A `barber`
without a linked chair gets `403 no_chair`.

## Client data layer

`lib/api/queries.ts` owns the TanStack Query hooks and their cache keys:

```
["barbers"]  ["services"]  ["availability", barber, date, service]
["bookings"] ["agenda", date, barber]  ["reviews", barber]  ["me"]
```

Mutations invalidate the affected keys. `lib/store/booking.ts` holds only the
draft form (service, barber, date, start, note) — the server remains the
authority for availability, price and status.

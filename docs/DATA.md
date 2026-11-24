# icone — data model

## Naming rules

- **One word per table.** All lowercase: `users`, `barbers`, `services`,
  `hours`, `days`, `bookings`, `reviews`.
- **One word per key.** No prefixes, no `_*id` suffixes. `user`, `barber`,
  `service` and `booking` hold document ids as plain strings.
- Appwrite's own `$id`, `$createdAt` and `$updatedAt` are used instead of
  duplicating `id` / `created` fields.
- Collections have no client permissions (`permissions: []`,
  `documentSecurity: false`). Every read and write goes through a server-only
  helper with the API key.

## Tables

| Table | Keys | Indexes | Purpose |
| --- | --- | --- | --- |
| `users` | `name`, `phone`, `role`, `avatar` | `role` | One row per auth user; document id = Appwrite user id. Roles: `client`, `barber`, `admin`. |
| `barbers` | `name`, `title`, `bio`, `photo`, `rating`, `active`, `user`, `shop`, `address`, `city`, `years`, `skills`, `phone`, `social`, `facilities`, `policy`, `cover`, `confirm`, `featured` | `active`, `user`, `city` | A chair and its public business profile. `user` links a staff account; `confirm` requires booking approval; `featured` marks promoted listings. |
| `services` | `name`, `note`, `price`, `time`, `active`, `image`, `category`, `featured`, `discount`, `barber` | `active`, `owner`, `category` | The menu. `price` in UZS, `time` in minutes, `discount` in percent. |
| `hours` | `barber`, `day`, `start`, `end` | `week` (`barber`,`day`) | Weekly opening hours. `day` 0=Sun … 6=Sat. |
| `days` | `barber`, `date`, `open`, `start`, `end`, `note` | `lookup` (`barber`,`date`) | One-off override: closed day or different hours. |
| `bookings` | `user`, `barber`, `service`, `date`, `start`, `end`, `price`, `status`, `note` | `slot` (`barber`,`date`,`status`), `mine` (`user`,`date`), `agenda` (`date`,`status`) | A reserved interval. `status`: `pending`, `accepted`, `booked`, `done`, `cancel`, `noshow`, `rejected`. |
| `reviews` | `user`, `barber`, `booking`, `rate`, `note` | `about` (`barber`), `once` (`booking`, unique) | One review per completed booking. `rate` 1–5. |
| `reminders` | `user`, `booking`, `date`, `at`, `state`, `tries` | `due` (`date`,`state`), `once` (`booking`, unique) | One Telegram reminder per booking. `state`: `pending`, `sent`. `tries` caps retries at 3. |
| `favorites` | `user`, `barber` | `mine` (`user`,`barber`, unique) | Saved chairs per customer. |
| `notifications` | `user`, `title`, `body`, `kind`, `state` | `inbox` (`user`,`state`) | In-app inbox for bookings, messages, offers and announcements. |
| `messages` | `conversation`, `sender`, `body` | `thread` (`conversation`) | Private conversation about a booking. |
| `promotions` | `barber`, `name`, `kind`, `amount`, `start`, `end`, `uses`, `limit`, `note`, `active` | `shop` (`barber`,`active`) | Offers shown on the public profile. `kind`: `percent` or `fixed`. |
| `notes` | `barber`, `user`, `note` | `pair` (`barber`,`user`, unique) | Private barber notes — never returned to customers. |
| `payments` | `booking`, `amount`, `status`, `method` | `for` (`booking`) | Payment state. `status`: `pending`, `paid`, `partial`, `refunded`, `unpaid`. |
| `portfolio` | `barber`, `url`, `note` | `owner` (`barber`) | Public haircut gallery images. |
| `applications` | `user`, `name`, `shop`, `city`, `address`, `phone`, `bio`, `state`, `note` | `queue` (`state`), `mine` (`user`, unique) | Barber applications. `state`: `pending`, `approved`, `rejected`. |
| `categories` | `name`, `active` | `active` | Platform service categories. |

`ensureBarberChair()` in `lib/domain/data.ts` creates the `barbers` row for a
staff account on first use. It is idempotent and race-safe, and is used both by
application approval and by the staff entry points so an interrupted approval
cannot leave a barber without a chair.

## Time model

- Dates are plain `YYYY-MM-DD` strings. Times are minutes from midnight
  (e.g. `600` = 10:00). Both are timezone-free, so nothing depends on the
  server's locale.
- All interpretation uses `Asia/Tashkent` (`lib/domain/time.ts`).
- Prices are integer UZS, never floats.

## Booking rules

- Slots are on a 15-minute grid; the service must fit entirely inside an
  opening window.
- Same-day bookings need at least 30 minutes of lead time.
- The calendar is open 60 days ahead.
- A member cannot hold two overlapping bookings.
- Two concurrent requests can both pass the availability check. After insert,
  `lib/domain/book.ts` looks at overlapping rows and keeps the oldest; the
  loser is deleted and told the slot is gone.
- Only staff can mark a visit `done`, `noshow` or `cancel`. Members can cancel
  their own future booking. Reviews require a `done` booking.

## Setup

```powershell
copy .env.example .env   # fill in the real values
cmd /c "npm run db:setup"
```

`scripts/setup-appwrite.mjs` is idempotent: it creates the database (if
missing), all 18 collections, attributes, indexes and seeds three services,
three barbers and their weekly hours. Re-running it leaves existing data alone.

The server API key needs these scopes in the Appwrite console:

```
databases.read   databases.write
collections.read collections.write
attributes.read  attributes.write
indexes.read     indexes.write
documents.read   documents.write
```

Without `collections.read` the script exits immediately with this message
instead of failing seven times with `general_unauthorized_scope`. The same
scopes are required at runtime — the app reads `services`, `barbers`, `hours`
and `bookings` on every booking request.

## Staff

Promote an account and optionally link it to a chair:

```powershell
node scripts/staff.mjs you@example.com barber brb_bekzod
node scripts/staff.mjs tg_123456789 admin
```

This updates `users.role` and, when a barber id is given, `barbers.user`.
A `barber` account only sees own-chair bookings in `/api/bookings?date=…`;
an `admin` can filter by any chair.

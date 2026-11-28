# Engineering conventions

Next.js 16.4.6, Cache Components and Partial Prefetching are enabled in
`next.config.ts`. Read `node_modules/next/dist/docs/` before changing rendering
or data-loading patterns in this version; it is not the Next.js from older
training data.

## Rendering rules

- `cookies()` / `headers()` reads and any session lookup sit inside `<Suspense>`.
- Never call `new Date()` or `Date.now()` during a prerendered render. Use
  `lib/client/date.ts` (`useShopDate`) in the browser and `lib/domain/time.ts`
  (`shopClock`) server-side at request time.
- Slot previews are client queries so build-day dates never enter the HTML.
- Route handlers never export `runtime`.
- Static help/legal pages stay static; booking and account routes stream their
  session-bound parts.

## Data rules

- All document access goes through `lib/domain/*`. Route handlers call domain
  functions, never the Appwrite SDK directly.
- Table ids and field keys are one lowercase word each. See `docs/DATA.md`.
- TanStack Query owns server data (`lib/api/queries.ts`). Zustand holds only
  ephemeral UI state (`lib/store/`). Never seed client state from the clock
  during render.
- Booking prices are resolved from the offered services once, in
  `lib/domain/pricing.ts`, and stored on the booking at creation. There are no
  platform promotions or discounts: a barbershop may set different prices per
  employee, and that is the price the customer sees and pays at the shop.
- Availability is server-owned (`lib/domain/availability.ts`). Walk-ins write
  real booking rows and therefore block the same slots as online bookings.
  Concurrent requests are resolved after insert with a deterministic winner.

## Schema changes

- `npm run db:setup` is for **fresh installs**. It creates the whole schema
  idempotently, seeds reference data and records the current schema version in
  the `migrations` collection (document `schema`). It never deletes or rewrites
  rows, so re-running it after a partial failure is safe.
- `npm run db:migrate` is for **deploys**. `scripts/migrate.mjs` reads the stored
  version and applies only newer steps, forward-only. Every step adds a missing
  collection, attribute or index; nothing backfills, deletes or rewrites live
  rows. The final step is report-only: it counts duplicate `clients` by
  `(business, phone)` and mismatched `barbers.user` / `memberships.barber`
  links, printing counts without changing data.
- When adding a step, append it to `steps` in `scripts/migrate.mjs`, bump
  `SCHEMA_VERSION` there **and** in `scripts/setup-appwrite.mjs`, and add the
  same collection/attribute definitions to the setup schema so fresh installs
  and deploys converge.
- `ratelimit` holds shared fixed-window counters. Its document id is a hash of
  the caller's key, so no raw key (or personal data) is stored. `offers`,
  `customers` and `conversations` are foundations for the next product model and
  are currently schema-only; `bookings.customer` and `apptlog.at` are additive
  fields that older rows leave at their defaults.

## Auth rules

- Session secret: `icone_session` HttpOnly cookie. No Appwrite SDK sessions in
  the browser; no tokens in `localStorage`.
- The bot knows the Telegram chat, so web and in-app sign-in resolve to the same
  `tg_<id>` account. Phone is shared with one tap; typing is a fallback only.
- Images go to Appwrite Storage through `/api/uploads` as multipart form data.
  Rows store only the generated file id; `NEXT_PUBLIC_APPWRITE_BUCKET_ID`
  resolves it in the browser. The API key never reaches the client.
- `APPWRITE_API_KEY`, `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` are
  server-only. Never prefix them with `NEXT_PUBLIC_`, log them, or send them to
  the client.
- `lib/rate-limit.ts` is `server-only` and async. Counters live in the shared
  `ratelimit` collection, not in a per-instance `Map`. Callers pass the key;
  `rateLimit(key, limit, windowMs)` resolves to `{ ok, remaining, retryAfter }`.
  Infrastructure failures fail open and are logged; application/configuration
  failures fail closed. Keys keep their existing meaning — the pre-auth
  endpoints use the opaque request bucket only as a limiter key, never as an
  identity decision.

## Gates

Run these before calling a task done:

```powershell
cmd /c "npm run lint"
cmd /c "npm run typecheck"
cmd /c "npm run check:i18n"
cmd /c "npm run build"
```

`.github/workflows/ci.yml` runs the same four gates on every push and pull
request with placeholder environment values. `check:i18n` compares the key sets
of the `uz`, `ru` and `en` dictionaries; every new copy key must exist in all
three. On this machine npm runs through `cmd /c`; the PowerShell wrapper is
blocked.

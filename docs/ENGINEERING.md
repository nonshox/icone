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

## Gates

Run both before calling a task done:

```powershell
cmd /c "npm run build"
cmd /c "npm run lint"
```

On this machine npm runs through `cmd /c`; the PowerShell wrapper is blocked.

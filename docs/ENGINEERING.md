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
- Booking prices are computed once in `lib/domain/pricing.ts` (`priceOf`) and
  stored on the booking at creation. Discounts shown in the UI are the discounts
  charged.

## Auth rules

- Session secret: `icone_session` HttpOnly cookie. No Appwrite SDK sessions in
  the browser; no tokens in `localStorage`.
- The bot knows the Telegram chat, so web and in-app sign-in resolve to the same
  `tg_<id>` account. Phone is shared with one tap; typing is a fallback only.
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

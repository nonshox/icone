# icone

Barber booking for Tashkent. Passwordless sign-in, live availability, staff
agenda, Appwrite backend. Production: <https://icone-uz.vercel.app>.

Auth and booking are live; Telegram reminders are not built yet. See
[`docs/PROJECT.md`](./docs/PROJECT.md) for the roadmap.

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · Tailwind v4 · shadcn
(`base-nova`) · TanStack Query · Zustand · Appwrite Cloud · Telegram Login
Widget · Vercel Analytics.

## Getting started

```powershell
copy .env.example .env.local   # then fill in the real values
cmd /c "npm install"
cmd /c "npm run db:setup"      # create tables + seed catalogue
cmd /c "npm run dev"
```

Open <http://localhost:3000>.

> On this machine `npm` must run through `cmd`, because the PowerShell wrapper
> (`npm.ps1`) is blocked by execution policy.

### Environment

`.env.example` documents every variable. Real secrets live in `.env.local`,
which is gitignored. `.env.production` holds only public values (production
URL, Appwrite project, Telegram flag) and is safe to commit; Vercel secrets
are set in the project dashboard.

Server-only secrets (`APPWRITE_API_KEY`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_WEBHOOK_SECRET`) must never carry a `NEXT_PUBLIC_` prefix. The Appwrite
API key also needs database scopes — see [`docs/DATA.md`](./docs/DATA.md#setup).

### Telegram

The Login Widget only works for domains registered with the bot. Run
`/setdomain icone-uz.vercel.app` in `@BotFather`, then keep
`NEXT_PUBLIC_TELEGRAM_LOGIN_ENABLED=true` in production. Locally it is `false`
so a clean fallback renders instead of Telegram's "Bot domain invalid" frame.
Details in [`docs/AUTH.md`](./docs/AUTH.md).

## Scripts

| Command | Purpose |
| --- | --- |
| `cmd /c "npm run dev"` | dev server |
| `cmd /c "npm run build"` | type-check + production build (the gate) |
| `cmd /c "npm run lint"` | ESLint |
| `cmd /c "npm run db:setup"` | create tables, indexes and seed data |
| `cmd /c "npm run db:staff"` | promote a member / link a barber chair |
| `cmd /c "npm run qa:auth"` | end-to-end auth probe (dev server required) |
| `cmd /c "npm run qa:booking"` | end-to-end booking probe (needs DB scopes) |

## Routes

| Path | Purpose |
| --- | --- |
| `/` | landing page |
| `/sign-in` | email one-time code + Telegram |
| `/account` | profile, stats, shortcuts |
| `/book` | booking flow |
| `/bookings` | visits, cancel, reviews |
| `/agenda` | staff day view |
| `/api/barbers` · `/api/services` · `/api/availability` | catalogue + times |
| `/api/bookings` · `/api/reviews` · `/api/me` | member operations |
| `/api/auth/*` | sign-in and sign-out |
| `/robots.txt` · `/sitemap.xml` | crawler files |

The full endpoint list is in [`docs/API.md`](./docs/API.md).

## Documentation

- [`docs/PROJECT.md`](./docs/PROJECT.md) — brief, milestones, source map
- [`docs/DATA.md`](./docs/DATA.md) — tables, keys, indexes, seed, staff setup
- [`docs/API.md`](./docs/API.md) — endpoints, envelopes, status codes
- [`docs/DESIGN-SYSTEM.md`](./docs/DESIGN-SYSTEM.md) — tokens, glass, components
- [`docs/ENGINEERING.md`](./docs/ENGINEERING.md) — Next 16 rules, conventions
- [`docs/AUTH.md`](./docs/AUTH.md) — auth architecture, provider setup, threats

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
copy .env.example .env   # then fill in the real values
cmd /c "npm install"
cmd /c "npm run db:setup"      # create tables + seed catalogue
cmd /c "npm run dev"
```

Open <http://localhost:3000>.

> On this machine `npm` must run through `cmd`, because the PowerShell wrapper
> (`npm.ps1`) is blocked by execution policy.

### Environment

Only two env files exist: `.env.example` (committed template, every key listed)
and `.env` (gitignored, same keys with real values). Vercel overrides the public
values in production: `NEXT_PUBLIC_APP_URL=https://icone-uz.vercel.app`.
Server secrets are set in the Vercel dashboard.

Server-only secrets (`APPWRITE_API_KEY`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_WEBHOOK_SECRET`) must never carry a `NEXT_PUBLIC_` prefix. Set Vercel's
GitHub's `CRON_SECRET` repository secret to the same value as
`TELEGRAM_WEBHOOK_SECRET` so the daily reminder job can authenticate. The
Appwrite API key also needs database scopes — see
[`docs/DATA.md`](./docs/DATA.md#setup).

### Telegram

The whole site is the Telegram Mini App — there is no `/mini` page. The bot menu
button opens the app root:
`cmd /c "npm run tg:miniapp"`, then `cmd /c "npm run tg:miniapp -- set"`.

## Sign-in

Telegram only. `/sign-in` asks for a phone number, creates a 4-digit code, and
the bot sends it to Telegram. Tap **Open Telegram**, read the code, and type it
back where you started — the session is created in that browser or in the app.
A request id is held in an HttpOnly cookie; the code is stored server-side in
the user's preferences, expires in five minutes and allows five tries.

When any page is opened from Telegram, the app signs in automatically from
Telegram's signed `initData` and stays on the same page. No email, no SMS, no
Login Widget, and no separate sign-in screen inside the app.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | landing page |
| `/barbers` · `/barbers/:id` | public chair list and profile |
| `/services` | service catalogue |
| `/sign-in` | Telegram only |
| `/start` | role-based entry after sign-in |
| `/customer` | customer dashboard |
| `/become-barber` | apply to run a chair |
| `/account` | shared profile |
| `/bookings` · `/bookings/:id` | visits and detail |
| `/favorites` · `/notifications` · `/settings` | customer extras |
| `/messages` | private booking conversations |
| `/agenda` · `/agenda/me` · `/barber/**` | barber tools |
| `/admin/**` | platform management |
| `/help` · `/support` · `/legal/*` | help and policies |
| `/api/barbers` · `/api/services` · `/api/availability` | catalogue + times |
| `/api/bookings` · `/api/reviews` · `/api/me` | member operations |
| `/api/auth/*` | sign-in and sign-out |
| `/api/admin/*` | catalogue management |
| `/api/cron/reminders` | protected reminder runner |
| `/api/health` | readiness probe |
| `/robots.txt` · `/sitemap.xml` · `/manifest.webmanifest` | crawler + PWA files |

## Languages

Uzbek is the default; switch to Russian or English from the header menu. The
choice persists in `localStorage` and a cookie. Core navigation, landing, auth,
booking, statuses and account copy are translated; database content (barber
names, service notes, reviews) stays as entered.

# icone — project brief

## What it is

**icone** is a barber-booking product for Tashkent. The promise: a sharp cut,
booked ahead, with no phone calls, no queues and no passwords.

Auth **and booking** are implemented. Members sign in, reserve a chair from
live availability, manage visits and review completed cuts. Staff get a day
agenda.

| | |
| --- | --- |
| Production | <https://icone-uz.vercel.app> |
| Name | `icone` — always lowercase, never "Icone" or "ICONE" in body copy |
| Mark | lowercase wordmark + a brass dot after the `e` |
| Voice | calm, precise, quietly confident. Short sentences. No hype. |
| Palette | warm ink on paper (light), warm ink on charcoal (dark), brass accent |
| Tagline | "Your chair is waiting." |
| Locale | Tashkent, Uzbekistan — prices in UZS, times in 24h, en copy for now |

## Milestones

1. **Auth (done)** — email one-time code, Telegram Mini App, server-side
   Appwrite sessions, HttpOnly cookie, light/dark UI.
2. **Booking (done)** — barbers, services, weekly hours and date overrides,
   live availability, conflict-safe booking, visits, reviews, staff agenda.
3. **Reminders (done)** — Telegram reminder for tomorrow's booking, protected
   cron endpoint, one reminder per booking.
4. **Polish (in progress)** — visual cleanup, performance pass, broader admin UI.

Do not start milestone 3 without an explicit instruction from the owner.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.4 App Router (Cache Components, Partial Prefetching) |
| UI | React 19, Tailwind v4, shadcn (`base-nova`), Base UI primitives |
| Icons | `lucide-react` |
| Server state | Appwrite Databases, accessed through server-only helpers |
| Client state | TanStack Query (server cache), Zustand (ephemeral UI + booking draft) |
| Toasts | `sonner` |
| Theming | `next-themes` (`class` strategy, system default) |
| Validation | `zod` |
| Analytics | `@vercel/analytics` — `<Analytics />` in the root layout only |
| Backend | Appwrite Cloud (`fra` region) — Users, Databases, sessions, storage |
| Auth transport | HttpOnly cookie holding an Appwrite session secret |

## Routes

| Path | Type | Purpose |
| --- | --- | --- |
| `/` | static | Landing page (marketing preview) |
| `/barbers` · `/barbers/:id` | partial | Public chair list (search + speciality filter) and barber profile |
| `/sign-in` | partial | Email OTP + Telegram sign-in |
| `/start` | partial | Role-based post-login entry point |
| `/customer` | partial | Customer dashboard |
| `/become-barber` | partial | Apply to run a chair |
| `/account` | partial | Shared account profile and settings links |
| `/book` | partial | Booking flow (service → barber → date → time) |
| `/bookings` | partial | Member visits, cancel, review |
| `/bookings/:id` | partial | Shareable booking detail, cancel, review |
| `/favorites` · `/notifications` · `/settings` | partial | Customer favorites, inbox, settings |
| `/messages` | partial | Private booking conversations |
| `/help` · `/support` · `/legal/*` | static | Help, contact, privacy and terms |
| `/mini` | static | Telegram Mini App (WebApp data → session) |
| `/agenda` | partial | Staff day view (barber / admin only) |
| `/agenda/me` | partial | Barber self-service: chair, hours, days, upcoming |
| `/barber/**` | partial | Barber business dashboard and management |
| `/admin/**` | partial | Admin platform management |
| `/admin/applications` | partial | Barber application review |
| `/robots.txt` | static | Crawler rules |
| `/sitemap.xml` | static | Public URLs |
| `POST /api/auth/email/start` | dynamic | Send the 6-digit code |
| `POST /api/auth/email/verify` | dynamic | Code → session cookie |
| `GET /api/auth/telegram/callback` | dynamic | Telegram widget redirect target |
| `POST /api/auth/telegram/mini` | dynamic | Mini App data → session cookie + website link |
| `GET /api/auth/ticket` | dynamic | One-time link → session cookie on the website |
| `POST /api/auth/logout` | dynamic | Revoke session, clear cookie |
| `GET/POST /api/telegram/webhook` | dynamic | Bot webhook health check / updates |
| `GET /api/barbers` · `GET /api/barbers/:id` | dynamic | Chair list / detail, hours, reviews |
| `GET /api/services` · `GET /api/services/:id` | dynamic | Menu |
| `GET /api/availability` | dynamic | Free start times |
| `GET/POST /api/bookings` | dynamic | My visits / staff agenda · reserve a slot |
| `GET/PATCH /api/bookings/:id` | dynamic | One booking · status changes |
| `GET/POST /api/reviews` | dynamic | Public reviews · rate a completed visit |
| `GET/PATCH /api/me` | dynamic | Profile |
| `GET/POST/PATCH/DELETE /api/admin/*` | dynamic | Staff catalogue management + review moderation + roles |
| `GET/PATCH /api/staff/*` | dynamic | Barber's own chair, hours, days, upcoming |
| `GET/POST /api/cron/reminders` | dynamic | Telegram reminder runner |

Private pages (`/account`, `/book`, `/bookings`, `/agenda`, `/admin`) are guarded twice:
`proxy.ts` returns a real `307` when the session cookie is missing, and the
page validates the session (and role, for `/agenda` and `/admin`) during render. See
[`AUTH.md`](./AUTH.md#route-protection) and [`API.md`](./API.md).

## Source map

```
app/
  layout.tsx            fonts, metadata, providers, Analytics tag, skip link
  page.tsx              landing page
  barbers/page.tsx      public chair list
  barbers/[id]/page.tsx barber profile, hours, reviews
  sign-in/page.tsx      auth screen
  account/page.tsx      profile gate
  book/page.tsx         booking gate
  bookings/page.tsx     visits gate
  bookings/[id]/page.tsx booking detail gate
  mini/page.tsx         Telegram Mini App
  agenda/page.tsx       staff gate
  agenda/me/page.tsx    barber self-service
  admin/page.tsx        admin gate
  start/page.tsx        role-based post-login entry
  customer/page.tsx     customer dashboard
  favorites/ notifications/ settings/ messages/  customer areas
  barber/**             barber business dashboard
  help/ support/ legal/  static product pages
  api/admin/**          catalogue management + role handlers
  api/staff/**          barber self-service handlers
  api/barber/**         barber business handlers
  api/favorites/**      saved chairs
  api/notifications/**  in-app inbox
  api/settings/**       customer preferences
  api/messages/**       private conversations
  api/payments/**       payment state
  api/health            readiness probe
  api/cron/reminders    protected reminder runner
  loading.tsx error.tsx global-error.tsx not-found.tsx  route UI
  robots.ts sitemap.ts  crawler files
  globals.css           design tokens, glass utilities
components/
  account/ booking/ bookings/ agenda/ admin/ staff/ telegram/  feature views (client)
  barber/ customer/ messages/               role-specific views
  auth/                 sign-in form, telegram widget, sign-out
  barbers/              public directory with search + filter
  brand/                logo
  layout/               header, footer, theme toggle
  marketing/            booking preview
  ui/                   shadcn primitives (generated, keep stock)
  providers.tsx         ThemeProvider + QueryClientProvider + Toaster
lib/
  api/                  fetch wrapper + TanStack Query hooks
  appwrite/             admin/session clients + table ids
  auth/                 cookies, session, email, telegram, user mapper, types
  client/date.ts        hydration-safe shop date hook
  domain/               types, data, availability, booking, views, time, member,
                        admin, staff, barber-business, customer, messages,
                        payments, reminders, reminder-run
  store/                zustand UI + booking draft
  env.ts                validated server env (server-only)
  http.ts rate-limit.ts JSON envelope, origin check, rate limits
docs/                   this documentation set
proxy.ts                pre-render guard for private pages (cookie presence)
scripts/setup-appwrite.mjs   creates tables, indexes and seed data
scripts/staff.mjs            promote a member / link a chair
qa-auth.mjs             end-to-end auth probe (dev only)
qa-booking.mjs          end-to-end booking probe (dev only)
qa-admin.mjs            admin / role probe (dev only)
qa-cron.mjs             reminder cron probe (dev only)
qa-marketplace.mjs      favorites, inbox, messaging, payments, barber API probe
qa-applications.mjs     barber apply → approve flow
qa-staff.mjs            barber self-service probe (dev only)
scripts/telegram-webhook.mjs  inspect / register / delete the bot webhook
scripts/telegram-miniapp.mjs  set the bot menu button to the Mini App
```

## Related docs

- [`DATA.md`](./DATA.md) — tables, keys, indexes, seed data, staff setup
- [`API.md`](./API.md) — endpoints, envelopes, status codes
- [`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md) — tokens, glass surfaces, components
- [`ENGINEERING.md`](./ENGINEERING.md) — conventions, Next 16 rules, workflow
- [`AUTH.md`](./AUTH.md) — auth architecture and provider setup

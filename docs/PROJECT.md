# icone — project map

icone is a barber booking and business management platform for Uzbekistan. One
person is one Telegram account (`tg_<telegram_id>`); there is no email, SMS,
Login Widget or separate mini app route. Production:
<https://icone-uz.vercel.app>.

## Product surfaces

1. **Customer app** — mobile-first discovery, search, map, public profiles,
   favorites and a complete, server-validated booking flow.
2. **Professional workspace** — one app that adapts to the account:
   - *Model A, independent barber:* profile, services, prices, calendar,
     customers, portfolio, hours, settings and operational statistics, with no
     team interfaces.
   - *Model B, barbershop:* business profile, employees, roles and permissions,
     invitations, branches, shared services with per-employee overrides,
     multiple calendars, CRM, analytics and operational settings.
3. **Platform admin** — separate, guarded application for users, professionals,
   businesses, applications, bookings, reviews, reports, support, reference
   data, settings and audit logs.

A single account is both customer and professional. There is no online payment,
commission, advertising, promotion or mandatory subscription. The architecture
is subscription-ready but the product works fully without billing.

## What exists

- **Domain layer** (`lib/domain/*`): accounts and capabilities, professionals,
  businesses, branches, memberships/invites, catalog, schedules, availability,
  booking, appointments/CRM, discovery, reviews, notifications, Telegram
  reminders, waitlist, onboarding applications, stats and admin operations.
- **Auth:** one-tap phone sharing from web or Telegram; a 4-digit code from the
  bot, verified where it was requested. An HttpOnly cookie holds the request id;
  the code lives briefly in an `otp_<nonce>` user's prefs. Inside the Telegram
  Mini App, signed `initData` signs the member in on any page.
- **Notifications:** Telegram login/notification infrastructure is preserved;
  booking, reminder, waitlist, application and team-invite messages use it.
- **Reminders:** `/api/cron/reminders`, called daily at 06:00 UTC by
  `.github/workflows/reminders.yml` with `CRON_SECRET`. Idempotent.

## Canonical routes and redirects

Old bookmarks and deep links keep working; new links always use one destination.

| Surface | Canonical | Legacy compatibility |
| --- | --- | --- |
| Account home | `/account` | `/customer` redirects there (query string preserved) |
| Profile settings | `/settings` | the only editable profile form |
| Inbox | `/notifications` | `/barber/notifications` redirects there (query preserved) |
| Shareable profile/booking link | `/b/<slug>` | `/barbers/<slug>` and `/shop/<slug>` still resolve |
| All discovery results | `/map?q=…` | no query opens the full map |
| Professional application | `/become-barber` | Model A default, Model B is one explicit option |

`/account` is a summary — name, role, sign-in method and links to visits,
saved, messages and settings. It does not repeat the settings form or booking
stats. The one "Become a barber" entry lives in the shared navigation and the
landing page; the model choice appears once, inside the application form.

## Navigation

`lib/navigation.ts` is the single source of truth for links. `primaryLinks` are
the desktop bar; `navSections` drive the desktop menu, the mobile "More" sheet
and the footer, so all three expose the same destinations (discovery,
professionals, help/waitlist, legal and the Telegram bot). Labels are
dictionary keys, never hard-coded copy. `isWorkspacePath()` hides the
marketplace links and the global Book button inside `/barber`, `/agenda`,
`/admin` and `/b`; public and customer pages keep them.

The mobile bottom bar keeps five primary tabs plus "More"; there is no separate
mini-app navigation. Clients see discovery, Book, Saved and Account. A
professional (`useMe().professional`) sees Calendar, Bookings, Clients and
Services instead. The professional workspace itself uses `BarberShell`: its
pills run Calendar, Appointments, Services, Clients, Settings, then Team and
Branches for business owners and Analytics for owners or independents with
`analytics.read`. The calendar is the professional home (`homeForRole`).

Profiles share one canonical booking link, `/b/<slug>`: a business slug opens
the "any qualified employee" booking draft, a professional slug opens that
chair's draft. `lib/domain/booking-link.ts` resolves both; public profile pages
use `/b/<slug>` as the primary Book action and keep per-service or per-barber
links as secondary.

Header search, the landing hero and `/barbers` all use the one query/result
component in `components/search/search-results.tsx`: result rows link to
`/b/<slug>`, and "all results" links to `/map?q=…`. `LandingSearch` only adds
landing copy; it owns no query, query key or result renderer of its own.

## Source map

| Area | Files |
| --- | --- |
| App routes | `app/` |
| Shared UI | `components/ui/` (stock), `components/` (app-specific) |
| Server data | `lib/domain/` — all Appwrite access goes through here |
| Client queries/state | `lib/api/`, `lib/store/` |
| Authorization | `lib/domain/access.ts`, `lib/api/guard.ts` |
| Auth | `lib/auth/`, `app/api/auth/`, `lib/domain/account.ts` |
| Translations | `lib/i18n/locales/*.ts` (copy), `lib/i18n/dictionaries.ts` (server map), `lib/i18n/translate.ts` (runtime), `components/i18n/t.tsx` |
| Schema setup | `scripts/setup-appwrite.mjs` |
| Telegram scripts | `scripts/telegram-*.mjs` |

## Metadata and language

Static metadata is resolved at build time and cannot see the visitor's stored
locale, so `lib/metadata.ts` and the root layout always use the Uzbek
dictionary. Page bodies switch language at runtime through `<T>`/`useT()`.
The browser bundle only contains the default locale; Russian and English load
as separate chunks on demand.

## Done means

`cmd /c "npm run typecheck"`, `cmd /c "npm run check:i18n"`,
`cmd /c "npm run lint"` and `cmd /c "npm run build"` all pass; light and dark
are checked; 390px is checked; every major workflow works end to end with real
data; no secrets or throwaway data remain; no decorative buttons or invented
analytics.

## Fresha stage 3 — business-root defaults (additive)

The professional workspace now treats the **business**, not the chair, as its
default root. `lib/domain/access.ts` exposes one stable resolver,
`activeBusiness(actor)` → `{ id, name, branch? }` (owned business, then
owner/manager membership, then first membership, each tier explicitly sorted),
plus the id-only helper `activeBusinessId(actor)`. `getActor().summary.active`
carries the resolved root. Owners and managers see a compact `BusinessSwitcher`
in the workspace header; its choice is stored only in plain
`icone_business` / `icone_branch` cookies and never mutates server data or
authorization.

Employee services are now read from `offers` first with the legacy
`services`/`empser` calculation as fallback; write paths materialise the offer
before mirroring to `empser`. Response shapes are unchanged. `scripts/migrate.mjs`
gains a read-only business-root report (businesses without an active owner
membership; barber rows whose business/branch disagrees with memberships). No
historical row is rewritten or deleted. See `docs/DATA.md` for the full rule.

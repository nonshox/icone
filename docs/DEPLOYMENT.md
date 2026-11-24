# icone — production deployment

## Target

- App: <https://icone-uz.vercel.app> (Vercel, Next.js 16 App Router)
- Data: Appwrite Cloud (`fra`), project `icone`, database `database`, bucket `bucket`
- Bot: `@icone_app_bot` — Login Widget removed; Mini App + webhook + reminders
- Cron: `vercel.json` → `GET /api/cron/reminders` daily at 06:00 UTC

## One-time setup

1. `npm install`
2. `copy .env.example .env` and fill every key (see below). `.env` is gitignored.
3. In Appwrite → **API Keys**, give the server key these scopes:
   `databases.read/write`, `collections.read/write`, `attributes.read/write`,
   `indexes.read/write`, `documents.read/write`, `users.read/write`,
   `files.read/write`.
4. `npm run db:setup` — creates all 18 tables, attributes, indexes, seed data.
   Idempotent; safe after a partial failure.
5. `npm run db:staff -- <email> barber <barberId>` to link staff accounts.
6. `npm run tg:webhook -- set` and `npm run tg:miniapp -- set`.
7. `@BotFather` → Bot Settings → Menu Button → `https://icone-uz.vercel.app/mini`
   (the Bot API call sets it, but some accounts need the manual confirmation).

## Environment

`.env.example` is the contract — both local `.env` and Vercel must define the
same keys.

| Key | Scope | Production value |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | public | `https://icone-uz.vercel.app` |
| `NEXT_PUBLIC_APP_VERSION` | public | release label |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | public | `https://fra.cloud.appwrite.io/v1` |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | public | `icone` |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | public | `icone_app_bot` |
| `APPWRITE_ENDPOINT` | server | same endpoint |
| `APPWRITE_PROJECT_ID` | server | `icone` |
| `APPWRITE_API_KEY` | **secret** | server API key with scopes above |
| `APPWRITE_DATABASE_ID` | server | `database` |
| `APPWRITE_BUCKET_ID` | server | `bucket` |
| `TELEGRAM_BOT_TOKEN` | **secret** | from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | **secret** | random ≥16 chars |
| `CRON_SECRET` | **secret** | **same value** as `TELEGRAM_WEBHOOK_SECRET` |

Set every server/secret key in **Vercel → Project → Settings → Environment
Variables** for Production (and Preview if preview bots are used). Never commit
`.env`.

## Deploy

```powershell
cmd /c "npm run build"   # gate: TypeScript + production build
cmd /c "npm run lint"    # must be clean
git push origin main     # Vercel builds and deploys
```

After deploy:

- `GET /api/health` → `200` with `checks.config/auth/database = true`
- `GET /robots.txt`, `/sitemap.xml`, `/manifest.webmanifest` → `200`
- `npm run tg:webhook` → no `last_error`
- `node qa-auth.mjs`, `qa-booking.mjs`, `qa-admin.mjs`, `qa-staff.mjs`, `qa-cron.mjs`
  against the deployed URL by setting `NEXT_PUBLIC_APP_URL` in the shell.

## Operations

- **Health:** `/api/health` checks config, Users and Databases. Wire it to
  Vercel monitoring / an external uptime probe.
- **Analytics:** Vercel Analytics is a single `<Analytics />` in `app/layout.tsx`.
- **Logs:** route handlers log with `[auth]`, `[api]`, `[admin]`, `[staff]`,
  `[reminders]`, `[cron]` prefixes. Never log secrets, tokens or login links.
- **Backups:** export the Appwrite `database` collection set on a schedule from
  the Appwrite console (or via the server API). Keep at least 7 daily copies.
- **Cron:** the reminder runner is idempotent (unique `booking`, `state`,
  three-send retry cap). Re-running it never double-sends.
- **Rollback:** redeploy the previous successful Vercel deployment; schema
  changes are additive and `db:setup` never deletes data.

## Security checklist

- Secrets server-only; no `NEXT_PUBLIC_` on API keys or tokens.
- HttpOnly, SameSite=Lax, Secure session cookie; no client SDK sessions.
- Every mutation checks origin, role and resource ownership.
- Zod validation on every request body; human errors through the JSON envelope.
- Rate limits on auth, booking, review, admin and messaging mutations.
- Telegram webhook and cron use constant-time secret comparison.
- Private notes never appear in customer APIs; conversations are participant-only.
- Payment status is never shown as paid unless the stored status is `paid`.

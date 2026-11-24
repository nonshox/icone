# icone — engineering conventions

## Ground rules

1. **Server first.** Secrets never reach the browser. Appwrite is driven from
   route handlers and server components with the API key; the browser only ever
   holds an HttpOnly session cookie.
2. **Small surface.** No abstraction until a second caller exists. Prefer a
   plain function in `lib/` over a provider, context or service class.
3. **Type safety is not optional.** `npm run build` must pass TypeScript; no
   `any`, no `@ts-expect-error` without a comment explaining why.
4. **Don't guess Next.js.** This repo runs Next.js 16 with Cache Components and
   Partial Prefetching. Read `node_modules/next/dist/docs/` before using an API
   you are not certain about.
5. **Keep `components/ui` stock.** It is shadcn output. Wrap or style from the
   outside.

## Next.js 16 specifics

### Cache Components is on

`next.config.ts` enables `cacheComponents`. Consequences:

- Any dynamic read (`cookies()`, `headers()`, `searchParams`, `connection()`)
  must happen **inside a `<Suspense>` boundary**, otherwise `next build` fails
  with "unstable value while prerendering".
- Never call `new Date()`, `Date.now()` or `Math.random()` during render of a
  static page. The footer year is a module constant for this reason.
- Pages that read the session are wrapped: the page shell is static, and an
  inner `async` component (e.g. `AccountPanel`, `RedirectIfSignedIn`) does the
  cookie read behind `<Suspense fallback={...}>`.
- Always give that boundary a real skeleton — it is what users see on first
  paint.

### Route handlers

- Route handlers are dynamic by default; no config needed.
- **Do not export `runtime`.** `export const runtime = "nodejs"` is rejected
  when Cache Components is enabled.
- Type the handler argument as `NextRequest` when you need `request.cookies`.
- Import `NextRequest`/`NextResponse` from `next/server`.

### Rendering rules

- Server components by default. Add `"use client"` only for state, effects,
  browser APIs or event handlers.
- Never import a `"use client"` module into a server-only file just to reuse a
  constant — put shared constants in `lib/`.
- `import "server-only"` at the top of every module that touches the API key.

### Proxy

- The file is `proxy.ts` at the repo root (`middleware.ts` is deprecated).
- It runs on the Node runtime and **before** rendering, so it must stay
  dependency-free: no Appwrite SDK, no `server-only` modules, no DB calls.
- Use it only for cheap pre-render decisions (cookie presence, locale,
  redirects). Authorization belongs in the page or route handler.
- Always set a `matcher`; without one the proxy runs on every asset request.
- Current matcher covers `/account`, `/book`, `/bookings` and `/agenda`
  (both exact paths and `:path*` children).
- Vercel Analytics is a single `<Analytics />` tag in the root layout. Do not
  add client instrumentation or duplicate it in feature pages.

## Data flow

```
browser ──fetch──▶ route handler ──▶ lib/auth/* ──▶ Appwrite (API key)
                        │
                        └──▶ Set-Cookie: icone_session (HttpOnly)
browser ──request──▶ server component ──▶ getCurrentUser() ──▶ Appwrite (session)
```

- `lib/auth/session.ts` exposes `getCurrentUser()` (cached per render) and
  `requireUser(returnTo)` (redirects to `/sign-in?next=…`).
- `lib/domain/*` is the only place that reads or writes Appwrite documents.
  It is server-only and shared by route handlers and server components.
- Session failures are treated as signed out, never as errors.
- The UI receives `SessionUser` — a narrow DTO from `lib/auth/user.ts`. Never
  pass a raw Appwrite user or database document to a component.

## State management

- **TanStack Query** owns all server data in the browser. Hooks live in
  `lib/api/queries.ts`; the fetch wrapper is `lib/api/client.ts`.
- One query key per resource, invalidated by the mutations that change it.
  Never copy a fetched booking into React state and edit it — mutate through
  the API and let the cache refresh.
- **Zustand** is for ephemeral state only: `lib/store/ui.ts` (mobile nav) and
  `lib/store/booking.ts` (booking draft). It must never hold server data.
- Never initialise client state from the clock during render. Use
  `useShopDate()` from `lib/client/date.ts`, which uses `useSyncExternalStore`
  with an empty server snapshot.

## Domain conventions

- Table and key names are one word, lowercase. See [`DATA.md`](./DATA.md).
- Route handlers never query Appwrite directly — they call `lib/domain/*`.
- Dates are `YYYY-MM-DD`, times are minutes from midnight, timezone is
  `Asia/Tashkent`, prices are integer UZS.
- Re-check availability inside the write path. Two callers can pass the read
  check at once; the oldest overlapping booking wins.

## API conventions

Every JSON route uses the envelope in `lib/http.ts`:

```jsonc
// success
{ "ok": true, ...payload }
// failure
{ "ok": false, "error": { "message": "Human sentence.", "code": "snake_code" } }
```

- Status codes: 400 validation, 401/403 auth/origin, 429 rate limit, 502
  upstream failure.
- Every mutating handler calls `isSameOrigin(request)`.
- Every handler that costs money or sends mail is rate limited via
  `rateLimit(key, limit, windowMs)`; keys are namespaced
  (`email:start:ip:…`, `email:verify:user:…`).
- Error messages are written for humans, never leak provider detail.
- Log server-side with a `[auth]` prefix; never log secrets or codes.

## Client conventions

- Pages are server components; they gate access and render a client view behind
  `<Suspense>`. Keep page shells static.
- Route-handler responses are consumed through the TanStack hooks, never raw
  `fetch` inside a component (except auth forms, which post directly).
- shadcn components stay stock in `components/ui`; style from the outside.
  New screens use plain `Card`, `Button`, `Input`, `Select`, `Table` and `Badge`.
- Pending state lives on the button. Errors are toasts, repeated validation
  errors are inline `role="alert"` blocks.
- The four feature views (`account`, `booking`, `bookings`, `agenda`) are the
  only heavy client components. Keep new ones equally thin.

## Naming

| Kind | Convention | Example |
| --- | --- | --- |
| Files | kebab-case | `sign-in-form.tsx` |
| Components | PascalCase, named export | `export function SignInForm` |
| Hooks | `use*` | `useUIStore` |
| Route handlers | HTTP verb exports | `export async function POST` |
| Env | SCREAMING_SNAKE | `APPWRITE_API_KEY` |
| Cookies | `icone_*` | `icone_session` |

## Commands

`npm` on this machine must be invoked through `cmd`, because the PowerShell
wrapper is blocked:

```powershell
cmd /c "npm run dev"
cmd /c "npm run build"
cmd /c "npm run lint"
cmd /c "npm run db:setup"   # create Appwrite tables + seed data
cmd /c "npm run db:staff"   # promote a member / link a chair
cmd /c "npm run qa:auth"    # end-to-end auth probe (dev server required)
cmd /c "npm run qa:booking" # booking probe (needs DB scopes)
cmd /c "npm run qa:admin"   # admin role + CRUD probe
cmd /c "npm run qa:cron"    # reminder cron probe
cmd /c "npm run qa:staff"   # barber self-service probe
```

Production URL: <https://icone-uz.vercel.app>. `.env.production` holds only
public values; Vercel secrets are set in the project dashboard.

`npm run build` is the gate: it runs TypeScript and the production build.
`npm run lint` must be clean before calling a task done.

## Definition of done

- `npm run build` passes with no type errors.
- `npm run lint` is clean.
- New server modules start with `import "server-only"` if they touch secrets.
- Any new dynamic read sits behind `<Suspense>`.
- New API routes follow [`API.md`](./API.md); new tables follow [`DATA.md`](./DATA.md).
- Light and dark both checked; mobile width (390px) checked.
- Docs updated when a convention, route or token changes.

# Design system

Tokens live in `app/globals.css`. Use them instead of raw colours or radii.

- `--background`, `--foreground`, `--card` — surfaces, including translucent
  glass cards (`bg-card/…` with backdrop blur).
- `--brand`, `--brand-foreground`, `--brand-strong`, `--brand-glow` — the only
  accent path. `--radius-*` controls corner softness.
- Light and dark themes are both real; check every change in both.
- Tailwind v4 is compiled through `@tailwindcss/turbopack` in `next.config.ts`.

## Components

`components/ui/` is stock shadcn-style building blocks. Keep it unchanged;
style from the outside with `className`. App-specific composition lives in
`components/` (for example `components/booking/`, `components/bookings/`).

## Copy voice

Short, warm, specific. Avoid marketing filler and long explanations. Uzbek is
default; Russian and English are available from the header switcher. Add every
static string to `lib/i18n/dictionaries.ts` for all three locales and render it
with `<T k="…" />` (or `t("…")` for attributes, placeholders and toasts).
Database content — names, notes, reviews — stays as entered.

## Layout

The shared menu comes from `lib/navigation.ts`; the breadcrumb is folded into
the navbar. A 390px viewport must remain usable with the fixed mobile bottom
navigation.

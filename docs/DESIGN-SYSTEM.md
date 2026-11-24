# icone — design system

The look is **warm minimalism under glass**: a paper-like light theme, a
charcoal dark theme, one brass accent, and frosted panels that float over a
softly lit background. Everything else stays quiet.

## Tokens

All colour lives in `app/globals.css` as OKLCH custom properties, exposed to
Tailwind through `@theme inline`. Never hard-code a hex value in a component —
add or reuse a token.

### Core surfaces

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--background` | warm paper | warm charcoal | page |
| `--foreground` | warm ink | off-white | text |
| `--card` | translucent white | translucent charcoal | panels |
| `--muted-foreground` | 0.505 L | 0.71 L | secondary text |
| `--border` | ink @ 11% | white @ 10% | hairlines |
| `--ring` | brass @ 55% | brass @ 55% | focus ring |

### Brand

| Token | Meaning |
| --- | --- |
| `--brand` | brass accent (fills, dots, glows) |
| `--brand-strong` | brass dark enough for small text on paper |
| `--brand-foreground` | ink that sits on a brass fill |
| `--brand-glow` / `--cool-glow` | ambient radial light in `body` |

Use `text-brand-strong` for eyebrow labels and inline icon accents, `bg-brand`
for dots and indicators, `bg-brand/10..15` for tinted chips.

### Glass

| Utility | What it does |
| --- | --- |
| `.glass` | 12px blur, 1px hairline. The default panel. |
| `.glass-soft` | 8px blur, no shadow. Use for chips, secondary buttons, nav pills. |
| `.hairline` | border only, for nested dividers. |
| `.brand-glow` | brass ring + coloured shadow for the one primary element on a screen. |
| `.text-gradient-brand` | brass gradient clipped to text. Headline accents only. |

**Rule of glass:** at most **two** glass layers visible at once (page panel +
one floating chip). Backdrop blur is expensive — never put `.glass` on a long
list row. Looping float animations and the full-page ambient gradient were
removed in the performance pass.

### Radii and type

- Base radius `0.75rem`; panels use `rounded-3xl` / `rounded-[2rem]`, controls
  `rounded-xl`, pills `rounded-full`.
- `--font-sans` = Geist. `--font-mono` = Geist Mono. `--font-display` =
  Instrument Serif — **italic only, for one or two words per page**.
- Display accent pattern:
  `<span className="font-display text-[1.08em] italic">word</span>`
- Headline tracking is tight: `tracking-[-0.04em]`; body text stays default.
- Numerals in prices, times and counters get `tabular-nums`.

## Layout

- Content width `max-w-6xl` (72rem) with `px-6`. Auth screen goes wider
  (`max-w-7xl`, two columns at `lg`).
- Vertical rhythm: section padding `pt-20 sm:pt-28`; inner card padding
  `p-6 sm:p-8`.
- Header is a floating glass bar: `sticky top-0`, inset `px-3 pt-3`, inner
  `h-14 rounded-2xl`. The breadcrumb beneath it uses the same `.glass` surface
  and `rounded-2xl` at `h-12`, aligned to the same `max-w-6xl` edges. Back and
  home are icon-only buttons on every viewport; path labels appear from `sm` up.
- One brand mark is used everywhere: the sparkle app icon in
  `public/logotype/`. Render it in the UI with `next/image` and explicit width
  and height (use `android-chrome-192x192.png`); use the size-specific PNGs for
  favicon (`favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`) and
  PWA manifest (`android-chrome-192x192.png`, `android-chrome-512x512.png`).
  Do not redraw the mark with text, a dot, or a separate SVG icon route.
- Mobile first. Anything two-column collapses to one below `lg`. Tap targets
  are at least 36px; primary buttons are `h-11`/`h-12`.

## Components

shadcn primitives live in `components/ui` and are **generated** — treat them as
vendor code. Extend with `className`, don't fork.

| Need | Use |
| --- | --- |
| Action | `Button` (`variant`: default / outline / ghost / secondary / destructive) |
| Link styled as a button | `buttonVariants({ size })` + `cn()` |
| Text field | `Input` + `Label` |
| Panel | `.glass` div or `Card` when you need header/content/footer slots |
| Divider | `Separator` |
| Status | `Badge` or a hand-rolled pill |
| Loading block | `Skeleton` or `animate-pulse` on a glass block |
| Feedback | `toast` from `sonner` (Toaster mounted in `providers.tsx`) |

Default shadcn heights are compact (`h-8`). Auth and marketing CTAs must pass
an explicit `h-11` / `h-12`.

## Motion

- Entrances: `animate-in fade-in-0 slide-in-from-bottom-1 duration-200`.
- Hover on cards: `transition-transform hover:-translate-y-1` — never scale.
- No looping animations — the decorative float utilities were removed.
- `prefers-reduced-motion` is globally neutralised in `globals.css`; don't
  re-introduce motion with inline styles.

## Accessibility

- Every icon-only button needs `aria-label`.
- Decorative icons get `aria-hidden`.
- Errors render in a `role="alert" aria-live="polite"` block, not only a toast.
- Focus is visible via `--ring`; `:focus-visible` removes only the default
  outline, so components must supply a ring (`focus-visible:ring-*`).
- Colour is never the only signal — pair it with an icon or label.
- Text contrast: `--muted-foreground` on `--background` is the floor. Brass
  text uses `--brand-strong`, never `--brand`.

## Copy

- Sentence case for headings and buttons ("Book a chair", not "Book A Chair").
- Eyebrow labels are uppercase, `text-xs`, `tracking-[0.18em]`.
- Never say "user" in UI copy — say "member", "you", or the person's name.
- No exclamation marks. No emoji in product UI.

# Design system

`app/globals.css` is the single source of truth. Never hardcode a colour,
radius or shadow in a component: use the tokens exposed through Tailwind.

## Tokens

- Surfaces: `background`, `card`, `popover`, `muted`.
- Text: `foreground`, `card-foreground`, `muted-foreground`.
- Controls: `primary`, `secondary`, `accent`, `destructive`, `border`, `input`,
  `ring`.
- Brand: `brand`, `brand-foreground`, `brand-strong`, `brand-glow`.
- Charts: `chart-1` … `chart-5`; sidebar tokens mirror the control palette.

Both light and dark themes are defined in the same file. Check every screen in
both, and at 390px width.

## Component rules

- `components/ui/` is stock shadcn UI. Style from the outside; do not edit the
  generated primitives to add product-specific behaviour.
- Product components live in `components/<area>/` and compose the primitives.
- Every data view has an explicit loading skeleton, an empty state, an error
  state and success feedback. Sensitive screens also have a permission state.
- Forms use consistent labels, helper text, inline errors and a single primary
  action. Destructive actions require confirmation.
- Customer screens are mobile-first; the professional workspace and admin are
  desktop-optimised but stay usable on a tablet and a 390px phone.

## Copy and language

Uzbek is the default; Russian and English are available from the header
switcher. Static strings go into `lib/i18n/dictionaries.ts` for all three
languages and are rendered with `<T k="..." />` or `useT()`. Prices use UZS
formatting, phones use +998, dates and times use Asia/Tashkent and come from
`lib/domain/time.ts` or `lib/client/date.ts` — never from `new Date()` during
render of a static page.

## Maps and media

The map uses OpenStreetMap raster tiles (full Uzbekistan coverage, no API key)
with coordinates that come only from real profiles. Uploads are limited,
validated as images, and go through `lib/domain/upload.ts` to Appwrite Storage.

import Link from "next/link";

import { Logo } from "@/components/brand/logo";

const linkClass =
  "text-sm text-muted-foreground transition-colors hover:text-foreground";

// Kept as a constant so prerendered pages never read the clock. Bump yearly.
const CURRENT_YEAR = 2026;

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xs space-y-3">
          <Logo />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Sharp cuts, calm chairs, zero queues. Tashkent&apos;s barbershop for
            people who book ahead.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-12 gap-y-2 sm:gap-x-16">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-wider text-foreground/60 uppercase">
              Explore
            </span>
            <Link href="/#services" className={linkClass}>
              Services
            </Link>
            <Link href="/book" className={linkClass}>
              Book a chair
            </Link>
            <Link href="/bookings" className={linkClass}>
              My visits
            </Link>
            <Link href="/account" className={linkClass}>
              Account
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-wider text-foreground/60 uppercase">
              Elsewhere
            </span>
            <a
              href="https://t.me/icone_app_bot?start=signin"
              target="_blank"
              rel="noreferrer noopener"
              className={linkClass}
            >
              Telegram bot
            </a>
            <a href="mailto:hello@icone.uz" className={linkClass}>
              hello@icone.uz
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 border-t border-border/60 px-6 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {CURRENT_YEAR} icone. All rights reserved.</p>
        <p>Made with care in Tashkent.</p>
      </div>
    </footer>
  );
}

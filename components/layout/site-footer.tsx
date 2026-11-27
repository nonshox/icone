"use client";

import Link from "next/link";

import { T } from "@/components/i18n/t";
import { Logo } from "@/components/brand/logo";
import { useMe } from "@/lib/api/queries";
import { useT } from "@/lib/i18n/use-t";
import { becomeBarberCta, visibleNavSections, type NavLink } from "@/lib/navigation";

// Kept as a constant so prerendered pages never read the clock. Bump yearly.
const CURRENT_YEAR = 2026;

function FooterLink({ link }: { link: NavLink }) {
  const className =
    "rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
        <T k={link.label} />
      </a>
    );
  }

  return (
    <Link href={link.href} className={className}>
      <T k={link.label} />
    </Link>
  );
}

export function SiteFooter() {
  const t = useT();
  const me = useMe();
  const professional = Boolean(me.data?.professional);
  const admin = me.data?.profile.role === "admin";
  const sections = visibleNavSections({ professional, admin });
  const showCta = !me.isPending && !professional && !admin;

  return (
    <footer className="mt-24 border-t border-border/70">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <div className="max-w-xs space-y-3">
            <Logo />
            <p className="text-sm leading-relaxed text-muted-foreground">
              <T k="footer.tag" />
            </p>
          </div>

          {sections.map((section) => {
            const headingId = `footer-${section.title.replace(/\./g, "-")}`;
            return (
              <section key={section.title} aria-labelledby={headingId}>
                <h2
                  id={headingId}
                  className="mb-3 text-[0.65rem] font-medium tracking-[0.14em] text-brand-strong uppercase"
                >
                  <T k={section.title} />
                </h2>
                <ul className="space-y-2.5">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <FooterLink link={link} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border/70 pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {CURRENT_YEAR} icone</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {showCta ? (
              <Link
                href={becomeBarberCta.href}
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {t(becomeBarberCta.label)}
              </Link>
            ) : null}
            {professional ? (
              <Link href="/barber" className="hover:text-foreground">
                {t("nav.workspace")}
              </Link>
            ) : null}
            <p><T k="landing.telegramOnly" /></p>
          </div>
        </div>
      </div>
    </footer>
  );
}

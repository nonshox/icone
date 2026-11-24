import { T } from "@/components/i18n/t";
import { Logo } from "@/components/brand/logo";

// Kept as a constant so prerendered pages never read the clock. Bump yearly.
const CURRENT_YEAR = 2026;

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <p>
            <T k="footer.tag" />
          </p>
        </div>
        <p className="text-xs">© {CURRENT_YEAR} icone</p>
      </div>
    </footer>
  );
}

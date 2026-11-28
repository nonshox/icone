"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";

/**
 * Shared app surfaces live in `components/ui`. Re-exported here so every
 * professional screen uses the same implementation.
 */
export {
  EmptyState,
  EmptyState as Empty,
  ErrorState,
  FormError,
  LoadingRows,
  message,
} from "@/components/ui/app-state";
export { StatusBadge } from "@/components/ui/status-badge";

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  id,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2 text-sm">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-0.5"
      />
      <div className="space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer font-medium">
          {label}
        </Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

const pillClass =
  "inline-flex items-center rounded-xl border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-brand/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Client-side pills for the professional shell: the server resolves the
 * capability-scoped links, the browser marks the current one.
 */
export function NavPills({
  links,
  labelKey,
}: {
  links: ReadonlyArray<{ href: string; label: string }>;
  labelKey: string;
}) {
  const pathname = usePathname();
  const t = useT();
  const active = links
    .filter(
      (link) =>
        pathname === link.href || pathname.startsWith(`${link.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav
      aria-label={t(labelKey)}
      className="flex flex-wrap gap-2 border-b border-border pb-4"
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={active === link.href ? "page" : undefined}
          className={cn(
            pillClass,
            active === link.href &&
              "border-brand/50 bg-brand/10 text-foreground",
          )}
        >
          {t(link.label)}
        </Link>
      ))}
    </nav>
  );
}

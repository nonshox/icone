import Link from "next/link";

import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="icone — home"
      className={cn(
        "group inline-flex items-baseline gap-1.5 text-foreground",
        className,
      )}
    >
      <span className="text-[1.32rem] leading-none font-semibold tracking-[-0.055em]">
        icone
      </span>
      <span
        aria-hidden
        className="mb-[0.15em] size-1.5 rounded-full bg-brand shadow-[0_0_12px_-2px_var(--brand)] transition-transform duration-300 group-hover:-translate-y-0.5"
      />
    </Link>
  );
}

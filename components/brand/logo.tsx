import Image from "next/image";
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
      className={cn("inline-flex items-center", className)}
    >
      <Image
        src="/logotype/android-chrome-192x192.png"
        alt="icone"
        width={192}
        height={192}
        priority
        className="size-9 rounded-lg ring-1 ring-border/70 transition-opacity duration-300 hover:opacity-80"
      />
    </Link>
  );
}

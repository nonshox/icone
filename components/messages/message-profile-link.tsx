import { MessageCircle } from "lucide-react";
import Link from "next/link";

import { T } from "@/components/i18n/t";
import { buttonVariants } from "@/components/ui/button";
import { getActor } from "@/lib/domain/access";
import { cn } from "@/lib/utils";

/**
 * Public-profile CTA. A signed-in member opens (or resumes) a thread with the
 * professional; a guest is sent through sign-in with the same deep link.
 * Rendering happens inside the profile's Suspense boundary because it reads
 * the session.
 */
export async function MessageProfileLink({
  barber,
  user,
  compact = false,
}: {
  barber: string;
  user: string;
  compact?: boolean;
}) {
  const actor = await getActor();
  if (!user || actor?.userId === user || actor?.profile.role === "admin") {
    return null;
  }

  const target = `/messages?barber=${encodeURIComponent(barber)}`;
  const href = actor ? target : `/sign-in?next=${encodeURIComponent(target)}`;

  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "h-9 rounded-xl",
        compact && "h-auto rounded-lg px-2 py-1 text-xs",
      )}
    >
      <MessageCircle className="size-3.5" aria-hidden />
      <T k={actor ? "msg.messageBarber" : "msg.signInToMessage"} />
    </Link>
  );
}

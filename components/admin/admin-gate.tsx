import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getActor } from "@/lib/domain/access";

/**
 * Server-side role gate. Callers render this inside a Suspense boundary because
 * resolving the actor reads the session cookie.
 */
export async function AdminGate({ children }: { children: ReactNode }) {
  const actor = await getActor();

  if (!actor) {
    redirect(`/sign-in?next=${encodeURIComponent("/admin")}`);
  }

  if (actor.profile.role !== "admin") {
    redirect("/account");
  }

  return <>{children}</>;
}

import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { currentMember } from "@/lib/domain/member";

/**
 * Server-side role gate. Callers render this inside a Suspense boundary because
 * reading the session touches cookies.
 */
export async function AdminGate({ children }: { children: ReactNode }) {
  const member = await currentMember();

  if (!member) {
    redirect(`/sign-in?next=${encodeURIComponent("/admin")}`);
  }

  if (member.profile.role !== "admin") {
    redirect("/account");
  }

  return <>{children}</>;
}

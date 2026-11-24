import { redirect } from "next/navigation";
import { Suspense } from "react";

import { homeForRole } from "@/lib/auth/home";
import { currentMember } from "@/lib/domain/member";

export const metadata = { title: "Redirecting" };

async function RoleHome() {
  const member = await currentMember();

  if (!member) {
    redirect(`/sign-in?next=${encodeURIComponent("/start")}`);
  }

  redirect(homeForRole(member.profile.role));
  return null;
}

export default function StartPage() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center">
      <p className="text-sm text-muted-foreground">Opening your account…</p>
      <Suspense fallback={null}>
        <RoleHome />
      </Suspense>
    </main>
  );
}

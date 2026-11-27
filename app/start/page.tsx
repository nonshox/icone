import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getCurrentUser } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/home";
import { getProfile } from "@/lib/domain/account";

export const metadata = { title: "Redirecting" };

async function RoleHome() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent("/start")}`);
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    redirect(`/sign-in?next=${encodeURIComponent("/start")}`);
  }

  redirect(homeForRole(profile.role));
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

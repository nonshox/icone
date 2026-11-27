import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AccountView } from "@/components/account/account-view";
import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getActor } from "@/lib/domain/access";
import { getProfile } from "@/lib/domain/account";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

async function AccountPanel() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent("/account")}`);
  }

  // The membership flag comes from the actor, not from the role label: an
  // approved barber is still a "client" in the profile. Fall back to the plain
  // profile so an existing account never loses its account page.
  const actor = await getActor();
  const profile = actor?.profile ?? (await getProfile(user.id));
  if (!profile) {
    redirect(`/sign-in?next=${encodeURIComponent("/account")}`);
  }

  return (
    <AccountView
      user={user}
      profile={profile}
      professional={actor?.summary.professional ?? false}
    />
  );
}

function AccountSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]" aria-hidden>
      <div className="h-80 animate-pulse rounded-xl bg-muted" />
      <div className="h-80 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export default function AccountPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-6 pt-10 pb-10">
          <div className="mb-6 flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              <T k="account.goodToSee" />
            </h1>
          </div>

          <Suspense fallback={<AccountSkeleton />}>
            <AccountPanel />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

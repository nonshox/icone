import { Suspense } from "react";

import { Invitations } from "@/components/team/invitations";

export const metadata = {
  title: "Invitations — icone",
  description: "Team invitations for your account.",
};

export default function InvitesPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Team invitations</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Join a barbershop with your own account. Credentials are never shared.
      </p>
      <div className="mt-6">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-muted" />}>
          <Invitations />
        </Suspense>
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { Suspense } from "react";

import { T } from "@/components/i18n/t";
import { Invitations } from "@/components/team/invitations";
import { getActor } from "@/lib/domain/access";

async function InvitesGate() {
  const actor = await getActor();
  if (!actor) redirect(`/sign-in?next=${encodeURIComponent("/invites")}`);
  return <Invitations />;
}

export const metadata = {
  title: "Invitations — icone",
  description: "Team invitations for your account.",
};

export default function InvitesPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        <T k="invites.title" />
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        <T k="invites.subtitle" />
      </p>
      <div className="mt-6">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-muted" />}>
          <InvitesGate />
        </Suspense>
      </div>
    </main>
  );
}

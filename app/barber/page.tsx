import type { Metadata } from "next";

import { BarberDashboard } from "@/components/barber/barber-dashboard";
import { BarberShell } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";
import { WaitlistManager } from "@/components/team/waitlist-manager";

export const metadata: Metadata = {
  title: "Your business",
  robots: { index: false, follow: false },
};

export default function BarberPage() {
  return (
    <BarberShell
      title={<T k="nav.account" />}
      description={<T k="work.dashboard.quickHint" />}
    >
      <BarberDashboard />
      <WaitlistManager />
    </BarberShell>
  );
}

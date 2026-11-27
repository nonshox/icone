import type { Metadata } from "next";

import { BarberNotifications } from "@/components/barber/barber-notifications";
import { BarberShell } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";

export const metadata: Metadata = {
  title: "Inbox",
  robots: { index: false, follow: false },
};

export default function BarberNotificationsPage() {
  return (
    <BarberShell
      title={<T k="nav.inbox" />}
      description={<T k="work.dashboard.quickHint" />}
    >
      <BarberNotifications />
    </BarberShell>
  );
}

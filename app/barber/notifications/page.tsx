import type { Metadata } from "next";

import { BarberNotifications } from "@/components/barber/barber-notifications";
import { BarberShell } from "@/components/barber/barber-shell";

export const metadata: Metadata = {
  title: "Inbox",
  robots: { index: false, follow: false },
};

export default function BarberNotificationsPage() {
  return (
    <BarberShell
      title="Inbox"
      description="Notifications for your chair."
    >
      <BarberNotifications />
    </BarberShell>
  );
}

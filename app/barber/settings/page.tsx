import type { Metadata } from "next";

import { BarberSettings } from "@/components/barber/barber-settings";
import { BarberShell } from "@/components/barber/barber-shell";

export const metadata: Metadata = {
  title: "Business settings",
  robots: { index: false, follow: false },
};

export default function BarberSettingsPage() {
  return (
    <BarberShell
      title="Business settings"
      description="Profile, booking policies, notifications and sign out."
    >
      <BarberSettings />
    </BarberShell>
  );
}

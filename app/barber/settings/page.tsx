import type { Metadata } from "next";

import { BarberSettings } from "@/components/barber/barber-settings";
import { BarberShell } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";

export const metadata: Metadata = {
  title: "Business settings",
  robots: { index: false, follow: false },
};

export default function BarberSettingsPage() {
  return (
    <BarberShell
      title={<T k="nav.settings" />}
      description={<T k="work.settings.profileHint" />}
    >
      <BarberSettings />
    </BarberShell>
  );
}

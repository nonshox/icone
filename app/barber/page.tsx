import type { Metadata } from "next";

import { BarberDashboard } from "@/components/barber/barber-dashboard";
import { BarberShell } from "@/components/barber/barber-shell";

export const metadata: Metadata = {
  title: "Your business",
  robots: { index: false, follow: false },
};

export default function BarberPage() {
  return (
    <BarberShell
      title="Your business"
      description="Your chair at a glance."
    >
      <BarberDashboard />
    </BarberShell>
  );
}

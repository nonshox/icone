import type { Metadata } from "next";

import { BarberEarnings } from "@/components/barber/barber-earnings";
import { BarberShell } from "@/components/barber/barber-shell";

export const metadata: Metadata = {
  title: "Earnings",
  robots: { index: false, follow: false },
};

export default function BarberEarningsPage() {
  return (
    <BarberShell
      title="Earnings"
      description="Revenue, popular services and returning members."
    >
      <BarberEarnings />
    </BarberShell>
  );
}

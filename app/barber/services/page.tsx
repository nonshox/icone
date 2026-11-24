import type { Metadata } from "next";

import { BarberServices } from "@/components/barber/barber-services";
import { BarberShell } from "@/components/barber/barber-shell";

export const metadata: Metadata = {
  title: "Services",
  robots: { index: false, follow: false },
};

export default function BarberServicesPage() {
  return (
    <BarberShell
      title="Services"
      description="Your menu. Active services flow into booking."
    >
      <BarberServices />
    </BarberShell>
  );
}

import type { Metadata } from "next";

import { BarberServices } from "@/components/barber/barber-services";
import { BarberShell } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";

export const metadata: Metadata = {
  title: "Services",
  robots: { index: false, follow: false },
};

export default function BarberServicesPage() {
  return (
    <BarberShell
      title={<T k="nav.services" />}
      description={<T k="work.services.hint" />}
    >
      <BarberServices />
    </BarberShell>
  );
}

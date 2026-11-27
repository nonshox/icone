import type { Metadata } from "next";

import { BarberCustomers } from "@/components/barber/barber-customers";
import { BarberShell } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";

export const metadata: Metadata = {
  title: "Customers",
  robots: { index: false, follow: false },
};

export default function BarberCustomersPage() {
  return (
    <BarberShell
      title={<T k="nav.myVisits" />}
      description={<T k="work.customers.hint" />}
    >
      <BarberCustomers />
    </BarberShell>
  );
}

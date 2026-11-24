import type { Metadata } from "next";

import { BarberCustomers } from "@/components/barber/barber-customers";
import { BarberShell } from "@/components/barber/barber-shell";

export const metadata: Metadata = {
  title: "Customers",
  robots: { index: false, follow: false },
};

export default function BarberCustomersPage() {
  return (
    <BarberShell
      title="Customers"
      description="Visits, spend and notes that stay private to you."
    >
      <BarberCustomers />
    </BarberShell>
  );
}

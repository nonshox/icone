
import { routeMetadata } from "@/lib/metadata";
import { BarberCustomers } from "@/components/barber/barber-customers";
import { BarberShell } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";

export const metadata = routeMetadata({
  path: "/barber/customers",
  titleKey: "work.customers.title",
  descriptionKey: "work.customers.hint",
  private: true,
});

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

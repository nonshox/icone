
import { routeMetadata } from "@/lib/metadata";
import { BarberServices } from "@/components/barber/barber-services";
import { BarberShell } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";

export const metadata = routeMetadata({
  path: "/barber/services",
  titleKey: "barber.services",
  descriptionKey: "work.services.hint",
  private: true,
});

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

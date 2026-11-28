
import { routeMetadata } from "@/lib/metadata";
import { BarberNotifications } from "@/components/barber/barber-notifications";
import { BarberShell } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";

export const metadata = routeMetadata({
  path: "/barber/notifications",
  titleKey: "nav.inbox",
  descriptionKey: "meta.private.description",
  private: true,
});

export default function BarberNotificationsPage() {
  return (
    <BarberShell
      title={<T k="nav.inbox" />}
      description={<T k="work.dashboard.quickHint" />}
    >
      <BarberNotifications />
    </BarberShell>
  );
}

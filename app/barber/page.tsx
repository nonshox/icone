
import { routeMetadata } from "@/lib/metadata";
import { BarberDashboard } from "@/components/barber/barber-dashboard";
import { BarberShell } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";
import { WaitlistManager } from "@/components/team/waitlist-manager";

export const metadata = routeMetadata({
  path: "/barber",
  titleKey: "nav.business",
  descriptionKey: "meta.private.description",
  private: true,
});

export default function BarberPage() {
  return (
    <BarberShell
      title={<T k="nav.workspace" />}
      description={<T k="work.dashboard.todayHint" />}
    >
      <BarberDashboard />
      <WaitlistManager />
    </BarberShell>
  );
}

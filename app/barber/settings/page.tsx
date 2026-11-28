
import { routeMetadata } from "@/lib/metadata";
import { BarberSettings } from "@/components/barber/barber-settings";
import { BarberShell } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";

export const metadata = routeMetadata({
  path: "/barber/settings",
  titleKey: "nav.settings",
  descriptionKey: "work.settings.profileHint",
  private: true,
});

export default function BarberSettingsPage() {
  return (
    <BarberShell
      title={<T k="nav.settings" />}
      description={<T k="work.settings.profileHint" />}
    >
      <BarberSettings />
    </BarberShell>
  );
}

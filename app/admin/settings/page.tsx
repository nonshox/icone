
import { routeMetadata } from "@/lib/metadata";
import { AdminFrame } from "@/components/admin/admin-frame";
import { SettingsView } from "@/components/admin/settings-view";

export const metadata = routeMetadata({
  path: "/admin/settings",
  titleKey: "admin.settings.title",
  descriptionKey: "admin.settings.description",
  private: true,
});

export default function AdminSettingsPage() {
  return (
    <AdminFrame titleKey="admin.settings.title" descriptionKey="admin.settings.description">
      <SettingsView />
    </AdminFrame>
  );
}

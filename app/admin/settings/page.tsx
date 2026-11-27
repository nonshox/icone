import type { Metadata } from "next";

import { AdminFrame } from "@/components/admin/admin-frame";
import { SettingsView } from "@/components/admin/settings-view";

export const metadata: Metadata = {
  title: "Admin — Settings",
  robots: { index: false, follow: false },
};

export default function AdminSettingsPage() {
  return (
    <AdminFrame titleKey="admin.settings.title" descriptionKey="admin.settings.description">
      <SettingsView />
    </AdminFrame>
  );
}

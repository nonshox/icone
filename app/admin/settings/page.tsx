import type { Metadata } from "next";

import { AdminFrame } from "@/components/admin/admin-frame";
import { SettingsView } from "@/components/admin/settings-view";

export const metadata: Metadata = {
  title: "Admin · Settings",
  robots: { index: false, follow: false },
};

export default function AdminSettingsPage() {
  return (
    <AdminFrame
      title="Platform settings"
      description="Categories and platform defaults."
    >
      <SettingsView />
    </AdminFrame>
  );
}

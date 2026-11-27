import type { Metadata } from "next";

import { AdminFrame } from "@/components/admin/admin-frame";
import { DashboardView } from "@/components/admin/dashboard-view";

export const metadata: Metadata = {
  title: "Admin — Dashboard",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <AdminFrame titleKey="admin.dashboard.title" descriptionKey="admin.dashboard.description">
      <DashboardView />
    </AdminFrame>
  );
}

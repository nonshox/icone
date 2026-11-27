import type { Metadata } from "next";

import { AdminFrame } from "@/components/admin/admin-frame";
import { ReportsView } from "@/components/admin/reports-view";

export const metadata: Metadata = {
  title: "Admin — Reports",
  robots: { index: false, follow: false },
};

export default function AdminReportsPage() {
  return (
    <AdminFrame titleKey="admin.reports.title" descriptionKey="admin.reports.description">
      <ReportsView />
    </AdminFrame>
  );
}

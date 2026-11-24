import type { Metadata } from "next";

import { AdminFrame } from "@/components/admin/admin-frame";
import { ReportsView } from "@/components/admin/reports-view";

export const metadata: Metadata = {
  title: "Admin · Reports",
  robots: { index: false, follow: false },
};

export default function AdminReportsPage() {
  return (
    <AdminFrame
      title="Reports"
      description="Growth, bookings, revenue and retention from real records."
    >
      <ReportsView />
    </AdminFrame>
  );
}

import type { Metadata } from "next";

import { AdminFrame } from "@/components/admin/admin-frame";
import { BarbersView } from "@/components/admin/barbers-view";

export const metadata: Metadata = {
  title: "Admin · Barbers",
  robots: { index: false, follow: false },
};

export default function AdminBarbersPage() {
  return (
    <AdminFrame
      title="Barbers"
      description="Review chairs, feature listings and moderate submitted work."
    >
      <BarbersView />
    </AdminFrame>
  );
}

import type { Metadata } from "next";

import { AdminFrame } from "@/components/admin/admin-frame";
import { BarbersView } from "@/components/admin/barbers-view";

export const metadata: Metadata = {
  title: "Admin — Barbers",
  robots: { index: false, follow: false },
};

export default function AdminBarbersPage() {
  return (
    <AdminFrame titleKey="admin.barbers.title" descriptionKey="admin.barbers.description">
      <BarbersView />
    </AdminFrame>
  );
}

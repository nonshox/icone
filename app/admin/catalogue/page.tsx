import type { Metadata } from "next";

import { AdminFrame } from "@/components/admin/admin-frame";
import { AdminView } from "@/components/admin/admin-view";

export const metadata: Metadata = {
  title: "Admin · Catalogue",
  robots: { index: false, follow: false },
};

export default function AdminCataloguePage() {
  return (
    <AdminFrame
      title="Catalogue"
      description="Chairs, services, opening hours, date overrides and reviews."
    >
      <AdminView />
    </AdminFrame>
  );
}

import type { Metadata } from "next";

import { AdminFrame } from "@/components/admin/admin-frame";
import { AdminView } from "@/components/admin/admin-view";

export const metadata: Metadata = {
  title: "Admin — Catalogue",
  robots: { index: false, follow: false },
};

export default function AdminCataloguePage() {
  return (
    <AdminFrame titleKey="admin.catalogue.title" descriptionKey="admin.catalogue.description">
      <AdminView />
    </AdminFrame>
  );
}

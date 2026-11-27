import type { Metadata } from "next";

import { AdminFrame } from "@/components/admin/admin-frame";
import { ApplicationsView } from "@/components/admin/applications-view";

export const metadata: Metadata = {
  title: "Admin — Applications",
  robots: { index: false, follow: false },
};

export default function AdminApplicationsPage() {
  return (
    <AdminFrame titleKey="admin.applications.title" descriptionKey="admin.applications.description">
      <ApplicationsView />
    </AdminFrame>
  );
}

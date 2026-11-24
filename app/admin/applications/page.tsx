import type { Metadata } from "next";

import { AdminFrame } from "@/components/admin/admin-frame";
import { AdminApplicationsView } from "@/components/applications/admin-applications-view";

export const metadata: Metadata = {
  title: "Admin · Applications",
  robots: { index: false, follow: false },
};

export default function AdminApplicationsPage() {
  return (
    <AdminFrame title="Applications" description="Review barber applications.">
      <AdminApplicationsView />
    </AdminFrame>
  );
}

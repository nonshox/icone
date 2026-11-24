import type { Metadata } from "next";

import { AdminFrame } from "@/components/admin/admin-frame";
import { AppointmentsView } from "@/components/admin/appointments-view";

export const metadata: Metadata = {
  title: "Admin · Appointments",
  robots: { index: false, follow: false },
};

export default function AdminAppointmentsPage() {
  return (
    <AdminFrame
      title="Appointments"
      description="Every visit on the platform, with status control and dispute details."
    >
      <AppointmentsView />
    </AdminFrame>
  );
}


import { routeMetadata } from "@/lib/metadata";
import { AdminFrame } from "@/components/admin/admin-frame";
import { AppointmentsView } from "@/components/admin/appointments-view";

export const metadata = routeMetadata({
  path: "/admin/appointments",
  titleKey: "admin.appointments.title",
  descriptionKey: "admin.appointments.description",
  private: true,
});

export default function AdminAppointmentsPage() {
  return (
    <AdminFrame titleKey="admin.appointments.title" descriptionKey="admin.appointments.description">
      <AppointmentsView />
    </AdminFrame>
  );
}

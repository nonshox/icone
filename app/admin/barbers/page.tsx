
import { routeMetadata } from "@/lib/metadata";
import { AdminFrame } from "@/components/admin/admin-frame";
import { BarbersView } from "@/components/admin/barbers-view";

export const metadata = routeMetadata({
  path: "/admin/barbers",
  titleKey: "admin.barbers.title",
  descriptionKey: "admin.barbers.description",
  private: true,
});

export default function AdminBarbersPage() {
  return (
    <AdminFrame titleKey="admin.barbers.title" descriptionKey="admin.barbers.description">
      <BarbersView />
    </AdminFrame>
  );
}

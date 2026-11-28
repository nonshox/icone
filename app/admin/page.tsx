
import { routeMetadata } from "@/lib/metadata";
import { AdminFrame } from "@/components/admin/admin-frame";
import { DashboardView } from "@/components/admin/dashboard-view";

export const metadata = routeMetadata({
  path: "/admin",
  titleKey: "admin.dashboard.title",
  descriptionKey: "admin.dashboard.description",
  private: true,
});

export default function AdminPage() {
  return (
    <AdminFrame titleKey="admin.dashboard.title" descriptionKey="admin.dashboard.description">
      <DashboardView />
    </AdminFrame>
  );
}

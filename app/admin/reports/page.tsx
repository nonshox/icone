
import { routeMetadata } from "@/lib/metadata";
import { AdminFrame } from "@/components/admin/admin-frame";
import { ReportsView } from "@/components/admin/reports-view";

export const metadata = routeMetadata({
  path: "/admin/reports",
  titleKey: "admin.reports.title",
  descriptionKey: "admin.reports.description",
  private: true,
});

export default function AdminReportsPage() {
  return (
    <AdminFrame titleKey="admin.reports.title" descriptionKey="admin.reports.description">
      <ReportsView />
    </AdminFrame>
  );
}

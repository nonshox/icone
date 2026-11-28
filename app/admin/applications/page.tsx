
import { routeMetadata } from "@/lib/metadata";
import { AdminFrame } from "@/components/admin/admin-frame";
import { ApplicationsView } from "@/components/admin/applications-view";

export const metadata = routeMetadata({
  path: "/admin/applications",
  titleKey: "admin.applications.title",
  descriptionKey: "admin.applications.description",
  private: true,
});

export default function AdminApplicationsPage() {
  return (
    <AdminFrame titleKey="admin.applications.title" descriptionKey="admin.applications.description">
      <ApplicationsView />
    </AdminFrame>
  );
}


import { routeMetadata } from "@/lib/metadata";
import { AdminFrame } from "@/components/admin/admin-frame";
import { UsersView } from "@/components/admin/users-view";

export const metadata = routeMetadata({
  path: "/admin/users",
  titleKey: "admin.users.title",
  descriptionKey: "admin.users.description",
  private: true,
});

export default function AdminUsersPage() {
  return (
    <AdminFrame titleKey="admin.users.title" descriptionKey="admin.users.description">
      <UsersView />
    </AdminFrame>
  );
}

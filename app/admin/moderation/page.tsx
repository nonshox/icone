
import { routeMetadata } from "@/lib/metadata";
import { AdminFrame } from "@/components/admin/admin-frame";
import { ModerationView } from "@/components/admin/moderation-view";

export const metadata = routeMetadata({
  path: "/admin/moderation",
  titleKey: "admin.moderation.title",
  descriptionKey: "admin.moderation.description",
  private: true,
});

export default function AdminModerationPage() {
  return (
    <AdminFrame titleKey="admin.moderation.title" descriptionKey="admin.moderation.description">
      <ModerationView />
    </AdminFrame>
  );
}

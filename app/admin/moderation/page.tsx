import type { Metadata } from "next";

import { AdminFrame } from "@/components/admin/admin-frame";
import { ModerationView } from "@/components/admin/moderation-view";

export const metadata: Metadata = {
  title: "Admin — Moderation",
  robots: { index: false, follow: false },
};

export default function AdminModerationPage() {
  return (
    <AdminFrame titleKey="admin.moderation.title" descriptionKey="admin.moderation.description">
      <ModerationView />
    </AdminFrame>
  );
}

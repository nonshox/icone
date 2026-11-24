import type { Metadata } from "next";

import { AdminFrame } from "@/components/admin/admin-frame";
import { ModerationView } from "@/components/admin/moderation-view";

export const metadata: Metadata = {
  title: "Admin · Moderation",
  robots: { index: false, follow: false },
};

export default function AdminModerationPage() {
  return (
    <AdminFrame
      title="Moderation"
      description="Reviews, portfolio images and platform announcements."
    >
      <ModerationView />
    </AdminFrame>
  );
}

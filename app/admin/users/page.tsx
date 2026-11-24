import type { Metadata } from "next";

import { AdminFrame } from "@/components/admin/admin-frame";
import { UsersView } from "@/components/admin/users-view";

export const metadata: Metadata = {
  title: "Admin · Users",
  robots: { index: false, follow: false },
};

export default function AdminUsersPage() {
  return (
    <AdminFrame
      title="Users"
      description="Search members, manage roles and chairs, and block access."
    >
      <UsersView />
    </AdminFrame>
  );
}

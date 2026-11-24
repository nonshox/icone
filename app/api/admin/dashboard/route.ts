import "server-only";

import { NextResponse } from "next/server";

import { getDashboard } from "@/lib/domain/admin";
import { currentMember, isStaff } from "@/lib/domain/member";
import { apiError } from "@/lib/http";

/** GET /api/admin/dashboard — live platform figures. Staff only. */
export async function GET() {
  const member = await currentMember();
  if (!member) return apiError("Sign in to view the dashboard.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }

  try {
    return NextResponse.json({ ok: true as const, stats: await getDashboard() });
  } catch (error) {
    console.error("[admin] dashboard failed", error);
    return apiError("Could not load the dashboard.", 502, "dashboard_failed");
  }
}

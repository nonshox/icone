import "server-only";

import { NextResponse } from "next/server";

import { getAdminBookingDetail } from "@/lib/domain/admin";
import { currentMember, isStaff } from "@/lib/domain/member";
import { apiError } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

/** GET /api/admin/appointments/:id — dispute investigation details. Staff only. */
export async function GET(_request: Request, context: Context) {
  const member = await currentMember();
  if (!member) return apiError("Sign in to investigate appointments.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }

  const { id } = await context.params;
  if (!id || id.length > 36) {
    return apiError("Pick an appointment.", 400, "invalid_id");
  }

  try {
    const detail = await getAdminBookingDetail(id);
    if (!detail) return apiError("Appointment not found.", 404, "not_found");
    return NextResponse.json({ ok: true as const, detail });
  } catch (error) {
    console.error("[admin] appointment detail failed", error);
    return apiError("Could not load the appointment.", 502, "appointment_failed");
  }
}

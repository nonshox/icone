import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getReports } from "@/lib/domain/admin";
import { currentMember, isStaff } from "@/lib/domain/member";
import { apiError } from "@/lib/http";

const querySchema = z.object({
  days: z
    .enum(["30", "90", "365"])
    .optional()
    .transform((value) => Number(value ?? "30")),
});

/** GET /api/admin/reports?days=30|90|365 — real trends. Staff only. */
export async function GET(request: NextRequest) {
  const member = await currentMember();
  if (!member) return apiError("Sign in to view reports.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }

  const parsed = querySchema.safeParse({
    days: request.nextUrl.searchParams.get("days") ?? undefined,
  });
  if (!parsed.success) {
    return apiError("Pick a valid date range.", 400, "invalid_range");
  }

  try {
    return NextResponse.json({
      ok: true as const,
      report: await getReports(parsed.data.days),
    });
  } catch (error) {
    console.error("[admin] reports failed", error);
    return apiError("Could not build the report.", 502, "reports_failed");
  }
}

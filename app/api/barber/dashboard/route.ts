import "server-only";

import { type NextRequest } from "next/server";

import { barberAuth, businessFailure } from "@/app/api/barber/_auth";
import { getDashboard } from "@/lib/domain/barber-business";
import { apiOk } from "@/lib/http";

/** GET /api/barber/dashboard — real numbers from this chair's own data. */
export async function GET(request: NextRequest) {
  const auth = await barberAuth(request);
  if (!auth.ok) return auth.response;

  try {
    return apiOk({ dashboard: await getDashboard(auth.userId) });
  } catch (error) {
    return businessFailure(error, "Could not load your dashboard.", "dashboard_failed");
  }
}

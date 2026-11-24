import { NextResponse, type NextRequest } from "next/server";

import { getService } from "@/lib/domain/data";
import { getSlots } from "@/lib/domain/availability";
import { isDate } from "@/lib/domain/time";
import { apiError } from "@/lib/http";

/** GET /api/availability?barber=&date=&service= — free start times. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const barber = params.get("barber") ?? "";
  const date = params.get("date") ?? "";
  const service = params.get("service") ?? "";

  if (!barber) {
    return apiError("Pick a barber first.", 400, "no_barber");
  }

  if (!isDate(date)) {
    return apiError("Pick a valid date.", 400, "bad_date");
  }

  try {
    const item = await getService(service);
    if (!item) {
      return apiError("Pick a service first.", 400, "no_service");
    }

    const slots = await getSlots({ barber, date, time: item.time });
    return NextResponse.json({ ok: true as const, slots, time: item.time });
  } catch (error) {
    console.error("[api] availability failed", error);
    return apiError("Could not load times.", 502, "availability_failed");
  }
}

import "server-only";

import { type NextRequest } from "next/server";
import { z } from "zod";

import { barberAuth, businessFailure, firstIssue } from "@/app/api/barber/_auth";
import { getEarnings } from "@/lib/domain/barber-business";
import { apiError, apiOk } from "@/lib/http";
import { addDays, isDate, today } from "@/lib/domain/time";

const date = z.string().refine(isDate, "Use a YYYY-MM-DD date.");
const filterSchema = z.object({
  from: date.default(addDays(today(), -29)),
  to: date.default(today()),
  service: z.string().trim().max(36).default(""),
  status: z.enum(["all", "done", "booked"]).default("done"),
});

/** GET /api/barber/earnings?from=&to=&service=&status= — real revenue data. */
export async function GET(request: NextRequest) {
  const auth = await barberAuth(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const parsed = filterSchema.safeParse({
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    service: params.get("service") ?? undefined,
    status: params.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the filters."), 400, "invalid_filter");
  }
  const filter = parsed.data;
  if (filter.from > filter.to) {
    return apiError("The start date must be before the end date.", 400, "invalid_filter");
  }

  try {
    return apiOk({ earnings: await getEarnings(auth.userId, filter) });
  } catch (error) {
    return businessFailure(error, "Could not load your earnings.", "earnings_failed");
  }
}

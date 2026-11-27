import "server-only";

import { listBarbers } from "@/lib/domain/professional";
import { apiError, apiOk } from "@/lib/http";

/** GET /api/barbers — the active chair list. */
export async function GET() {
  try {
    return apiOk({ barbers: await listBarbers() });
  } catch (error) {
    console.error("[api] barbers failed", error);
    return apiError("Could not load barbers.", 502, "barbers_failed");
  }
}

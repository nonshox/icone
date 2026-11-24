import { NextResponse } from "next/server";

import { listBarbers } from "@/lib/domain/data";
import { apiError } from "@/lib/http";

/** GET /api/barbers — the active chair list. */
export async function GET() {
  try {
    return NextResponse.json({ ok: true as const, barbers: await listBarbers() });
  } catch (error) {
    console.error("[api] barbers failed", error);
    return apiError("Could not load barbers.", 502, "barbers_failed");
  }
}

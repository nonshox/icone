import { NextResponse } from "next/server";

import { listServices } from "@/lib/domain/data";
import { apiError } from "@/lib/http";

/** GET /api/services — the menu. */
export async function GET() {
  try {
    return NextResponse.json({
      ok: true as const,
      services: await listServices(),
    });
  } catch (error) {
    console.error("[api] services failed", error);
    return apiError("Could not load services.", 502, "services_failed");
  }
}

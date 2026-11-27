import "server-only";

import type { NextRequest } from "next/server";

import { getService } from "@/lib/domain/catalog";
import { apiError, apiOk } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

/** GET /api/services/:id — one menu item. */
export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;

  try {
    const service = await getService(id);
    if (!service) return apiError("Service not found.", 404, "not_found");

    return apiOk({ service });
  } catch (error) {
    console.error("[api] service detail failed", error);
    return apiError("Could not load the service.", 502, "service_failed");
  }
}

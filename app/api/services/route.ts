import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";
import { toService } from "@/lib/domain/catalog";
import { list } from "@/lib/domain/crud";
import { apiError, apiOk } from "@/lib/http";

/** GET /api/services — the active menu. */
export async function GET() {
  try {
    const rows = await list(TABLES.services, [
      Query.equal("active", true),
      Query.orderAsc("sort"),
      Query.limit(200),
    ]);
    return apiOk({ services: rows.map(toService) });
  } catch (error) {
    console.error("[api] services failed", error);
    return apiError("Could not load services.", 502, "services_failed");
  }
}

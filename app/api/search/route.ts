import { type NextRequest } from "next/server";

import { SORT_KEYS, search, type SearchQuery, type SortKey } from "@/lib/domain/discovery";
import { apiError, apiOk } from "@/lib/http";

/** GET /api/search — discovery across barbers and barbershops. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const sort = params.get("sort") ?? "";
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));

  const query: SearchQuery = {
    q: params.get("q") ?? undefined,
    city: params.get("city") ?? undefined,
    district: params.get("district") ?? undefined,
    service: params.get("service") ?? undefined,
    verified: params.get("verified") === "1",
    openNow: params.get("open") === "1",
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : undefined,
    type: (["all", "barber", "shop"].includes(params.get("type") ?? "")
      ? params.get("type")
      : "all") as SearchQuery["type"],
    limit: Number(params.get("limit")) || undefined,
  };

  if (Number.isFinite(lat) && Number.isFinite(lng) && lat && lng) {
    query.lat = lat;
    query.lng = lng;
  }

  const price = Number(params.get("maxPrice"));
  if (Number.isFinite(price) && price > 0) query.maxPrice = price;

  const minRating = Number(params.get("minRating"));
  if (Number.isFinite(minRating) && minRating > 0) query.minRating = minRating;

  try {
    return apiOk({ results: await search(query) });
  } catch (error) {
    console.error("[api] search failed", error);
    return apiError("Could not load results.", 502, "search_failed");
  }
}

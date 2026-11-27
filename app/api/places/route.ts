import { loadCategories, loadPlaces } from "@/lib/domain/directory";
import { apiError, apiOk } from "@/lib/http";

/** GET /api/places — Uzbekistan cities/districts and service categories. */
export async function GET() {
  try {
    const [places, categories] = await Promise.all([
      loadPlaces(),
      loadCategories(),
    ]);
    return apiOk({
      cities: places.cities,
      districts: places.districts,
      categories,
    });
  } catch (error) {
    console.error("[api] places failed", error);
    return apiError("Could not load locations.", 502, "places_failed");
  }
}

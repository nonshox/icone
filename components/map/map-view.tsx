"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin, Navigation } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { T } from "@/components/i18n/t";
import { api } from "@/lib/api/client";
import { imageUrl } from "@/lib/client/files";
import type { SearchResult } from "@/lib/domain/discovery";
import { formatPrice, label as timeLabel } from "@/lib/domain/time";
import { useT } from "@/lib/i18n/use-t";

import { MapCanvas, type MapPoint } from "./map-canvas";

type Bounds = { north: number; south: number; east: number; west: number };
type Coords = { lat: number; lng: number };

const SORTS = ["recommended", "nearest", "rating", "price", "soonest", "reviews"] as const;

export function MapView({ initialQ = "" }: { initialQ?: string }) {
  const t = useT();
  const [filters, setFilters] = useState({
    q: initialQ,
    type: "all",
    city: "",
    service: "",
    maxPrice: "",
    minRating: "",
    sort: "recommended" as (typeof SORTS)[number],
    verified: false,
    openNow: false,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [searchArea, setSearchArea] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  // A stable callback that ignores identical bounds prevents the map from
  // re-rendering in a loop when it publishes its viewport.
  const onMove = useCallback((next: Bounds) => {
    setBounds((current) => {
      const safe = {
        north: Math.min(90, next.north),
        south: Math.max(-90, next.south),
        east: Math.min(180, next.east),
        west: Math.max(-180, next.west),
      };
      if (
        current &&
        Math.abs(current.north - safe.north) < 1e-6 &&
        Math.abs(current.south - safe.south) < 1e-6 &&
        Math.abs(current.east - safe.east) < 1e-6 &&
        Math.abs(current.west - safe.west) < 1e-6
      ) {
        return current;
      }
      return safe;
    });
  }, []);

  const onLocate = useCallback((point: Coords) => {
    setCoords(point);
    setSearchArea(false);
    setFilters((current) => ({ ...current, sort: "nearest" }));
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.type !== "all") params.set("type", filters.type);
    if (filters.city) params.set("city", filters.city);
    if (filters.service) params.set("service", filters.service);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
    if (filters.minRating) params.set("minRating", filters.minRating);
    if (filters.verified) params.set("verified", "1");
    if (filters.openNow) params.set("open", "1");
    if (coords) {
      params.set("lat", String(coords.lat));
      params.set("lng", String(coords.lng));
    }
    if (filters.sort !== "recommended" || coords) {
      params.set("sort", filters.sort);
    }
    const suffix = params.toString();
    return `/api/search${suffix ? `?${suffix}` : ""}`;
  }, [filters, coords]);

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["map", query],
    queryFn: () => api<{ results: SearchResult[] }>(query),
  });
  const places = useQuery({
    queryKey: ["places"],
    queryFn: () =>
      api<{
        cities: Array<{ id: string; name: string }>;
        categories: Array<{ id: string; name: string }>;
      }>("/api/places"),
    staleTime: 10 * 60_000,
  });

  // "Search this area" is a real bounding box, not just a re-sort.
  const results = useMemo(() => {
    const rows = data?.results ?? [];
    if (!searchArea || !bounds) return rows;
    return rows.filter(
      (row) =>
        row.lat >= bounds.south &&
        row.lat <= bounds.north &&
        row.lng >= bounds.west &&
        row.lng <= bounds.east,
    );
  }, [data, searchArea, bounds]);

  const points: MapPoint[] = results
    .filter((row) => row.lat && row.lng)
    .map((row) => ({
      id: row.id,
      lat: row.lat,
      lng: row.lng,
      label: row.name,
      kind: row.kind,
    }));

  const selectedRow = results.find((row) => row.id === selected) ?? null;
  const center = selectedRow
    ? { lat: selectedRow.lat, lng: selectedRow.lng }
    : coords ??
      (points[0] ? { lat: points[0].lat, lng: points[0].lng } : { lat: 41.311, lng: 69.24 });

  function patch<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const filterClass =
    "rounded-xl border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={filters.q}
          onChange={(event) => patch("q", event.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          className={filterClass}
        />
        <select
          aria-label={t("map.sort")}
          value={filters.sort}
          onChange={(event) => patch("sort", event.target.value as (typeof SORTS)[number])}
          className={filterClass}
        >
          {SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {t(`map.sort.${sort}`)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("map.everyone")}
          value={filters.type}
          onChange={(event) => patch("type", event.target.value)}
          className={filterClass}
        >
          <option value="all">{t("map.everyone")}</option>
          <option value="barber">{t("map.barbers")}</option>
          <option value="shop">{t("map.shops")}</option>
        </select>
        <select
          aria-label={t("map.allCities")}
          value={filters.city}
          onChange={(event) => patch("city", event.target.value)}
          className={filterClass}
        >
          <option value="">{t("map.allCities")}</option>
          {(places.data?.cities ?? []).map((city) => (
            <option key={city.id} value={city.name}>
              {city.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t("map.allServices")}
          value={filters.service}
          onChange={(event) => patch("service", event.target.value)}
          className={filterClass}
        >
          <option value="">{t("map.allServices")}</option>
          {(places.data?.categories ?? []).map((category) => (
            <option key={category.id} value={category.name}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t("map.rating")}
          value={filters.minRating}
          onChange={(event) => patch("minRating", event.target.value)}
          className={filterClass}
        >
          <option value="">{t("map.anyRating")}</option>
          {[4, 4.5, 4.8].map((rating) => (
            <option key={rating} value={String(rating)}>
              ★ {rating}+
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          step={10000}
          value={filters.maxPrice}
          onChange={(event) => patch("maxPrice", event.target.value)}
          placeholder={t("map.maxPrice")}
          aria-label={t("map.maxPrice")}
          className={filterClass}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.verified}
              onChange={(event) => patch("verified", event.target.checked)}
            />
            <T k="map.verified" />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.openNow}
              onChange={(event) => patch("openNow", event.target.checked)}
            />
            <T k="map.availableNow" />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={searchArea}
              onChange={(event) => setSearchArea(event.target.checked)}
            />
            <T k="map.searchArea" />
          </label>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-xl border border-brand px-3 py-1.5 text-xs hover:bg-brand/10"
          >
            <T k="map.refresh" />
          </button>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-muted p-1 lg:hidden">
        {(["map", "list"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            aria-pressed={viewMode === mode}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === mode
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            <T k={mode === "map" ? "map.showMap" : "map.list"} />
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className={viewMode === "list" ? "hidden lg:block" : "block"}>
          <MapCanvas
            center={center}
            points={points}
            selected={hovered ?? selected}
            onSelect={setSelected}
            onMove={onMove}
            onLocate={onLocate}
          />
        </div>

        <div
          className={`space-y-3 lg:max-h-[600px] lg:overflow-y-auto ${
            viewMode === "map" ? "hidden lg:block" : "block"
          }`}
        >
          {error ? (
            <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
              {t("map.loadError")}
            </div>
          ) : null}
          {isLoading ? (
            <div className="space-y-2" aria-hidden>
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : null}
          {!isLoading && results.length === 0 ? (
            <div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">
              <T k="search.empty" />
            </div>
          ) : null}
          {isFetching && !isLoading ? (
            <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
          ) : null}
          {results.map((row) => (
            <article
              key={`${row.kind}-${row.id}`}
              onMouseEnter={() => setHovered(row.id)}
              onMouseLeave={() => setHovered(null)}
              className={`rounded-2xl border p-3 transition-colors ${
                hovered === row.id || selected === row.id
                  ? "border-brand bg-brand/5"
                  : "border-border bg-card"
              }`}
            >
              <Link
                href={
                  row.kind === "shop"
                    ? `/shop/${row.slug || row.id}`
                    : `/barbers/${row.slug || row.id}`
                }
                onClick={() => setSelected(row.id)}
                className="block"
              >
                <div className="flex items-center gap-3">
                  {row.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl(row.photo)}
                      alt=""
                      className="size-12 rounded-xl object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.subtitle} · {row.city}
                      {row.district ? `, ${row.district}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>★ {row.rating || "—"}</span>
                  <span>
                    {row.reviews} <T k="map.reviews" />
                  </span>
                  <span>{formatPrice(row.price)}</span>
                  {row.distance > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Navigation className="size-3" aria-hidden />
                      {row.distance} km
                    </span>
                  ) : null}
                  {row.next ? (
                    <span>
                      <T k="map.next" />: {timeLabel(row.next.start)}
                    </span>
                  ) : null}
                </div>
              </Link>
              {row.lat && row.lng ? (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${row.lat}&mlon=${row.lng}#map=17/${row.lat}/${row.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-strong hover:underline"
                >
                  <MapPin className="size-3" aria-hidden />
                  <T k="map.directions" />
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

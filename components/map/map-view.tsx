"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { api } from "@/lib/api/client";
import { imageUrl } from "@/lib/client/files";
import type { SearchResult } from "@/lib/domain/discovery";
import { formatPrice, label as timeLabel } from "@/lib/domain/time";

import { MapCanvas, type MapPoint } from "./map-canvas";

export function MapView({ initialQ = "" }: { initialQ?: string }) {
  const [filters, setFilters] = useState({
    q: initialQ,
    type: "all",
    city: "",
    service: "",
    maxPrice: "",
    verified: false,
    openNow: false,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [bounds, setBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);
  const [searchArea, setSearchArea] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.type !== "all") params.set("type", filters.type);
    if (filters.city) params.set("city", filters.city);
    if (filters.service) params.set("service", filters.service);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
    if (filters.verified) params.set("verified", "1");
    if (filters.openNow) params.set("open", "1");
    if (searchArea && bounds) {
      params.set("lat", String((bounds.north + bounds.south) / 2));
      params.set("lng", String((bounds.east + bounds.west) / 2));
      params.set("sort", "nearest");
    }
    const suffix = params.toString();
    return `/api/search${suffix ? `?${suffix}` : ""}`;
  }, [filters, bounds, searchArea]);

  const { data, error, isLoading, refetch } = useQuery({
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

  const results = data?.results ?? [];
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
    : points[0]
      ? { lat: points[0].lat, lng: points[0].lng }
      : { lat: 41.311, lng: 69.24 };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={filters.q}
          onChange={(event) =>
            setFilters({ ...filters, q: event.target.value })
          }
          placeholder="Barber, shop or service"
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
        />
        <select
          value={filters.type}
          onChange={(event) =>
            setFilters({ ...filters, type: event.target.value })
          }
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">Everyone</option>
          <option value="barber">Barbers</option>
          <option value="shop">Barbershops</option>
        </select>
        <select
          value={filters.city}
          onChange={(event) =>
            setFilters({ ...filters, city: event.target.value })
          }
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All cities</option>
          {(places.data?.cities ?? []).map((city) => (
            <option key={city.id} value={city.name}>
              {city.name}
            </option>
          ))}
        </select>
        <select
          value={filters.service}
          onChange={(event) =>
            setFilters({ ...filters, service: event.target.value })
          }
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All services</option>
          {(places.data?.categories ?? []).map((category) => (
            <option key={category.id} value={category.name}>
              {category.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.verified}
            onChange={(event) =>
              setFilters({ ...filters, verified: event.target.checked })
            }
          />
          Verified
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.openNow}
            onChange={(event) =>
              setFilters({ ...filters, openNow: event.target.checked })
            }
          />
          Available now
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={searchArea}
            onChange={(event) => setSearchArea(event.target.checked)}
          />
          Search this area
        </label>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-xl border border-brand px-3 py-2 text-sm hover:bg-brand/10"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <MapCanvas
          center={center}
          points={points}
          selected={selected}
          onSelect={setSelected}
          onMove={setBounds}
        />

        <div className="space-y-3">
          {error ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
              Could not load results. Try again.
            </div>
          ) : null}
          {isLoading ? (
            <div className="space-y-2" aria-hidden>
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-2xl bg-muted"
                />
              ))}
            </div>
          ) : null}
          {!isLoading && results.length === 0 ? (
            <div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">
              No professionals match these filters.
            </div>
          ) : null}
          {results.map((row) => (
            <Link
              key={`${row.kind}-${row.id}`}
              href={row.kind === "shop" ? `/shop/${row.slug || row.id}` : `/barbers/${row.slug || row.id}`}
              onMouseEnter={() => setSelected(row.id)}
              className={`block rounded-2xl border p-3 transition-colors hover:bg-brand/5 ${
                selected === row.id ? "border-brand bg-brand/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-3">
                {row.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl(row.photo)}
                    alt=""
                    className="h-12 w-12 rounded-xl object-cover"
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
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>★ {row.rating || "—"}</span>
                <span>{row.reviews} reviews</span>
                <span>{formatPrice(row.price)}</span>
                {row.next ? <span>{timeLabel(row.next.start)}</span> : null}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

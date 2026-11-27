"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind?: string;
};

const TILE = 256;

function toTile(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n,
  };
}

function fromTile(x: number, y: number, zoom: number) {
  const n = 2 ** zoom;
  const lng = (x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { lat, lng };
}

type Props = {
  center: { lat: number; lng: number };
  points: MapPoint[];
  selected?: string | null;
  onSelect?: (id: string) => void;
  onMove?: (bounds: { north: number; south: number; east: number; west: number }) => void;
};

/**
 * A small OSM raster map with no API key. Tiles come from OpenStreetMap, which
 * has full coverage of Uzbekistan; coordinates always come from real profiles.
 */
export function MapCanvas({ center, points, selected, onSelect, onMove }: Props) {
  const [zoom, setZoom] = useState(12);
  const centerKey = `${center.lat},${center.lng}`;
  const [view, setView] = useState<{
    key: string;
    origin: { lat: number; lng: number };
  }>(() => ({ key: centerKey, origin: center }));
  const origin = view.key === centerKey ? view.origin : center;
  const [size, setSize] = useState({ width: 800, height: 480 });
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);

  const tiles = useMemo(() => {
    const c = toTile(origin.lat, origin.lng, zoom);
    const left = Math.floor(c.x - size.width / TILE / 2) - 1;
    const top = Math.floor(c.y - size.height / TILE / 2) - 1;
    const right = Math.ceil(c.x + size.width / TILE / 2) + 1;
    const bottom = Math.ceil(c.y + size.height / TILE / 2) + 1;
    const rows: Array<{ x: number; y: number; px: number; py: number }> = [];
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        rows.push({
          x,
          y,
          px: (x - c.x) * TILE + size.width / 2,
          py: (y - c.y) * TILE + size.height / 2,
        });
      }
    }
    return rows;
  }, [origin.lat, origin.lng, zoom, size.width, size.height]);

  const project = useCallback(
    (lat: number, lng: number) => {
      const c = toTile(origin.lat, origin.lng, zoom);
      const p = toTile(lat, lng, zoom);
      return {
        x: (p.x - c.x) * TILE + size.width / 2,
        y: (p.y - c.y) * TILE + size.height / 2,
      };
    },
    [origin.lat, origin.lng, zoom, size.width, size.height],
  );

  const publish = useCallback(
    (point: { lat: number; lng: number }) => {
      if (!onMove) return;
      const halfX = size.width / 2 / TILE;
      const halfY = size.height / 2 / TILE;
      const c = toTile(point.lat, point.lng, zoom);
      const northWest = fromTile(c.x - halfX, c.y - halfY, zoom);
      const southEast = fromTile(c.x + halfX, c.y + halfY, zoom);
      onMove({
        north: northWest.lat,
        south: southEast.lat,
        east: southEast.lng,
        west: northWest.lng,
      });
    },
    [onMove, size.width, size.height, zoom],
  );

  useEffect(() => {
    publish(origin);
  }, [publish, origin]);

  const drag = useRef<{ x: number; y: number; lat: number; lng: number } | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-muted">
      <div
        ref={frame}
        className="relative h-[420px] w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(event) => {
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            lat: origin.lat,
            lng: origin.lng,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const c = toTile(drag.current.lat, drag.current.lng, zoom);
          const moved = fromTile(
            c.x - (event.clientX - drag.current.x) / TILE,
            c.y - (event.clientY - drag.current.y) / TILE,
            zoom,
          );
          setView({ key: centerKey, origin: moved });
        }}
        onPointerUp={() => {
          drag.current = null;
          publish(origin);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {tiles.map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${tile.x}-${tile.y}-${zoom}`}
            src={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              width: TILE,
              height: TILE,
              left: tile.px,
              top: tile.py,
            }}
          />
        ))}

        {points.map((point) => {
          const at = project(point.lat, point.lng);
          if (at.x < -32 || at.y < -32 || at.x > size.width + 32 || at.y > size.height + 32) {
            return null;
          }
          const active = selected === point.id;
          return (
            <button
              key={point.id}
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onSelect?.(point.id)}
              title={point.label}
              className={`absolute -translate-x-1/2 -translate-y-full rounded-full border px-2 py-1 text-xs font-medium shadow-sm transition-transform ${
                active
                  ? "z-10 scale-110 border-brand bg-brand text-brand-foreground"
                  : "border-border bg-card text-foreground hover:scale-105"
              }`}
              style={{ left: at.x, top: at.y }}
            >
              {point.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(18, value + 1))}
            className="rounded-lg border border-border px-2 py-1 hover:bg-brand/10"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(3, value - 1))}
            className="rounded-lg border border-border px-2 py-1 hover:bg-brand/10"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => {
              setView({ key: centerKey, origin: center });
              publish(center);
            }}
            className="rounded-lg border border-border px-2 py-1 hover:bg-brand/10"
          >
            My location
          </button>
        </div>
        <span>© OpenStreetMap contributors</span>
      </div>
    </div>
  );
}

"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type L from "leaflet";
import type { Feature } from "geojson";
import type { Parcel, Observation } from "../types";
import { timeoutFetch } from "../network";
export type ViewportRows = {
  parcels: Parcel[];
  observations: Observation[];
  features: {
    id: string;
    layer_id: string;
    workspace_id: string;
    feature: Feature;
  }[];
};
const empty: ViewportRows = { parcels: [], observations: [], features: [] };
export function useViewport(
  map: RefObject<L.Map | null>,
  scope: string,
  enabled: boolean,
) {
  const [value, setValue] = useState<{
    scope: string;
    rows: ViewportRows;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const cache = useRef(
    new Map<string, { rows: ViewportRows; until: number }>(),
  );
  const refresh = useCallback(() => {
    cache.current.clear();
    setRevision((n) => n + 1);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let activeKey = "";
    let controller: AbortController | null = null;
    let cancelled = false,
      sequence = 0,
      timer: ReturnType<typeof setTimeout> | undefined;
    let currentMap: L.Map | null = null;
    async function load() {
      const m = currentMap;
      if (!m) return;
      const bounds = m.getBounds();
      const bbox = [
        Math.max(-180, bounds.getWest()),
        Math.max(-90, bounds.getSouth()),
        Math.min(180, bounds.getEast()),
        Math.min(90, bounds.getNorth()),
      ]
        .map((n) => n.toFixed(5))
        .join(",");
      const zoom = m.getZoom(),
        key = `${scope}:${zoom}:${bbox}`;
      if (activeKey === key) return;
      const generation = ++sequence;
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      activeKey = key;
      const saved = cache.current.get(key);
      if (saved && saved.until > Date.now()) {
        setValue({ scope, rows: saved.rows });
        activeKey = "";
        return;
      }
      try {
        const categories = await Promise.all(
          (["parcels", "observations", "features"] as const).map(
            async (kind) => {
              const rows: unknown[] = [];
              let cursor: string | null = null;
              // Bound per-viewport work. Explicit cursor contract supports further paging.
              for (let page = 0; page < 10 && rows.length < 500; page++) {
                const params = new URLSearchParams({
                  bbox,
                  zoom: String(zoom),
                  kind,
                  limit: "100",
                });
                if (cursor) params.set("cursor", cursor);
                const response = await timeoutFetch(
                  `/api/map/viewport?${params}`,
                  { signal },
                );
                const result = await response.json();
                if (!response.ok)
                  throw new Error(result.error || "Viewport unavailable");
                rows.push(...result.rows);
                cursor = result.next_cursor;
                if (!cursor || cancelled || generation !== sequence) break;
              }
              return [kind, rows] as const;
            },
          ),
        );
        if (cancelled || generation !== sequence) return;
        const rows = Object.fromEntries(categories) as ViewportRows;
        cache.current.set(key, { rows, until: Date.now() + 5000 });
        while (cache.current.size > 12)
          cache.current.delete(cache.current.keys().next().value!);
        setValue({ scope, rows });
        setError("");
      } catch (e) {
        if (!cancelled && generation === sequence)
          setError(e instanceof Error ? e.message : "Viewport unavailable");
      } finally {
        if (generation === sequence) activeKey = "";
      }
    }
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 300);
    }
    const setup = setTimeout(() => {
      currentMap = map.current;
      currentMap?.on("moveend", schedule);
      void load();
    }, 0);
    return () => {
      cancelled = true;
      controller?.abort();
      clearTimeout(setup);
      clearTimeout(timer);
      currentMap?.off("moveend", schedule);
    };
  }, [map, scope, revision, enabled]);
  return {
    rows: value?.scope === scope ? value.rows : empty,
    ready: value?.scope === scope,
    refresh,
    error,
  };
}

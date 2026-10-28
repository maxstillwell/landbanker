import intersect from "@turf/intersect";
import { featureCollection } from "@turf/helpers";
import type { Polygon, MultiPolygon } from "geojson";
import { geometryMeasurement } from "./measurement";

export type SelectedArea = {
  id: string;
  label: string;
  source: string;
  kind: "parcel" | "feature";
  geometry: Polygon | MultiPolygon | null;
  previewGeometry?: Polygon | MultiPolygon;
  location?: [number, number];
};

export function officialSelectionId(state: string, sourceId: string) {
  const region = state.toUpperCase();
  const provider = region === "VIC" ? "vicmap" : region === "NSW" ? "nsw-spatial" : "unknown";
  return `official:${region}:${provider}:${sourceId}`;
}
export function isOfficialParcelSource(state: string | null | undefined, source: string | null | undefined) {
  if (!source) return false;
  const name = source.trim().toLowerCase();
  return state === "VIC" ? ["vicmap / vicplan", "victorian government", "victorian government · vicplan"].includes(name) : state === "NSW" ? ["nsw spatial services", "nsw government"].includes(name) : false;
}
export function updateSelectedAreas<T extends SelectedArea>(items: T[], item: T, additive: boolean): T[] {
  if (!additive) return [item];
  return items.some((existing) => existing.id === item.id) ? items.filter((existing) => existing.id !== item.id) : [...items, item];
}

export function summarizeAreas(items: SelectedArea[]) {
  let areaM2 = 0;
  let incomplete = false;
  let overlaps = false;
  for (const [index, item] of items.entries()) {
    if (!item.geometry) { incomplete = true; continue; }
    const measured = geometryMeasurement(item.geometry).areaM2;
    if (!Number.isFinite(measured) || measured <= 0) { incomplete = true; continue; }
    areaM2 += measured;
    for (const other of items.slice(0, index)) {
      if (!other.geometry) continue;
      try {
        const overlap = intersect(featureCollection([
          { type: "Feature", properties: {}, geometry: item.geometry },
          { type: "Feature", properties: {}, geometry: other.geometry },
        ]));
        if (overlap && geometryMeasurement(overlap.geometry).areaM2 > 0.01) overlaps = true;
      } catch { incomplete = true; }
    }
  }
  return { areaM2, incomplete, overlaps };
}

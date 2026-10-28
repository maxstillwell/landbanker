import type { Geometry } from "geojson";
import { validGeometry } from "./drawing";

/** A stored location point can be retained when a boundary is associated. */
export function isLocationGeometry(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const object = value as { type?: string; geometry?: unknown };
  const geometry = object.type === "Feature" ? object.geometry : value;
  return !!geometry && typeof geometry === "object" && (geometry as Geometry).type === "Point" && validGeometry(geometry as Geometry);
}

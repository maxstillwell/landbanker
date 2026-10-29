import { createHash } from "node:crypto";
import { z } from "zod";
import type { FeatureCollection, MultiPolygon } from "geojson";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json, sameOrigin } from "@/lib/api";
import { validCollection } from "@/lib/map/drawing";
import { geometryMeasurement } from "@/lib/map/measurement";
import { propertyCentroid } from "@/lib/planning/centroid";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
const input = z.object({ id: z.uuid(), name: z.string().trim().min(1).max(160), description: z.string().max(2000).default(""), sourceFile: z.string().max(160), destination: z.enum(["property", "research", "layer"]), subtype: z.enum(["general", "investigation", "precinct", "growth", "other"]).default("general"), geojson: z.object({ type: z.literal("FeatureCollection"), features: z.array(z.record(z.string(), z.unknown())).min(1).max(5000) }) });
export async function POST(request: import("next/server").NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    if (!["owner", "admin", "editor"].includes(c.role)) throw new Error("Workspace is read-only.");
    const text = await request.text();
    if (text.length > 3_000_000) throw new Error("Spatial import exceeds 3 MB.");
    const p = input.parse(JSON.parse(text));
    const collection = p.geojson as unknown as FeatureCollection;
    if (!validCollection(collection)) throw new Error("The file contains unsupported or invalid geometry.");
    const features = collection.features.map((feature) => ({ ...feature, id: z.uuid().parse(feature.id) }));
    if (new Set(features.map((feature) => feature.id)).size !== features.length) throw new Error("Duplicate feature identifiers.");
    const fingerprint = createHash("sha256").update(canonical({ destination: p.destination, features: features.map(({ geometry, properties }) => ({ geometry, properties: Object.fromEntries(Object.entries(properties || {}).filter(([key]) => key !== "landos_source_filename")) })) })).digest("hex");
    const table = p.destination === "property" ? "land_parcels" : "spatial_layers";
    const { data: duplicate, error: duplicateError } = await c.client.from(table).select("id").eq("workspace_id", c.workspaceId).eq("metadata->>landos_import_fingerprint", fingerprint).maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) return json({ id: duplicate.id, destination: p.destination, already_saved: true });
    const metadata = { landos_import_fingerprint: fingerprint, landos_import_id: p.id, source_file: p.sourceFile, source_type: "user import", description: p.description, ...(p.destination === "research" ? { research_subtype: p.subtype } : {}) };
    if (p.destination === "property") {
      const polygons: MultiPolygon["coordinates"] = [];
      for (const feature of features) {
        if (feature.geometry.type === "Polygon") polygons.push(feature.geometry.coordinates);
        else if (feature.geometry.type === "MultiPolygon") polygons.push(...feature.geometry.coordinates);
        else throw new Error("A property import can contain polygon geometry only. Import other features as a custom layer.");
      }
      const geometry: MultiPolygon = { type: "MultiPolygon", coordinates: polygons };
      const centroid = propertyCentroid(geometry);
      if (!centroid) throw new Error("Property polygons must have a valid non-zero area.");
      const { data: existing, error: lookupError } = await c.client.from("land_parcels").select("id,metadata,created_by").eq("workspace_id", c.workspaceId).eq("id", p.id).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing && existing.metadata?.landos_import_id !== p.id) throw new Error("The import identifier is already in use.");
      const { error } = await c.client.from("land_parcels").upsert({ id: p.id, workspace_id: c.workspaceId, title: p.name, notes: p.description || null, geometry, latitude: centroid[1], longitude: centroid[0], hectares: geometryMeasurement(geometry).areaM2 / 10000, source: "User import", created_by: existing?.created_by || c.user.id, metadata: { ...metadata, imported_features: features, area_method: "calculated_geojson" } }, { onConflict: "id" });
      if (error) throw error;
    } else {
      const { data: existing, error: lookupError } = await c.client.from("spatial_layers").select("id,name,layer_kind,metadata,geojson,created_by").eq("workspace_id", c.workspaceId).eq("id", p.id).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing && existing.metadata?.landos_import_id !== p.id) {
        const previous = existing.geojson as FeatureCollection | null;
        const recoverable = existing.created_by === c.user.id && existing.name === p.name && existing.layer_kind === "geojson" && previous?.features?.length === features.length && previous.features.every((feature, index) => canonical(feature) === canonical(features[index]));
        if (!recoverable) throw new Error("The import identifier is already in use.");
      }
      const { error } = await c.client.rpc("save_spatial_import", { p_workspace: c.workspaceId, p_id: p.id, p_name: p.name, p_geojson: { type: "FeatureCollection", features }, p_kind: p.destination === "research" ? "research_area" : "geojson", p_metadata: metadata });
      if (error) throw error;
    }
    return json({ id: p.id, destination: p.destination });
  } catch (error) { return apiError(error); }
}

import { z } from "zod";
import type { Feature, FeatureCollection } from "geojson";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json } from "@/lib/api";
import { validCollection } from "@/lib/map/drawing";
import { propertyGeometry } from "@/lib/planning/geometry";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const c = await workspaceContext(); const id = z.uuid().parse((await params).id);
    const { data, error } = await c.client.from("land_parcels").select("title,geometry,metadata").eq("workspace_id", c.workspaceId).eq("id", id).single();
    if (error || !data) throw new Error("Property unavailable in this Workspace.");
    const imported = data.metadata?.imported_features;
    if (Array.isArray(imported)) { const collection = { type: "FeatureCollection" as const, features: imported as Feature[] }; if (validCollection(collection)) return json({ features: collection.features }); }
    const geometry = propertyGeometry(data.geometry); if (!geometry) throw new Error("Property geometry unavailable.");
    const parts = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    const collection: FeatureCollection = { type: "FeatureCollection", features: parts.map((coordinates, index) => ({ type: "Feature", geometry: { type: "Polygon", coordinates }, properties: { name: `${data.title} ${index + 1}` } })) };
    return json({ features: collection.features });
  } catch (error) { return apiError(error); }
}

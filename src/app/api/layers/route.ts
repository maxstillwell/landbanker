import { validCollection } from "@/lib/map/drawing";
import type { FeatureCollection } from "geojson";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json, sameOrigin } from "@/lib/api";
const inputSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(160),
  geojson: z.object({
    type: z.literal("FeatureCollection"),
    features: z.array(z.record(z.string(), z.unknown())).max(5000),
  }),
});
export async function GET(request: NextRequest) {
  try {
    const c = await workspaceContext();
    const id = z.uuid().parse(request.nextUrl.searchParams.get("id"));
    const featureParam = request.nextUrl.searchParams.get("feature");
    if (featureParam) {
      const featureId = z.string().min(1).max(200).parse(featureParam);
      if (z.uuid().safeParse(featureId).success) {
        const { data: row, error } = await c.client.from("spatial_features").select("feature").eq("workspace_id", c.workspaceId).eq("layer_id", id).eq("id", featureId).maybeSingle();
        if (error) throw error;
        if (row) return json({ feature: row.feature });
      }
      const { data: legacy, error: legacyError } = await c.client.from("spatial_layers").select("geojson").eq("workspace_id", c.workspaceId).eq("id", id).single();
      if (legacyError) throw legacyError;
      const feature = (legacy.geojson as FeatureCollection | null)?.features.find((item) => String(item.id) === featureId);
      if (!feature) throw new Error("Feature unavailable in this Workspace");
      return json({ feature });
    }
    if (request.nextUrl.searchParams.get("list") === "1") {
      const offset = z.coerce.number().int().min(0).max(5000).default(0).parse(request.nextUrl.searchParams.get("offset") ?? undefined);
      const { data: parent, error: parentError } = await c.client.from("spatial_layers").select("id,name,layer_kind,metadata").eq("workspace_id", c.workspaceId).eq("id", id).single();
      if (parentError || !parent) throw new Error("Layer unavailable in this Workspace");
      const { data: rows, error } = await c.client.from("spatial_features").select("id,feature").eq("workspace_id", c.workspaceId).eq("layer_id", id).order("id").range(offset, offset + 50);
      if (error) throw error;
      if (rows?.length) return json({ features: rows.slice(0, 50).map((row) => row.feature), hasMore: rows.length > 50, layer: parent });
      // Legacy layers can predate normalized feature rows. Return only the
      // requested page and never mutate their stored geometry or identifiers.
      const { data: legacy, error: legacyError } = await c.client.from("spatial_layers").select("geojson").eq("workspace_id", c.workspaceId).eq("id", id).single();
      if (legacyError) throw legacyError;
      const features = (legacy.geojson as FeatureCollection | null)?.features || [];
      return json({ features: features.slice(offset, offset + 50), hasMore: features.length > offset + 50, layer: parent });
    }
    const { data, error } = await c.client
      .from("spatial_layers")
      .select("id,workspace_id,name,layer_kind,geojson,layer_data")
      .eq("workspace_id", c.workspaceId)
      .eq("id", id)
      .single();
    if (error) throw error;
    return json({ layer: data });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    if (Number(request.headers.get("content-length") || 0) > 3e6)
      throw new Error("Layer too large");
    const text = await request.text();
    if (text.length > 3e6) throw new Error("Layer too large");
    const input = inputSchema.parse(JSON.parse(text));
    const collection = input.geojson as unknown as FeatureCollection;
    if (!validCollection(collection))
      throw new Error("Invalid geometry or coordinates");
    const ids = new Set<string>();
    collection.features = collection.features.map((feature) => {
      const id = z.uuid().safeParse(feature.id).success
        ? String(feature.id)
        : randomUUID();
      if (ids.has(id)) throw new Error("Duplicate feature identity");
      ids.add(id);
      return { ...feature, id };
    });
    const { error } = await c.client.rpc("save_layer_features", {
      p_workspace: c.workspaceId,
      p_id: input.id,
      p_name: input.name,
      p_geojson: collection,
    });
    if (error) throw error;
    const { data, error: readError } = await c.client
      .from("spatial_layers")
      .select("*")
      .eq("workspace_id", c.workspaceId)
      .eq("id", input.id)
      .single();
    if (readError) throw readError;
    return json({ layer: data });
  } catch (e) {
    return apiError(e);
  }
}

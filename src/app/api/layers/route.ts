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

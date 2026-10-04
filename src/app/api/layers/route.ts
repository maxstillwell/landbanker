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
    const { data, error } = await c.client
      .from("spatial_layers")
      .upsert(
        {
          ...input,
          workspace_id: c.workspaceId,
          layer_kind: "geojson",
          created_by: c.user.id,
        },
        { onConflict: "id" },
      )
      .select()
      .single();
    if (error) throw error;
    return json({ layer: data });
  } catch (e) {
    return apiError(e);
  }
}

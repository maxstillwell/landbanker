import { savedViewInput } from "@/lib/map/view-input";
import type { NextRequest } from "next/server";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json, sameOrigin } from "@/lib/api";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    const input = savedViewInput.parse(await request.json());
    for (const [table, ids] of [
      ["land_parcels", input.view.parcel_ids],
      ["spatial_layers", input.view.layer_ids],
    ] as const) {
      if (!ids.length) continue;
      const { data, error } = await c.client
        .from(table)
        .select("id")
        .eq("workspace_id", c.workspaceId)
        .in("id", ids);
      if (error || data?.length !== new Set(ids).size)
        throw new Error("View contains unavailable Workspace resources");
    }
    if (input.view.official_layers.length) {
      const { data, error } = await c.client
        .from("layer_catalog")
        .select("id")
        .eq("enabled", true)
        .in(
          "id",
          input.view.official_layers.map((l) => l.catalog_id),
        );
      if (
        error ||
        data?.length !==
          new Set(input.view.official_layers.map((l) => l.catalog_id)).size
      )
        throw new Error("View contains unavailable official layers");
    }
    const { error } = await c.client
      .from("saved_views")
      .upsert({ ...input, workspace_id: c.workspaceId, created_by: c.user.id });
    if (error) throw error;
    return json({ saved: true });
  } catch (e) {
    return apiError(e);
  }
}

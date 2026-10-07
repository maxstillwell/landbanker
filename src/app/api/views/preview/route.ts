import type { NextRequest } from "next/server";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json, sameOrigin } from "@/lib/api";
import { savedViewInput } from "@/lib/map/view-input";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    const { view } = savedViewInput
      .pick({ view: true })
      .parse(await request.json());
    for (const [table, ids] of [
      ["land_parcels", view.parcel_ids],
      ["spatial_layers", view.layer_ids],
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
    const officialIds = [
      ...new Set(view.official_layers.map((layer) => layer.catalog_id)),
    ];
    if (officialIds.length) {
      const { data, error } = await c.client
        .from("layer_catalog")
        .select("id")
        .eq("enabled", true)
        .in("id", officialIds);
      if (error || data?.length !== officialIds.length)
        throw new Error("View contains unavailable official layers");
    }
    const features = view.layer_ids.length
      ? await c.client
          .from("spatial_features")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", c.workspaceId)
          .in("layer_id", view.layer_ids)
      : { count: 0, error: null };
    if (features.error) throw features.error;
    return json({
      parcels: new Set(view.parcel_ids).size,
      user_layers: new Set(view.layer_ids).size,
      official_layers: officialIds.length,
      features: features.count || 0,
      feature_scope:
        "All features in referenced user layers, including off-screen. A personal View is a live reference; public sharing freezes scope separately.",
      private_observations: "not_copied",
      private_notes: "not_copied",
      private_media: "not_copied",
    });
  } catch (error) {
    return apiError(error);
  }
}

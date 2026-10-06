import type { NextRequest } from "next/server";
import { z } from "zod";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json, sameOrigin } from "@/lib/api";
import { newShareToken, tokenHash } from "@/lib/sharing";
import { appUrl } from "@/lib/config";
const inputSchema = z.object({
  resource_type: z.enum([
    "parcel",
    "parcels",
    "spatial_layer",
    "saved_view",
    "subset",
  ]),
  resource_ids: z.array(z.uuid()).min(1).max(100),
  days: z.number().int().min(1).max(30).default(7),
});
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    if (!["owner", "admin"].includes(c.role))
      throw new Error("Manager access required");
    const input = inputSchema.parse(await request.json());
    if (input.resource_type === "subset")
      throw new Error(
        "Map subsets require an explicit resource manifest; not yet enabled",
      );
    if (input.resource_type === "saved_view" && input.resource_ids.length !== 1)
      throw new Error("Share one Saved View at a time");
    let manifest: Record<string, unknown> = {};
    if (input.resource_type === "saved_view") {
      const { data: view, error } = await c.client
        .from("saved_views")
        .select("name,view")
        .eq("workspace_id", c.workspaceId)
        .eq("id", input.resource_ids[0])
        .single();
      if (error) throw error;
      const scope = z
        .object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          zoom: z.number().min(1).max(20),
          parcel_ids: z.array(z.uuid()).max(100),
          layer_ids: z.array(z.uuid()).max(100),
          official_layers: z
            .array(
              z.object({
                catalog_id: z.string().max(100),
                visible: z.boolean(),
                opacity: z.number().min(0).max(1),
                position: z.number().int(),
              }),
            )
            .max(30),
        })
        .parse(view.view);
      const [parcels, layers] = await Promise.all([
        c.client
          .from("land_parcels")
          .select("id")
          .eq("workspace_id", c.workspaceId)
          .in("id", scope.parcel_ids),
        c.client
          .from("spatial_layers")
          .select("id,geojson")
          .eq("workspace_id", c.workspaceId)
          .in("id", scope.layer_ids),
      ]);
      if (
        parcels.error ||
        layers.error ||
        parcels.data?.length !== new Set(scope.parcel_ids).size ||
        layers.data?.length !== new Set(scope.layer_ids).size
      )
        throw new Error("Saved View contains unavailable resources");
      manifest = {
        ...scope,
        name: view.name,
        official_layers: scope.official_layers.filter((l) => l.visible),
        feature_ids: Object.fromEntries(
          (layers.data || []).map((l) => [
            l.id,
            (l.geojson?.features || [])
              .map((f: { id?: string }) => f.id)
              .filter(Boolean),
          ]),
        ),
      };
    }
    const table =
      input.resource_type === "saved_view"
        ? "saved_views"
        : input.resource_type === "spatial_layer"
          ? "spatial_layers"
          : "land_parcels";
    const { data, error } = await c.client
      .from(table)
      .select("id")
      .eq("workspace_id", c.workspaceId)
      .in("id", input.resource_ids);
    if (error || data?.length !== new Set(input.resource_ids).size)
      throw new Error("Invalid resource selection");
    const token = newShareToken();
    const { data: link, error: e } = await c.client
      .from("share_links")
      .insert({
        workspace_id: c.workspaceId,
        created_by: c.user.id,
        token_hash: tokenHash(token),
        resource_type: input.resource_type,
        resource_ids: input.resource_ids,
        manifest,
        expires_at: new Date(Date.now() + input.days * 86400000).toISOString(),
      })
      .select("id,expires_at")
      .single();
    if (e) throw e;
    return json({ ...link, url: `${appUrl()}/share/${token}` });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    const { id } = z.object({ id: z.uuid() }).parse(await request.json());
    const { error } = await c.client
      .from("share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace_id", c.workspaceId);
    if (error) throw error;
    return json({ revoked: true });
  } catch (e) {
    return apiError(e);
  }
}

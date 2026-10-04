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
    if (["saved_view", "subset"].includes(input.resource_type))
      throw new Error(
        "Map subsets require an explicit resource manifest; not yet enabled",
      );
    const table =
      input.resource_type === "spatial_layer"
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

import { z } from "zod";
import type { NextRequest } from "next/server";
import { workspaceContext } from "@/lib/workspace";
import { json, apiError, sameOrigin } from "@/lib/api";
import { canUseLayer, type Tier } from "@/lib/capabilities";
const input = z.object({
  id: z.string().min(1).max(100),
  action: z.enum(["save", "remove"]),
  visible: z.boolean().default(true),
  opacity: z.number().min(0).max(1).default(0.65),
  position: z.number().int().min(0).max(100).default(0),
});
export async function GET() {
  try {
    const c = await workspaceContext();
    const [catalog, active] = await Promise.all([
      c.client.from("layer_catalog").select("*").order("state").order("name"),
      c.client
        .from("active_map_layers")
        .select("*")
        .eq("workspace_id", c.workspaceId)
        .eq("user_id", c.user.id)
        .order("position"),
    ]);
    if (catalog.error) throw catalog.error;
    if (active.error) throw active.error;
    return json({ catalog: catalog.data, active: active.data });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext(),
      p = input.parse(await request.json());
    if (p.action === "remove") {
      const { error } = await c.client
        .from("active_map_layers")
        .delete()
        .eq("workspace_id", c.workspaceId)
        .eq("user_id", c.user.id)
        .eq("catalog_id", p.id);
      if (error) throw error;
      return json({ ok: true });
    }
    const { data: layer, error } = await c.client
      .from("layer_catalog")
      .select("premium_tier,enabled")
      .eq("id", p.id)
      .single();
    if (error) throw error;
    if (!layer.enabled) throw new Error("Layer unavailable");
    const { data: entitlement, error: entitlementError } = await c.client
      .from("workspace_entitlements")
      .select("tier")
      .eq("workspace_id", c.workspaceId)
      .maybeSingle();
    if (entitlementError) throw entitlementError;
    if (
      !canUseLayer(
        c.role,
        (entitlement?.tier || "free") as Tier,
        layer.premium_tier,
      )
    )
      throw new Error("Layer requires a Pro workspace");
    const { error: saveError } = await c.client
      .from("active_map_layers")
      .upsert({
        workspace_id: c.workspaceId,
        user_id: c.user.id,
        catalog_id: p.id,
        visible: p.visible,
        opacity: p.opacity,
        position: p.position,
        updated_at: new Date().toISOString(),
      });
    if (saveError) throw saveError;
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    const { ids } = z
      .object({
        ids: z
          .array(z.string().min(1).max(100))
          .max(100)
          .refine((ids) => new Set(ids).size === ids.length),
      })
      .parse(await request.json());
    const { data, error } = await c.client
      .from("active_map_layers")
      .select("catalog_id,visible,opacity")
      .eq("workspace_id", c.workspaceId)
      .eq("user_id", c.user.id);
    if (error) throw error;
    if (
      data?.length !== ids.length ||
      data.some((item) => !ids.includes(item.catalog_id))
    )
      throw new Error("Layer list changed. Refresh and try again.");
    if (!ids.length) return json({ ok: true });
    const { error: saveError } = await c.client
      .from("active_map_layers")
      .upsert(
        ids.map((id, position) => ({
          ...data.find((item) => item.catalog_id === id)!,
          workspace_id: c.workspaceId,
          user_id: c.user.id,
          position,
          updated_at: new Date().toISOString(),
        })),
      );
    if (saveError) throw saveError;
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

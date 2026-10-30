import { workspaceContext } from "@/lib/workspace";
import { apiError, json } from "@/lib/api";
import { canUseLayer, type Tier } from "@/lib/capabilities";
import { layerProduct } from "@/lib/layers/products";
import { queryProduct, viewportInput } from "@/lib/layers/query";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const c = await workspaceContext();
    const { id } = await params;
    const product = layerProduct(id);
    if (!product?.enabled) throw new Error("Layer unavailable");
    const { data: layer, error } = await c.client
      .from("layer_catalog")
      .select("enabled,premium_tier")
      .eq("id", id)
      .single();
    if (error || !layer?.enabled) throw new Error("Layer unavailable");
    const { data: entitlement, error: tierError } = await c.client
      .from("workspace_entitlements")
      .select("tier")
      .eq("workspace_id", c.workspaceId)
      .maybeSingle();
    if (tierError) throw tierError;
    if (
      !canUseLayer(
        c.role,
        (entitlement?.tier || "free") as Tier,
        layer.premium_tier,
      )
    )
      throw new Error("Layer requires a Pro workspace");
    const p = new URL(request.url).searchParams;
    const parsed = viewportInput.safeParse({
      bbox: (p.get("bbox") || "").split(",").map(Number),
      zoom: Number(p.get("zoom")),
      period: p.get("period") || undefined,
      indicator: p.get("indicator") || undefined,
      point: p.has("point")
        ? p.get("point")!.split(",").map(Number)
        : undefined,
    });
    if (!parsed.success)
      throw new Error(
        "Invalid viewport or area too large. Zoom in to load this layer.",
      );
    return json(await queryProduct(product, parsed.data));
  } catch (e) {
    return apiError(e);
  }
}

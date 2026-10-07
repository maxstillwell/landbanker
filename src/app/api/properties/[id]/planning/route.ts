import { z } from "zod";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json } from "@/lib/api";
import { queryPropertyPlanning } from "@/lib/planning/query";
import type { CatalogLayer } from "@/lib/map/catalog-types";
export const maxDuration = 60;
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const c = await workspaceContext();
    const id = z.uuid().parse((await params).id);
    // Authorize the saved Property before any external query. User credential and RLS remain authoritative.
    const { data: property, error } = await c.client
      .from("land_parcels")
      .select("id,state,geometry")
      .eq("workspace_id", c.workspaceId)
      .eq("id", id)
      .single();
    if (error || !property)
      throw new Error("Property unavailable in this Workspace");
    const { data: catalog, error: catalogError } = await c.client
      .from("layer_catalog")
      .select("*")
      .eq("enabled", true)
      .eq("state", property.state || "")
      .order("id");
    if (catalogError) throw catalogError;
    return json(
      await queryPropertyPlanning(property, (catalog || []) as CatalogLayer[]),
    );
  } catch (error) {
    return apiError(error);
  }
}

import { z } from "zod";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json, sameOrigin } from "@/lib/api";
import { propertyGeometry } from "@/lib/planning/geometry";
import { propertyCentroid } from "@/lib/planning/centroid";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const c = await workspaceContext();
    const id = z.uuid().parse((await params).id);
    const { data, error } = await c.client
      .from("land_parcels")
      .select(
        "id,workspace_id,title,address,state,geometry,latitude,longitude,hectares,status,notes,source,source_parcel_id,saved_at,source_updated_at,source_url:metadata->>source_url,lot:metadata->>lot,plan:metadata->>plan,retrieved_at:metadata->>retrieved_at",
      )
      .eq("workspace_id", c.workspaceId)
      .eq("id", id)
      .single();
    if (error || !data)
      throw new Error("Property unavailable in this Workspace");
    const shape = propertyGeometry(data.geometry);
    return json({
      property: {
        ...data,
        metadata: {},
        centroid: shape ? propertyCentroid(shape) : null,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: import("next/server").NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request); const c = await workspaceContext();
    if (!["owner", "admin", "editor"].includes(c.role)) throw new Error("Workspace is read-only.");
    const id = z.uuid().parse((await params).id);
    const input = z.object({ title: z.string().trim().min(1).max(160).optional(), notes: z.string().max(20000).nullable().optional() }).refine((value) => value.title !== undefined || value.notes !== undefined).parse(await request.json());
    const { data, error } = await c.client.from("land_parcels").update({ title: input.title }).eq("workspace_id", c.workspaceId).eq("id", id).select("id");
    if (error) throw error; if (!data?.length) throw new Error("Property unavailable.");
    return json({ id });
  } catch (error) { return apiError(error); }
}

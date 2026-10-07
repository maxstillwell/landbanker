import { z } from "zod";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json } from "@/lib/api";
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

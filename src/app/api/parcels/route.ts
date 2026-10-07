import type { NextRequest } from "next/server";
import { z } from "zod";
import { workspaceContext } from "@/lib/workspace";
import { json, apiError, sameOrigin } from "@/lib/api";
import { lookupOfficialParcels } from "@/lib/map/official-parcels";
import { parcelPoint } from "@/lib/map/parcel-input";
import { mappedId } from "@/lib/import/transform";
const input = parcelPoint.extend({ sourceId: z.string().max(100) });
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    if (!["owner", "admin", "editor"].includes(c.role))
      throw new Error("Workspace is read-only");
    const p = input.parse(await request.json());
    const parcel = (await lookupOfficialParcels(p)).find(
      (x) => x.sourceId === p.sourceId,
    );
    if (!parcel)
      throw new Error(
        "Official parcel could not be verified at this location.",
      );
    const id = mappedId(
      c.workspaceId,
      "official_parcel",
      `${p.state}:${p.sourceId}`,
    );
    const { error } = await c.client.from("land_parcels").upsert(
      {
        id,
        workspace_id: c.workspaceId,
        title:
          parcel.address ||
          `Lot ${parcel.lot || ""} ${parcel.plan || parcel.sourceId}`,
        address: parcel.address || null,
        state: p.state,
        source: parcel.source,
        source_parcel_id: parcel.sourceId,
        source_updated_at: parcel.sourceUpdatedAt,
        latitude: parcel.latitude,
        longitude: parcel.longitude,
        geometry: parcel.geometry,
        hectares: parcel.areaM2 / 10000,
        created_by: c.user.id,
        metadata: {
          lot: parcel.lot,
          plan: parcel.plan,
          source_url: parcel.sourceUrl,
          retrieved_at: parcel.retrievedAt,
          area_method: "calculated_geojson",
        },
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (error) throw error;
    const { data, error: readError } = await c.client
      .from("land_parcels")
      .select("*")
      .eq("workspace_id", c.workspaceId)
      .eq("id", id)
      .single();
    if (readError) throw readError;
    return json({ parcel: data });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    if (!["owner", "admin"].includes(c.role))
      throw new Error("Only Workspace owners/admins can remove properties.");
    const id = z.uuid().parse(request.nextUrl.searchParams.get("id"));
    const { data, error } = await c.client
      .from("land_parcels")
      .delete()
      .eq("workspace_id", c.workspaceId)
      .eq("id", id)
      .select("id");
    if (error?.code === "23503")
      throw new Error(
        "This property has linked records. Preserve or relink those records before removing it.",
      );
    if (error) throw error;
    if (!data?.length)
      throw new Error("Property is unavailable in this Workspace.");
    return json({ removed: id });
  } catch (e) {
    return apiError(e);
  }
}

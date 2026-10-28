import { z } from "zod";
import type { NextRequest } from "next/server";
import type { MultiPolygon } from "geojson";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json, sameOrigin } from "@/lib/api";
import { lookupOfficialParcels } from "@/lib/map/official-parcels";
import { parcelPoint } from "@/lib/map/parcel-input";
import { propertyGeometry } from "@/lib/planning/geometry";
import { isLocationGeometry } from "@/lib/map/location-geometry";

const candidate = parcelPoint.extend({ sourceId: z.string().min(1).max(100) });
const input = z.object({ confirmed: z.literal(true), candidates: z.array(candidate).min(1).max(10) });

// The browser supplies only identifiers and lookup points. Re-fetch every
// boundary from the authoritative provider before associating it.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const context = await workspaceContext();
    if (!["owner", "admin", "editor"].includes(context.role)) throw new Error("Workspace is read-only");
    const id = z.uuid().parse((await params).id);
    const { candidates } = input.parse(await request.json());
    if (new Set(candidates.map((p) => `${p.state}:${p.sourceId}`)).size !== candidates.length) throw new Error("Duplicate parcels are not permitted");
    const { data: original, error: readError } = await context.client.from("land_parcels").select("id,geometry,metadata").eq("workspace_id", context.workspaceId).eq("id", id).single();
    if (readError || !original) throw new Error("Property unavailable in this Workspace");
    if (original.geometry !== null && !isLocationGeometry(original.geometry)) throw new Error("This property already has stored boundary or unsupported geometry. It cannot be replaced by this action.");
    const metadata = original.metadata;
    if (metadata !== null && (typeof metadata !== "object" || Array.isArray(metadata))) throw new Error("The property's existing metadata cannot safely be updated.");
    if (metadata && Object.hasOwn(metadata, "landos_boundary_association_v1")) throw new Error("An existing boundary association must be reviewed before changing this property.");
    const verified = [];
    for (const p of candidates) {
      const match = (await lookupOfficialParcels(p)).find((item) => item.sourceId === p.sourceId && item.state === p.state);
      if (!match || !propertyGeometry(match.geometry)) throw new Error("An official candidate could not be verified. Search again before saving.");
      verified.push(match);
    }
    const geometry: MultiPolygon = { type: "MultiPolygon", coordinates: verified.flatMap((p) => p.geometry.type === "Polygon" ? [p.geometry.coordinates] : p.geometry.coordinates) };
    if (!propertyGeometry(geometry)) throw new Error("The selected boundaries cannot be saved as a valid property geometry.");
    // Keep all existing metadata, and use an optimistic predicate so a
    // concurrent metadata edit cannot be overwritten by the association.
    const updatedMetadata = { ...(metadata || {}), landos_boundary_association_v1: { original_geometry: original.geometry, parcels: verified.map((p) => ({ state: p.state, sourceId: p.sourceId, source: p.source, sourceUrl: p.sourceUrl, retrievedAt: p.retrievedAt, sourceUpdatedAt: p.sourceUpdatedAt })) } };
    let update = context.client.from("land_parcels").update({ geometry, metadata: updatedMetadata }).eq("workspace_id", context.workspaceId).eq("id", id);
    update = original.geometry === null ? update.is("geometry", null) : update.eq("geometry", JSON.stringify(original.geometry));
    update = metadata === null ? update.is("metadata", null) : update.eq("metadata", JSON.stringify(metadata));
    const { data, error } = await update.select("id").maybeSingle();
    if (error || !data) throw new Error("Property changed before the boundary could be saved. Refresh and review it again.");
    return json({ associated: true });
  } catch (error) { return apiError(error); }
}

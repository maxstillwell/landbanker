import type { NextRequest } from "next/server";
import type { Geometry } from "geojson";
import { z } from "zod";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json } from "@/lib/api";
import { intersectsViewport, type Bbox } from "@/lib/map/viewport";
import { signedMediaUrls } from "@/lib/media-url-cache";
import { propertyGeometry } from "@/lib/planning/geometry";
import { propertyCentroid } from "@/lib/planning/centroid";
type Event = {
  revision: string;
  kind: "parcels" | "observations" | "features" | "layers";
  id: string;
  operation: "upsert" | "delete";
};
const cursor = z
  .string()
  .regex(/^(0|[1-9]\d{0,18})$/)
  .refine((v) => BigInt(v) <= 9223372036854775807n);
export async function GET(request: NextRequest) {
  try {
    const c = await workspaceContext(),
      p = request.nextUrl.searchParams;
    if (
      p.has("workspace") &&
      z.uuid().parse(p.get("workspace")) !== c.workspaceId
    )
      throw new Error("Sync Workspace changed");
    const after = p.has("after") ? cursor.parse(p.get("after")) : null,
      until = p.has("until") ? cursor.parse(p.get("until")) : null;
    const bounds = p.has("bbox")
      ? (z
          .tuple([
            z.number().min(-180).max(180),
            z.number().min(-90).max(90),
            z.number().min(-180).max(180),
            z.number().min(-90).max(90),
          ])
          .refine((b) => b[0] < b[2] && b[1] < b[3])
          .parse(p.get("bbox")!.split(",").map(Number)) as Bbox)
      : null;
    const { data, error } = await c.client.rpc("landos_workspace_changes", {
      p_workspace: c.workspaceId,
      p_after: after,
      p_until: until,
      p_limit: 100,
    });
    if (error) throw error;
    const events = data.events as Event[];
    const latest = [
      ...new Map(events.map((e) => [`${e.kind}:${e.id}`, e])).values(),
    ];
    const changes: {
      kind: Event["kind"];
      id: string;
      operation: "upsert" | "delete";
      row?: unknown;
      viewport_only?: boolean;
    }[] = [];
    for (const kind of ["parcels", "observations", "features"] as const) {
      const list = latest.filter((e) => e.kind === kind),
        ids = list.filter((e) => e.operation === "upsert").map((e) => e.id);
      let rows: {
        id: string;
        geometry?: Geometry;
        feature?: { geometry: Geometry };
        latitude?: number;
        longitude?: number;
        field_observation_media?: {
          storage_path: string | null;
          upload_status: string;
          url?: string;
        }[];
      }[] = [];
      if (ids.length) {
        const table =
          kind === "parcels"
            ? "land_parcels"
            : kind === "observations"
              ? "field_observations"
              : "spatial_features";
        const fields =
          kind === "parcels"
            ? "id,workspace_id,title,address,state,geometry,latitude,longitude,hectares,status,source,source_parcel_id,saved_at,notes,source_updated_at,source_url:metadata->>source_url,lot:metadata->>lot,plan:metadata->>plan,retrieved_at:metadata->>retrieved_at"
            : kind === "observations"
              ? "id,workspace_id,title,notes,latitude,longitude,observed_at,linked_parcel_id,field_observation_media(id,workspace_id,observation_id,storage_path,mime_type,original_filename,captured_at,upload_status)"
              : "id,workspace_id,layer_id,feature";
        const result = await c.client
          .from(table)
          .select(fields)
          .eq("workspace_id", c.workspaceId)
          .in("id", ids);
        if (result.error) throw result.error;
        rows = (result.data || []) as unknown as typeof rows;
      }
      if (kind === "observations") {
        const urls = await signedMediaUrls(
          c.client,
          `${c.user.id}:${c.workspaceId}`,
          rows.flatMap((o) =>
            (o.field_observation_media || [])
              .filter((m) => m.storage_path && m.upload_status === "uploaded")
              .map((m) => m.storage_path!),
          ),
        );
        for (const row of rows)
          for (const media of row.field_observation_media || [])
            if (media.storage_path) media.url = urls.get(media.storage_path);
      }
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const event of list) {
        const row = byId.get(event.id),
          geometry =
            row?.geometry ||
            row?.feature?.geometry ||
            (row?.latitude != null && row.longitude != null
              ? {
                  type: "Point" as const,
                  coordinates: [row.longitude, row.latitude],
                }
              : null);
        changes.push(
          row &&
            event.operation === "upsert" &&
            (!bounds || intersectsViewport(geometry, bounds))
            ? {
                kind,
                id: event.id,
                operation: "upsert",
                row: {
                  ...row,
                  metadata: {},
                  ...(kind === "parcels"
                    ? {
                        centroid: propertyGeometry(row.geometry)
                          ? propertyCentroid(propertyGeometry(row.geometry)!)
                          : null,
                      }
                    : {}),
                },
              }
            : {
                kind,
                id: event.id,
                operation: "delete",
                viewport_only: Boolean(row && event.operation === "upsert"),
              },
        );
      }
    }
    const layerEvents = latest.filter((e) => e.kind === "layers");
    const layerIds = layerEvents
      .filter((e) => e.operation === "upsert")
      .map((e) => e.id);
    const layerRows = layerIds.length
      ? await c.client
          .from("spatial_layers")
          .select("id,workspace_id,name,layer_kind,layer_data")
          .eq("workspace_id", c.workspaceId)
          .in("id", layerIds)
      : { data: [], error: null };
    if (layerRows.error) throw layerRows.error;
    for (const e of layerEvents) {
      const row = layerRows.data?.find((r) => r.id === e.id);
      changes.push({
        kind: "layers",
        id: e.id,
        operation: row && e.operation === "upsert" ? "upsert" : "delete",
        row: row
          ? {
              ...row,
              geojson: null,
              metadata: {},
              layer_data: row.layer_kind === "radius" ? row.layer_data : {},
            }
          : undefined,
      });
    }
    return json({
      workspace_id: c.workspaceId,
      changes,
      cursor: data.cursor,
      watermark: data.watermark,
      has_more: data.has_more,
    });
  } catch (error) {
    return apiError(error);
  }
}

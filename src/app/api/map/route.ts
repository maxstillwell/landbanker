import type { NextRequest } from "next/server";
import { z } from "zod";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json } from "@/lib/api";
import { MAP_PAGE_SIZE } from "@/lib/map/data-pages";
import type { Parcel, SpatialLayer } from "@/lib/types";
import { signedMediaUrls } from "@/lib/media-url-cache";
const paging = z.coerce.number().int().min(0).max(99);
const bbox = z
  .tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ])
  .refine((b) => b[0] < b[2] && b[1] < b[3]);
export async function GET(request: NextRequest) {
  try {
    const { client, workspaceId, user } = await workspaceContext();
    const page = paging.parse(request.nextUrl.searchParams.get("page") || 0),
      start = page * MAP_PAGE_SIZE;
    const overview = request.nextUrl.searchParams.get("overview") === "1";
    const box = request.nextUrl.searchParams.get("bbox");
    const bounds = box ? bbox.parse(box.split(",").map(Number)) : null;
    let parcels = client
      .from("land_parcels")
      .select(
        (overview
          ? "id,workspace_id,title,address,state,latitude,longitude,hectares,status,source,source_parcel_id,saved_at,notes,source_updated_at,source_url:metadata->>source_url,lot:metadata->>lot,plan:metadata->>plan,retrieved_at:metadata->>retrieved_at"
          : "id,workspace_id,title,address,state,latitude,longitude,geometry,hectares,status,source,source_parcel_id,saved_at,notes,source_updated_at,source_url:metadata->>source_url,lot:metadata->>lot,plan:metadata->>plan,retrieved_at:metadata->>retrieved_at") as string,
      )
      .eq("workspace_id", workspaceId)
      .order("id")
      .range(start, start + MAP_PAGE_SIZE);
    let observations = client
      .from("field_observations")
      .select(
        "id,workspace_id,latitude,longitude,title,notes,observed_at,linked_parcel_id,field_observation_media(id,workspace_id,observation_id,storage_path,mime_type,original_filename,captured_at,upload_status)",
      )
      .eq("workspace_id", workspaceId)
      .order("observed_at", { ascending: false })
      .order("id")
      .range(start, start + MAP_PAGE_SIZE);
    // Optional location-point filter, not a substitute for future geometry-intersection index.
    if (bounds) {
      parcels = parcels
        .gte("longitude", bounds[0])
        .lte("longitude", bounds[2])
        .gte("latitude", bounds[1])
        .lte("latitude", bounds[3]);
      observations = observations
        .gte("longitude", bounds[0])
        .lte("longitude", bounds[2])
        .gte("latitude", bounds[1])
        .lte("latitude", bounds[3]);
    }
    const [p, o, l, v] = await Promise.all([
      parcels.returns<Parcel[]>(),
      observations,
      client
        .from("spatial_layers")
        .select(
          (overview
            ? "id,workspace_id,name,layer_kind,layer_data"
            : "id,workspace_id,name,layer_kind,geojson,layer_data") as string,
        )
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(start, start + MAP_PAGE_SIZE)
        .returns<SpatialLayer[]>(),
      client
        .from("saved_views")
        .select("id,name,view")
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(start, start + MAP_PAGE_SIZE),
    ]);
    for (const result of [p, o, l, v]) if (result.error) throw result.error;
    const rows = (o.data || []).slice(0, MAP_PAGE_SIZE);
    const paths = [
      ...new Set(
        rows.flatMap((item) =>
          item.field_observation_media
            .filter((m) => m.storage_path && m.upload_status === "uploaded")
            .map((m) => m.storage_path!),
        ),
      ),
    ];
    const signed = await signedMediaUrls(
      client,
      `${user.id}:${workspaceId}`,
      paths,
    );
    return json({
      parcels: (p.data || [])
        .slice(0, MAP_PAGE_SIZE)
        .map((p) => ({ ...p, geometry: p.geometry || null, metadata: {} })),
      observations: rows.map((item) => ({
        ...item,
        metadata: {},
        field_observation_media: item.field_observation_media.map((m) => ({
          ...m,
          metadata: {},
          url: m.storage_path ? signed.get(m.storage_path) : undefined,
        })),
      })),
      layers: (l.data || []).slice(0, MAP_PAGE_SIZE).map((layer) => ({
        ...layer,
        geojson: layer.geojson || null,
        metadata: {},
        layer_data: layer.layer_kind === "radius" ? layer.layer_data : {},
      })),
      savedViews: (v.data || []).slice(0, MAP_PAGE_SIZE),
      pagination: {
        page,
        hasMore: {
          parcels: (p.data?.length || 0) > MAP_PAGE_SIZE,
          observations: (o.data?.length || 0) > MAP_PAGE_SIZE,
          layers: (l.data?.length || 0) > MAP_PAGE_SIZE,
          savedViews: (v.data?.length || 0) > MAP_PAGE_SIZE,
        },
      },
    });
  } catch (e) {
    return apiError(e);
  }
}

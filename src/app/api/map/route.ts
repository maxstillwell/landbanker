import type { NextRequest } from "next/server";
import { z } from "zod";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json } from "@/lib/api";
import { MAP_PAGE_SIZE } from "@/lib/map/data-pages";
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
    const { client, workspaceId } = await workspaceContext();
    const page = paging.parse(request.nextUrl.searchParams.get("page") || 0),
      start = page * MAP_PAGE_SIZE;
    const box = request.nextUrl.searchParams.get("bbox");
    const bounds = box ? bbox.parse(box.split(",").map(Number)) : null;
    let parcels = client
      .from("land_parcels")
      .select(
        "id,workspace_id,title,address,state,latitude,longitude,geometry,hectares,status,source,source_parcel_id,saved_at,notes",
      )
      .eq("workspace_id", workspaceId)
      .order("id")
      .range(start, start + MAP_PAGE_SIZE);
    let observations = client
      .from("field_observations")
      .select(
        "id,workspace_id,latitude,longitude,title,notes,observed_at,field_observation_media(id,workspace_id,observation_id,storage_path,mime_type,original_filename,captured_at,upload_status)",
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
      parcels,
      observations,
      client
        .from("spatial_layers")
        .select("id,workspace_id,name,layer_kind,geojson,layer_data")
        .eq("workspace_id", workspaceId)
        .order("id")
        .range(start, start + MAP_PAGE_SIZE),
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
    const signed = new Map<string, string>();
    // Bound concurrency and batch signing instead of one Storage request for each photo.
    for (let offset = 0; offset < paths.length; offset += 400) {
      const batches = Array.from(
        { length: Math.min(4, Math.ceil((paths.length - offset) / 100)) },
        (_, i) => paths.slice(offset + i * 100, offset + (i + 1) * 100),
      );
      const results = await Promise.all(
        batches.map((batch) =>
          client.storage.from("field-media").createSignedUrls(batch, 300),
        ),
      );
      for (const result of results) {
        if (result.error) throw result.error;
        for (const item of result.data || [])
          if (item.path && item.signedUrl)
            signed.set(item.path, item.signedUrl);
      }
    }
    return json({
      parcels: (p.data || [])
        .slice(0, MAP_PAGE_SIZE)
        .map((p) => ({ ...p, metadata: {} })),
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

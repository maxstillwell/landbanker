import type { NextRequest } from "next/server";
import type { Geometry } from "geojson";
import { z } from "zod";
import { workspaceContext } from "@/lib/workspace";
import { json, apiError } from "@/lib/api";
import { intersectsViewport, type Bbox } from "@/lib/map/viewport";
import { signedMediaUrls } from "@/lib/media-url-cache";
const bbox = z
  .tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ])
  .refine((b) => b[0] < b[2] && b[1] < b[3]);
type Row = {
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
};
export async function GET(request: NextRequest) {
  try {
    const c = await workspaceContext(),
      params = request.nextUrl.searchParams;
    const bounds = bbox.parse(
      (params.get("bbox") || "").split(",").map(Number),
    ) as Bbox;
    const zoom = z.coerce
      .number()
      .int()
      .min(0)
      .max(22)
      .parse(params.get("zoom") || 12);
    const kind = z
      .enum(["parcels", "observations", "features"])
      .parse(params.get("kind") || "parcels");
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .parse(params.get("limit") || 100);
    const cursor = params.get("cursor")
      ? z.uuid().parse(params.get("cursor"))
      : null;
    const updatedSince = params.get("updated_since")
      ? z.iso.datetime({ offset: true }).parse(params.get("updated_since"))
      : null;
    const watermark = new Date().toISOString();
    const { data, error } = await c.client.rpc("landos_viewport_candidates", {
      p_workspace: c.workspaceId,
      p_kind: kind,
      p_bbox: bounds,
      p_limit: 500,
      p_after: cursor,
      p_updated_since: updatedSince,
    });
    if (error) throw error;
    const candidates = (data || []) as Row[],
      rows: Row[] = [];
    let scanned = 0;
    for (const row of candidates) {
      scanned++;
      const geometry =
        row.geometry ||
        row.feature?.geometry ||
        (typeof row.longitude === "number" && typeof row.latitude === "number"
          ? {
              type: "Point" as const,
              coordinates: [row.longitude, row.latitude],
            }
          : null);
      if (intersectsViewport(geometry, bounds)) rows.push(row);
      if (rows.length === limit) break;
    }
    const hasMore = scanned < candidates.length || candidates.length === 500;
    if (kind === "observations") {
      const paths = rows.flatMap((r) =>
        (r.field_observation_media || [])
          .filter((m) => m.upload_status === "uploaded" && m.storage_path)
          .map((m) => m.storage_path!),
      );
      const signed = await signedMediaUrls(
        c.client,
        `${c.user.id}:${c.workspaceId}`,
        paths,
      );
      for (const row of rows)
        for (const media of row.field_observation_media || [])
          if (media.storage_path) media.url = signed.get(media.storage_path);
    }
    return json({
      rows,
      kind,
      bbox: bounds,
      zoom,
      watermark,
      scanned,
      next_cursor: hasMore && scanned ? candidates[scanned - 1].id : null,
    });
  } catch (e) {
    return apiError(e);
  }
}

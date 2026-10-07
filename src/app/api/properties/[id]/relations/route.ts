import type { NextRequest } from "next/server";
import type { Feature } from "geojson";
import { z } from "zod";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json } from "@/lib/api";
import {
  propertyGeometry,
  propertyIntersection,
} from "@/lib/planning/geometry";
import { propertyBounds, nearProperty } from "@/lib/planning/proximity";
import { signedMediaUrls } from "@/lib/media-url-cache";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const c = await workspaceContext();
    const id = z.uuid().parse((await params).id);
    const mode = z
      .enum(["linked", "nearby", "analysis"])
      .parse(request.nextUrl.searchParams.get("mode") || "linked");
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(99)
      .parse(request.nextUrl.searchParams.get("page") || 0);
    const { data: property, error } = await c.client
      .from("land_parcels")
      .select("geometry")
      .eq("id", id)
      .eq("workspace_id", c.workspaceId)
      .single();
    if (error || !property)
      throw new Error("Property unavailable in this Workspace");
    const shape = propertyGeometry(property.geometry);
    if (mode === "analysis") {
      const linked = c.client
        .from("spatial_features")
        .select("id,layer_id,feature")
        .eq("workspace_id", c.workspaceId)
        .eq("feature->properties->>parcel_id", id)
        .order("id")
        .range(page * 100, page * 100 + 100);
      const views = c.client
        .from("saved_views")
        .select("id,name")
        .eq("workspace_id", c.workspaceId)
        .contains("view", { parcel_ids: [id] })
        .order("id")
        .range(page * 100, page * 100 + 100);
      const cursor = request.nextUrl.searchParams.get("cursor");
      if (cursor) z.uuid().parse(cursor);
      const spatial =
        shape && (page === 0 || cursor)
          ? c.client.rpc("landos_viewport_candidates", {
              p_workspace: c.workspaceId,
              p_kind: "features",
              p_bbox: propertyBounds(shape),
              p_limit: 100,
              p_after: cursor || null,
              p_updated_since: null,
            })
          : Promise.resolve({ data: [], error: null });
      const [l, v, s] = await Promise.all([linked, views, spatial]);
      for (const r of [l, v, s]) if (r.error) throw r.error;
      const candidates = (s.data || []) as {
        id: string;
        layer_id: string;
        feature: Feature;
      }[];
      const intersects = candidates.filter(
        (row) =>
          row.feature.properties?.parcel_id !== id &&
          shape &&
          propertyIntersection(shape, row.feature.geometry),
      );
      const projection = (row: {
        id: string;
        layer_id: string;
        feature: Feature;
      }) => ({
        id: row.id,
        layer_id: row.layer_id,
        name: String(row.feature.properties?.name || "Shape").slice(0, 200),
      });
      return json({
        linked: (l.data || []).slice(0, 100).map(projection),
        intersects: intersects.map(projection),
        views: (v.data || []).slice(0, 100),
        next_cursor: candidates.length === 100 ? candidates.at(-1)!.id : null,
        has_more:
          (l.data?.length || 0) > 100 ||
          (v.data?.length || 0) > 100 ||
          candidates.length === 100,
        spatial_supported: Boolean(shape),
      });
    }
    if (mode === "nearby" && !shape)
      return json({
        observations: [],
        has_more: false,
        spatial_supported: false,
      });
    let query = c.client
      .from("field_observations")
      .select(
        "id,workspace_id,title,notes,latitude,longitude,observed_at,linked_parcel_id,field_observation_media(id,workspace_id,observation_id,storage_path,mime_type,original_filename,captured_at,upload_status)",
      )
      .eq("workspace_id", c.workspaceId)
      .order("id")
      .range(page * 100, page * 100 + 100);
    if (mode === "linked") query = query.eq("linked_parcel_id", id);
    else if (shape) {
      const [w, s, e, n] = propertyBounds(shape);
      const dy = 500 / 111195,
        dx = dy / Math.cos((((s + n) / 2) * Math.PI) / 180);
      query = query
        .gte("longitude", w - dx)
        .lte("longitude", e + dx)
        .gte("latitude", s - dy)
        .lte("latitude", n + dy);
    }
    const { data, error: queryError } = await query;
    if (queryError) throw queryError;
    const rows = (data || [])
      .slice(0, 100)
      .filter(
        (o) =>
          mode === "linked" ||
          (shape && nearProperty(shape, [o.longitude, o.latitude])),
      );
    const urls = await signedMediaUrls(
      c.client,
      `${c.user.id}:${c.workspaceId}`,
      rows.flatMap((o) =>
        o.field_observation_media
          .filter((m) => m.storage_path && m.upload_status === "uploaded")
          .map((m) => m.storage_path!),
      ),
    );
    return json({
      observations: rows.map((o) => ({
        ...o,
        metadata: {},
        field_observation_media: o.field_observation_media.map((m) => ({
          ...m,
          metadata: {},
          url: m.storage_path ? urls.get(m.storage_path) : undefined,
        })),
      })),
      has_more: (data?.length || 0) > 100,
      spatial_supported: true,
    });
  } catch (error) {
    return apiError(error);
  }
}

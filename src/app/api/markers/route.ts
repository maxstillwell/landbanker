import type { NextRequest } from "next/server";
import { z } from "zod";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json, sameOrigin } from "@/lib/api";
import {
  markerInput,
  markerFields,
  type WorkspaceMarker,
} from "@/lib/markers/model";
const revision = z.string().datetime({ offset: true });
export async function GET(request: NextRequest) {
  try {
    const c = await workspaceContext();
    let q = c.client
      .from("workspace_markers")
      .select("*")
      .eq("workspace_id", c.workspaceId)
      .is("deleted_at", null)
      .order("id")
      .limit(201);
    const id = request.nextUrl.searchParams.get("id"),
      after = request.nextUrl.searchParams.get("after");
    if (id) q = q.eq("id", z.uuid().parse(id));
    if (after) q = q.gt("id", z.uuid().parse(after));
    for (const [field, param] of [
      ["linked_property_id", "property"],
      ["linked_research_area_id", "research"],
    ] as const) {
      const value = request.nextUrl.searchParams.get(param);
      if (value) q = q.eq(field, z.uuid().parse(value));
    }
    const { data, error } = await q;
    if (error) throw error;
    return json({
      markers: (data || []).slice(0, 200),
      next_cursor: (data?.length || 0) > 200 ? data![199].id : null,
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    if (!["owner", "admin", "editor"].includes(c.role))
      throw new Error("Workspace is read-only.");
    const text = await request.text();
    if (text.length > 12000) throw new Error("Marker is too large.");
    const value = markerInput.parse(JSON.parse(text));
    const { data: existing, error: lookup } = await c.client
      .from("workspace_markers")
      .select("*")
      .eq("workspace_id", c.workspaceId)
      .eq("id", value.id)
      .maybeSingle();
    if (lookup) throw lookup;
    if (existing) {
      if (
        !existing.deleted_at &&
        JSON.stringify(markerFields(existing as WorkspaceMarker)) ===
          JSON.stringify(value)
      )
        return json({ marker: existing });
      throw new Error(
        "Marker already exists. Reload its latest version; your draft is preserved.",
      );
    }
    const { data, error } = await c.client
      .from("workspace_markers")
      .insert({ ...value, workspace_id: c.workspaceId, created_by: c.user.id })
      .select("*")
      .single();
    if (error) throw error;
    return json({ marker: data });
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    if (!["owner", "admin", "editor"].includes(c.role))
      throw new Error("Workspace is read-only.");
    const text = await request.text();
    if (text.length > 12000) throw new Error("Marker is too large.");
    const input = JSON.parse(text);
    const expected = revision.parse(input.expected_updated_at);
    const restore = input.restore === true;
    const value = restore
      ? { id: z.uuid().parse(input.id) }
      : markerInput.parse(
          Object.fromEntries(
            Object.entries(input).filter(
              ([key]) => key !== "expected_updated_at",
            ),
          ),
        );
    const { data, error } = await c.client
      .from("workspace_markers")
      .update(restore ? { deleted_at: null } : value)
      .eq("workspace_id", c.workspaceId)
      .eq("id", value.id)
      .eq("updated_at", expected)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new Error(
        "This marker changed in another session or is unavailable. Your device draft is preserved.",
      );
    return json({ marker: data });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    if (!["owner", "admin", "editor"].includes(c.role))
      throw new Error("Workspace is read-only.");
    const p = z
      .object({ id: z.uuid(), expected_updated_at: revision })
      .parse(await request.json());
    const { data, error } = await c.client
      .from("workspace_markers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("workspace_id", c.workspaceId)
      .eq("id", p.id)
      .eq("updated_at", p.expected_updated_at)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new Error(
        "This marker changed in another session or is unavailable.",
      );
    return json({ marker: data });
  } catch (e) {
    return apiError(e);
  }
}

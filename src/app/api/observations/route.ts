import type { NextRequest } from "next/server";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json, sameOrigin } from "@/lib/api";
import { observationInput } from "@/lib/validation";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    if (!["owner", "admin", "editor"].includes(c.role)) throw new Error("Workspace is read-only.");
    const input = observationInput.parse(await request.json());
    if (input.linked_research_area_id) {
      const { data, error } = await c.client.from("spatial_layers").select("id").eq("workspace_id", c.workspaceId).eq("id", input.linked_research_area_id).eq("layer_kind", "research_area").single();
      if (error || !data) throw new Error("Research Area unavailable in this Workspace.");
    }
    const { data: existing, error: lookupError } = await c.client.from("field_observations").select("created_by,metadata").eq("workspace_id", c.workspaceId).eq("id", input.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (input.workspace_id !== c.workspaceId)
      throw new Error("Workspace mismatch");
    const { data, error } = await c.client
      .from("field_observations")
      .upsert({ ...input, metadata: { ...existing?.metadata, ...input.metadata }, created_by: existing?.created_by || c.user.id }, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return json({ observation: data });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    sameOrigin(request); const c = await workspaceContext();
    if (!["owner", "admin"].includes(c.role)) throw new Error("Only workspace administrators can delete observations.");
    const id = observationInput.shape.id.parse((await request.json()).id);
    const { data, error } = await c.client.from("field_observations").delete().eq("workspace_id", c.workspaceId).eq("id", id).select("id");
    if (error) throw error; if (!data?.length) throw new Error("Observation unavailable.");
    return json({ id });
  } catch (e) { return apiError(e); }
}

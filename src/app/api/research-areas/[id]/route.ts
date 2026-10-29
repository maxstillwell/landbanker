import { z } from "zod";
import type { NextRequest } from "next/server";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json, sameOrigin } from "@/lib/api";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    sameOrigin(request); const c = await workspaceContext();
    if (!["owner", "admin", "editor"].includes(c.role)) throw new Error("Workspace is read-only.");
    const id = z.uuid().parse((await params).id);
    const input = z.object({ name: z.string().trim().min(1).max(160) }).parse(await request.json());
    const { data, error } = await c.client.from("spatial_layers").update({ name: input.name }).eq("workspace_id", c.workspaceId).eq("id", id).eq("layer_kind", "research_area").select("id");
    if (error) throw error; if (!data?.length) throw new Error("Research Area unavailable.");
    return json({ id });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    sameOrigin(request); const c = await workspaceContext();
    if (!["owner", "admin"].includes(c.role)) throw new Error("Only workspace administrators can delete Research Areas.");
    const id = z.uuid().parse((await params).id);
    const { data, error } = await c.client.from("spatial_layers").delete().eq("workspace_id", c.workspaceId).eq("id", id).eq("layer_kind", "research_area").select("id");
    if (error) throw error; if (!data?.length) throw new Error("Research Area unavailable or linked to other records.");
    return json({ id });
  } catch (error) { return apiError(error); }
}

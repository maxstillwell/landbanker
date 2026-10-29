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
    const input = z.object({ name: z.string().trim().min(1).max(160).optional(), classify: z.literal(true).optional(), description: z.string().max(2000).optional(), subtype: z.enum(["general","investigation","precinct","growth","other"]).optional() }).refine(p=>Object.keys(p).length>0).parse(await request.json());
    const { data: existing,error: readError }=await c.client.from("spatial_layers").select("name,layer_kind,metadata").eq("workspace_id",c.workspaceId).eq("id",id).single();
    if(readError||!existing)throw new Error("Saved object unavailable.");
    if(existing.layer_kind!=="research_area"&&!input.classify)throw new Error("This object is a Custom Data Layer. Classify it explicitly first.");
    const metadata={...existing.metadata,...(input.description!==undefined?{description:input.description}:{}),...(input.subtype?{research_subtype:input.subtype}:{}),...(input.classify?{original_layer_kind:existing.metadata?.original_layer_kind||existing.layer_kind}:{} )};
    const { data, error } = await c.client.from("spatial_layers").update({ name: input.name || existing.name,layer_kind:"research_area",metadata }).eq("workspace_id", c.workspaceId).eq("id", id).select("id");
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

import type { NextRequest } from "next/server";
import { z } from "zod";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json, sameOrigin } from "@/lib/api";
type Context = { params: Promise<{ id: string }> };
async function context(params: Context["params"]) {
 const c = await workspaceContext(); const id = z.uuid().parse((await params).id);
 const { data, error } = await c.client.from("spatial_layers").select("id").eq("workspace_id",c.workspaceId).eq("id",id).eq("layer_kind","research_area").single();
 if (error || !data) throw new Error("Research Area unavailable in this Workspace.");
 return { ...c, id };
}
export async function GET(_: NextRequest, { params }: Context) {
 try { const c = await context(params);
 const [links, observations] = await Promise.all([c.client.from("research_property_links").select("property_id").eq("workspace_id",c.workspaceId).eq("research_area_id",c.id), c.client.from("field_observations").select("id,title").eq("workspace_id",c.workspaceId).eq("linked_research_area_id",c.id).order("observed_at",{ascending:false}).limit(100)]);
 if(links.error) throw links.error; if(observations.error) throw observations.error;
 return json({ property_ids: (links.data || []).map(x=>x.property_id), observations: observations.data || [] });
 } catch(e) { return apiError(e); }
}
async function mutate(request: NextRequest, params: Context["params"], remove: boolean) {
 try { sameOrigin(request); const c = await context(params); if(!["owner","admin","editor"].includes(c.role)) throw new Error("Workspace is read-only.");
 const property = z.uuid().parse((await request.json()).property_id);
 const result = remove ? await c.client.from("research_property_links").delete().eq("workspace_id",c.workspaceId).eq("research_area_id",c.id).eq("property_id",property) : await c.client.from("research_property_links").upsert({workspace_id:c.workspaceId,research_area_id:c.id,property_id:property},{onConflict:"workspace_id,research_area_id,property_id",ignoreDuplicates:true});
 if(result.error) throw result.error; return json({ok:true});
 } catch(e) {return apiError(e);}
}
export function POST(request: NextRequest, {params}: Context) {return mutate(request,params,false);}
export function DELETE(request: NextRequest, {params}: Context) {return mutate(request,params,true);}

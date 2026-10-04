import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";
import { activeShare, tokenHash, validShareToken } from "./sharing";
// The ONLY privileged runtime read path. No general service-role query endpoint.
export async function resolveShare(token: string) {
  if (!validShareToken(token)) return null;
  const secret = process.env.LAND_BANKER_SUPABASE_SECRET_KEY;
  if (!secret) return null;
  const { url } = supabaseConfig();
  const client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: link, error } = await client
    .from("share_links")
    .select("workspace_id,resource_type,resource_ids,expires_at,revoked_at")
    .eq("token_hash", tokenHash(token))
    .single();
  if (error || !link || !activeShare(link)) return null;
  if (["parcel", "parcels"].includes(link.resource_type)) {
    const { data, error } = await client
      .from("land_parcels")
      .select("id,title,latitude,longitude,geometry,hectares,status")
      .eq("workspace_id", link.workspace_id)
      .in("id", link.resource_ids);
    if (error) return null;
    return { type: "parcels", resources: data };
  }
  if (link.resource_type === "spatial_layer") {
    const { data, error } = await client
      .from("spatial_layers")
      .select("id,name,geojson")
      .eq("workspace_id", link.workspace_id)
      .in("id", link.resource_ids);
    if (error) return null;
    return { type: "layers", resources: data };
  }
  return null;
}

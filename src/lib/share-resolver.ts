import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";
import { validShareToken } from "./sharing";
import type { SharedProjection } from "./map/share-types";
// Public credential calls a narrow token-scoped database projection. No service key.
export async function resolveShare(
  token: string,
): Promise<SharedProjection | null> {
  if (!validShareToken(token)) return null;
  const { url, key } = supabaseConfig();
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("resolve_landos_share", {
    p_token: token,
  });
  if (
    error ||
    !data ||
    !["parcels", "layers", "view"].includes(data.type) ||
    !Array.isArray(data.resources)
  )
    return null;
  return data as SharedProjection;
}

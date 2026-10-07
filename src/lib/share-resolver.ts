import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";
import { validShareToken } from "./sharing";
import type { SharedProjection } from "./map/share-types";
import { checkShareBudget } from "./share-budget";
// Public credential calls a narrow token-scoped database projection. No service key.
export async function resolveShare(
  token: string,
): Promise<SharedProjection | null> {
  await checkShareBudget(token);
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

export async function shareStatus(
  token: string,
): Promise<"expired" | "unavailable"> {
  if (!validShareToken(token)) return "unavailable";
  const { url, key } = supabaseConfig();
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await client.rpc("landos_share_status", { p_token: token });
  return data === "expired" ? "expired" : "unavailable";
}

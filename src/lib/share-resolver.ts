import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";
import type { SharedProjection } from "./map/share-types";
import { ShareRateLimit, shareGatewayArguments } from "./share-budget";
const lastFailure = new Map<"gateway", number>();
function recordShareFailure(operation: "gateway") {
  const now = Date.now();
  if (now - (lastFailure.get(operation) || 0) < 60000) return;
  lastFailure.set(operation, now);
  console.error(
    JSON.stringify({
      event: "landos_share_resolution_failed",
      operation,
      observed_at: new Date().toISOString(),
    }),
  );
}
export type ShareResolution = {
  share: SharedProjection | null;
  status: "active" | "expired" | "unavailable";
};

// The public credential can execute only the server-capability gateway. The
// separate gateway secret never enters browser/iOS bundles or database rows.
export async function resolveShare(token: string): Promise<ShareResolution> {
  const args = await shareGatewayArguments(token);
  const { url, key } = supabaseConfig();
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("landos_share_gateway", args);
  if (error?.code === "P0001" && error.message === "Share rate limited")
    throw new ShareRateLimit();
  if (error) {
    recordShareFailure("gateway");
    throw new Error("LandOS share gateway is unavailable.");
  }
  const value = data as {
    status?: unknown;
    projection?: unknown;
  } | null;
  const status = ["active", "expired", "unavailable"].includes(
    String(value?.status),
  )
    ? (value!.status as ShareResolution["status"])
    : "unavailable";
  const projection = value?.projection as SharedProjection | null;
  const share =
    status === "active" &&
    projection &&
    ["parcels", "layers", "view"].includes(projection.type) &&
    Array.isArray(projection.resources)
      ? projection
      : null;
  if (status === "active" && !share) recordShareFailure("gateway");
  return { share, status: share ? "active" : status };
}

export type ProviderHealth = {
  id: string;
  provider: string;
  status: "healthy" | "unavailable" | "failed";
  last_success: string | null;
  last_failure: string | null;
  latency_ms: number;
  observed_at: string;
};
// Instance-local diagnostics, not a distributed availability guarantee. Platform
// structured logs are the durable aggregation source across serverless instances.
const health = new Map<string, ProviderHealth>();
export function recordProviderHealth(
  id: string,
  provider: string,
  status: ProviderHealth["status"],
  latency: number,
  emit: (value: string) => void = console.info,
) {
  if (
    !/^[a-z0-9_-]{1,80}$/.test(id) ||
    !["healthy", "unavailable", "failed"].includes(status)
  )
    return;
  const previous = health.get(id),
    now = new Date().toISOString();
  const value: ProviderHealth = {
    id,
    provider: provider.replace(/[\r\n]/g, " ").slice(0, 100),
    status,
    last_success: status === "healthy" ? now : previous?.last_success || null,
    last_failure: status !== "healthy" ? now : previous?.last_failure || null,
    latency_ms: Number.isFinite(latency) ? Math.max(0, Math.round(latency)) : 0,
    observed_at: now,
  };
  health.delete(id);
  health.set(id, value);
  if (health.size > 100) health.delete(health.keys().next().value!);
  // Only the explicit fixed-source diagnostic schema is emitted. No request,
  // address, user/Workspace ID, geometry, URL, token or error object is accepted.
  emit(JSON.stringify({ event: "landos_provider_health", ...value }));
}
export function providerHealthSnapshot(): ProviderHealth[] {
  return [...health.values()].map((value) => ({ ...value }));
}

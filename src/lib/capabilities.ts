export type Tier = "free" | "pro" | "team";
export type Capability =
  "official_layers" | "saved_views" | "share" | "export" | "spatial_analysis";
export function hasCapability(
  role: string,
  tier: Tier,
  capability: Capability,
) {
  // First milestone owners have full development access. Never use Auth metadata.
  if (role === "owner") return true;
  return tier === "team" || tier === "pro" || capability === "official_layers";
}
export function canUseLayer(role: string, tier: Tier, required: Tier) {
  return (
    role === "owner" ||
    required === "free" ||
    tier === "team" ||
    (tier === "pro" && required === "pro")
  );
}

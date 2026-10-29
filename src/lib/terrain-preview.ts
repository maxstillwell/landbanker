import "server-only";

/** Require both an explicit operator allowlist and an active admin workspace role. */
export function canPreviewTerrain(userId: string, role: string): boolean {
  if (process.env.LANDOS_TERRAIN_ADMIN_PREVIEW !== "1" || !["owner", "admin"].includes(role)) return false;
  return (process.env.LANDOS_TERRAIN_ADMIN_USER_IDS || "").split(",").some((id) => id.trim() === userId);
}

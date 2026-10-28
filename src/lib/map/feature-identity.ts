import type { Feature } from "geojson";

export function stableFeatureId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// Saving an existing layer through the API assigns UUIDs to missing/invalid IDs.
// Refuse edits in that case so unrelated legacy identities are never rewritten.
export function safeStoredFeatureIds(features: Feature[]) {
  const ids = features.map((feature) => feature.id);
  return ids.every(stableFeatureId) && new Set(ids).size === ids.length;
}

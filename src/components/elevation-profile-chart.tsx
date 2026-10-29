import type { HeightSample } from "@/lib/map/terrain";

export function ElevationProfileChart({ samples }: { samples: HeightSample[] }) {
  if (samples.length < 2 || samples.some((sample) => sample.elevation === null)) return null;
  const heights = samples.map((sample) => sample.elevation as number);
  const min = Math.min(...heights), max = Math.max(...heights), distance = samples.at(-1)?.distance || 0;
  if (!Number.isFinite(min) || !Number.isFinite(max) || distance <= 0) return null;
  const span = Math.max(1, max - min);
  const points = samples.map((sample, index) => `${10 + sample.distance / distance * 280},${90 - (heights[index] - min) / span * 75}`).join(" ");
  return <figure className="elevation-chart"><svg viewBox="0 0 300 100" role="img" aria-label={`Approximate elevation profile from ${min.toFixed(0)} to ${max.toFixed(0)} metres over ${(distance / 1000).toFixed(2)} kilometres`}><line x1="10" y1="90" x2="290" y2="90" stroke="currentColor" /><polyline points={points} fill="none" stroke="#d8ff43" strokeWidth="2" /></svg><figcaption>{min.toFixed(0)}–{max.toFixed(0)} m · {(distance / 1000).toFixed(2)} km · approximate</figcaption></figure>;
}

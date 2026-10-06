import { readFile, writeFile } from "node:fs/promises";
import type { Snapshot, LegacyRow } from "../src/lib/import/transform";
const input = process.argv[2],
  output = process.argv[3];
if (
  !input?.startsWith("private-imports/") ||
  !output?.startsWith("private-imports/")
)
  throw new Error("Private snapshot paths required");
const source = JSON.parse(await readFile(input, "utf8")) as Snapshot;
if (source.source_project !== "kcdzzbmkqtuwfzbeqcks" || source.version !== 1)
  throw new Error("Unexpected source");
const parcels: LegacyRow[] = [];
const add = (p: LegacyRow | undefined) => {
  if (p && !parcels.some((r) => r.id === p.id)) parcels.push(p);
};
for (const o of source.observations)
  add(source.parcels.find((p) => p.id === o.linked_parcel_id));
add(source.parcels.find((p) => p.geojson));
add(source.parcels.find((p) => /\bNSW\b/i.test(String(p.address))));
add(source.parcels.find((p) => /\bVIC\b/i.test(String(p.address))));
for (const p of source.parcels) {
  if (parcels.length >= 4) break;
  add(p);
}
const observations = source.observations
  .filter(
    (o) =>
      !o.linked_parcel_id || parcels.some((p) => p.id === o.linked_parcel_id),
  )
  .slice(0, 1);
const media = source.media
  .filter((m) => observations.some((o) => o.id === m.observation_id))
  .slice(0, 2);
const layers: LegacyRow[] = [];
const addLayer = (l: LegacyRow | undefined) => {
  if (l && !layers.some((r) => r.id === l.id)) layers.push(l);
};
addLayer(source.layers.find((l) => l.state === "NSW"));
addLayer(source.layers.find((l) => l.state === "VIC" || !l.state));
for (const l of source.layers) {
  if (layers.length >= 3) break;
  addLayer(l);
}
const sample: Snapshot = { ...source, parcels, observations, media, layers };
await writeFile(output, JSON.stringify(sample, null, 2), { mode: 0o600 });
console.log({
  parcels: parcels.length,
  observations: observations.length,
  media: media.length,
  layers: layers.length,
  nswParcelPresent: parcels.some((p) => /\bNSW\b/i.test(String(p.address))),
  linkedObservationPresent: observations.some((o) => !!o.linked_parcel_id),
});

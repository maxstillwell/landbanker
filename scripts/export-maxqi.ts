import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "node:fs/promises";
const url = process.env.MAXQI_READONLY_URL;
const key = process.env.MAXQI_READONLY_KEY;
if (
  !url ||
  !key ||
  new URL(url).hostname !== "kcdzzbmkqtuwfzbeqcks.supabase.co"
)
  throw new Error("Explicit MaxQI read-only source connection required");
// This object is never exposed to the destination importer. Only SELECT methods exist here.
const source = createClient(url, key, { auth: { persistSession: false } });
async function read(table: string) {
  const all = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await source
      .from(table)
      .select("*")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    all.push(...data);
    if (data.length < 500) return all;
  }
}
const [parcels, observations, media, layers] = await Promise.all([
  read("land_parcels"),
  read("land_field_observations"),
  read("land_field_observation_media"),
  read("land_spatial_layers"),
]);
await mkdir("private-imports", { recursive: true });
await writeFile(
  "private-imports/maxqi.json",
  JSON.stringify(
    {
      version: 1,
      source_project: "kcdzzbmkqtuwfzbeqcks",
      exported_at: new Date().toISOString(),
      parcels,
      observations,
      media,
      layers,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log({
  parcels: parcels.length,
  observations: observations.length,
  media: media.length,
  layers: layers.length,
});

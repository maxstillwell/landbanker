import { openDB } from "idb";
import type { FeatureCollection } from "geojson";
export type LocalLayerDraft = {
  id: string;
  name: string;
  geojson: FeatureCollection;
};
async function database() {
  return openDB("land-banker-layer-draft-v1", 1, {
    upgrade(db) {
      db.createObjectStore("layers");
    },
  });
}
const key = (user: string, workspace: string) => `${user}:${workspace}`;
export async function readLayerDraft(
  user: string,
  workspace: string,
): Promise<LocalLayerDraft | null> {
  const db = await database();
  try {
    return (await db.get("layers", key(user, workspace))) || null;
  } finally {
    db.close();
  }
}
export async function writeLayerDraft(
  user: string,
  workspace: string,
  draft: LocalLayerDraft | null,
) {
  const db = await database();
  try {
    if (draft) await db.put("layers", draft, key(user, workspace));
    else await db.delete("layers", key(user, workspace));
  } finally {
    db.close();
  }
}

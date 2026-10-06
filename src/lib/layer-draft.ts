import { openDB } from "idb";
import type { FeatureCollection } from "geojson";
export type LocalLayerDraft = {
  id: string;
  name: string;
  geojson: FeatureCollection;
  targetLayerId?: string;
};
async function database() {
  return openDB("land-banker-layer-draft-v1", 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("layers"))
        db.createObjectStore("layers");
      if (!db.objectStoreNames.contains("drawing"))
        db.createObjectStore("drawing");
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

export type DrawingSession = {
  version: 1;
  id: string;
  userId: string;
  workspaceId: string;
  kind: import("./map/drawing").DrawingKind;
  points: [number, number][];
  name: string;
  layerName: string;
  targetLayerId?: string;
  originalFeature?: import("geojson").Feature;
  createdAt: number;
  updatedAt: number;
  undo?: [number, number][];
};
export async function readDrawingSession(
  user: string,
  workspace: string,
): Promise<DrawingSession | null> {
  const db = await database();
  try {
    const d = (await db.get("drawing", key(user, workspace))) as
      DrawingSession | undefined;
    if (
      !d ||
      d.version !== 1 ||
      d.userId !== user ||
      d.workspaceId !== workspace ||
      !["Point", "LineString", "Polygon", "Rectangle"].includes(d.kind) ||
      !Array.isArray(d.points) ||
      d.points.length > 200 ||
      !d.points.every(
        (p) =>
          Array.isArray(p) &&
          p.length === 2 &&
          Number.isFinite(p[0]) &&
          Number.isFinite(p[1]) &&
          Math.abs(p[0]) <= 180 &&
          Math.abs(p[1]) <= 90,
      ) ||
      typeof d.name !== "string" ||
      typeof d.layerName !== "string" ||
      !Number.isFinite(d.createdAt) ||
      !Number.isFinite(d.updatedAt)
    )
      return null;
    return d;
  } finally {
    db.close();
  }
}
export async function writeDrawingSession(
  user: string,
  workspace: string,
  draft: DrawingSession | null,
) {
  if (draft && (draft.userId !== user || draft.workspaceId !== workspace))
    throw new Error("Drawing scope mismatch");
  const db = await database();
  try {
    if (draft) await db.put("drawing", draft, key(user, workspace));
    else await db.delete("drawing", key(user, workspace));
  } finally {
    db.close();
  }
}

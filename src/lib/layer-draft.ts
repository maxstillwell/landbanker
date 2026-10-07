import { openDB } from "idb";
import type { FeatureCollection } from "geojson";
export type LocalLayerDraft = {
  id: string;
  name: string;
  geojson: FeatureCollection;
  targetLayerId?: string;
};
async function database() {
  return openDB("land-banker-layer-draft-v1", 4, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("layers"))
        db.createObjectStore("layers");
      if (!db.objectStoreNames.contains("drawing"))
        db.createObjectStore("drawing");
      if (!db.objectStoreNames.contains("shareUrls"))
        db.createObjectStore("shareUrls");
      if (!db.objectStoreNames.contains("searches"))
        db.createObjectStore("searches");
    },
  });
}

export type RecentSearch = {
  query: string;
  state: "VIC" | "NSW";
  mode: "address" | "identifier";
  searchedAt: number;
};
function validSearch(value: RecentSearch) {
  return (
    value &&
    typeof value.query === "string" &&
    value.query.trim().length >= 3 &&
    value.query.length <= 120 &&
    ["VIC", "NSW"].includes(value.state) &&
    ["address", "identifier"].includes(value.mode) &&
    Number.isFinite(value.searchedAt)
  );
}
export async function readRecentSearches(
  user: string,
  workspace: string,
): Promise<RecentSearch[]> {
  const db = await database();
  try {
    const record = await db.get("searches", key(user, workspace));
    return record?.userId === user &&
      record?.workspaceId === workspace &&
      Array.isArray(record.items)
      ? record.items.filter(validSearch).slice(0, 8)
      : [];
  } finally {
    db.close();
  }
}
export async function rememberSearch(
  user: string,
  workspace: string,
  value: RecentSearch | null,
): Promise<RecentSearch[]> {
  if (value && !validSearch(value)) throw new Error("Invalid recent search");
  const db = await database();
  try {
    const tx = db.transaction("searches", "readwrite");
    const record = await tx.store.get(key(user, workspace));
    const current: RecentSearch[] =
      record?.userId === user &&
      record?.workspaceId === workspace &&
      Array.isArray(record.items)
        ? record.items.filter(validSearch)
        : [];
    const items = value
      ? [
          { ...value, query: value.query.trim() },
          ...current.filter(
            (item) =>
              item.query.toLowerCase() !== value.query.trim().toLowerCase() ||
              item.state !== value.state ||
              item.mode !== value.mode,
          ),
        ].slice(0, 8)
      : [];
    await tx.store.put(
      { userId: user, workspaceId: workspace, items },
      key(user, workspace),
    );
    await tx.done;
    return items;
  } finally {
    db.close();
  }
}

export async function readShareUrls(
  user: string,
  workspace: string,
): Promise<Record<string, string>> {
  const db = await database();
  try {
    const record = await db.get("shareUrls", key(user, workspace));
    return record?.userId === user && record?.workspaceId === workspace
      ? record.urls || {}
      : {};
  } finally {
    db.close();
  }
}
export async function storeShareUrl(
  user: string,
  workspace: string,
  id: string,
  url: string,
) {
  const parsed = new URL(url);
  if (
    !/^https?:$/.test(parsed.protocol) ||
    !/^\/share\/[A-Za-z0-9_-]{43}$/.test(parsed.pathname)
  )
    throw new Error("Invalid share URL");
  const db = await database();
  try {
    const record = await db.get("shareUrls", key(user, workspace));
    const urls =
      record?.userId === user && record?.workspaceId === workspace
        ? record.urls || {}
        : {};
    urls[id] = url;
    await db.put(
      "shareUrls",
      { userId: user, workspaceId: workspace, urls },
      key(user, workspace),
    );
  } finally {
    db.close();
  }
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

import { openDB, type DBSchema } from "idb";
import type { z } from "zod";
import type { observationInput, mediaInput } from "./validation";
import { timeoutFetch } from "./network";
export type QueuePhoto = {
  input: z.infer<typeof mediaInput>;
  blob: Blob;
  status: "pending" | "uploading" | "uploaded" | "failed";
};
export type FieldDraft = {
  id: string;
  userId: string;
  workspaceId: string;
  input: z.infer<typeof observationInput>;
  photos: QueuePhoto[];
  status: "draft" | "pending" | "uploading" | "uploaded" | "failed";
  error?: string;
  updatedAt: number;
};
interface QueueSchema extends DBSchema {
  drafts: { key: string; value: FieldDraft };
}
function database() {
  return openDB<QueueSchema>("land-banker-field-queue-v1", 1, {
    upgrade(db) {
      db.createObjectStore("drafts", { keyPath: "id" });
    },
  });
}
export async function storeDraft(draft: FieldDraft) {
  const db = await database();
  try {
    await db.put("drafts", draft);
  } finally {
    db.close();
  }
}
export async function listDrafts(userId: string, workspaceId: string) {
  const db = await database();
  try {
    return (await db.getAll("drafts"))
      .filter((d) => d.userId === userId && d.workspaceId === workspaceId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } finally {
    db.close();
  }
}
export async function removeDraft(id: string) {
  const db = await database();
  try {
    await db.delete("drafts", id);
  } finally {
    db.close();
  }
}
export async function apiRequest(path: string, body: unknown, method = "POST") {
  const r = await timeoutFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const p = await r.json().catch(() => ({}));
    throw new Error(p.error || `Request failed (${r.status})`);
  }
  return r.json();
}
export async function processDraft(
  draft: FieldDraft,
  upload: (photo: QueuePhoto) => Promise<void>,
) {
  await apiRequest("/api/observations", draft.input);
  for (const photo of draft.photos) {
    if (photo.status === "uploaded") continue;
    photo.status = "uploading";
    await storeDraft(draft);
    try {
      await upload(photo);
      photo.status = "uploaded";
      await storeDraft(draft);
    } catch (e) {
      photo.status = "failed";
      await storeDraft(draft);
      throw e;
    }
  }
  await removeDraft(draft.id);
}

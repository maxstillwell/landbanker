import type { NextRequest } from "next/server";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json, sameOrigin } from "@/lib/api";
import { mediaInput, mediaPath } from "@/lib/validation";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    const input = mediaInput.parse(await request.json());
    if (input.workspace_id !== c.workspaceId)
      throw new Error("Workspace mismatch");
    const path = mediaPath(
      c.workspaceId,
      input.observation_id,
      input.id,
      input.mime_type,
    );
    const { error } = await c.client.from("field_observation_media").upsert(
      {
        ...input,
        storage_path: path,
        upload_status: "uploading",
        created_by: c.user.id,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
    const { data, error: uploadError } = await c.client.storage
      .from("field-media")
      .createSignedUploadUrl(path, { upsert: true });
    if (uploadError) throw uploadError;
    return json({ path, token: data.token });
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    const input = mediaInput.parse(await request.json());
    if (input.workspace_id !== c.workspaceId)
      throw new Error("Workspace mismatch");
    const path = mediaPath(
      c.workspaceId,
      input.observation_id,
      input.id,
      input.mime_type,
    );
    const { data: objects, error: readError } = await c.client.storage
      .from("field-media")
      .list(`${c.workspaceId}/${input.observation_id}`, {
        search: input.id,
        limit: 10,
      });
    if (readError) throw readError;
    const found = objects?.find((o) => o.name === path.split("/").pop());
    if (!found || Number(found.metadata?.size) !== input.size_bytes)
      throw new Error("Uploaded object was not verified");
    const { error } = await c.client
      .from("field_observation_media")
      .update({ upload_status: "uploaded" })
      .eq("workspace_id", c.workspaceId)
      .eq("id", input.id)
      .eq("storage_path", path);
    if (error) throw error;
    return json({ uploaded: true });
  } catch (e) {
    return apiError(e);
  }
}

import type { NextRequest } from "next/server";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json, sameOrigin } from "@/lib/api";
import { observationInput } from "@/lib/validation";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    const input = observationInput.parse(await request.json());
    if (input.workspace_id !== c.workspaceId)
      throw new Error("Workspace mismatch");
    const { data, error } = await c.client
      .from("field_observations")
      .upsert({ ...input, created_by: c.user.id }, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return json({ observation: data });
  } catch (e) {
    return apiError(e);
  }
}

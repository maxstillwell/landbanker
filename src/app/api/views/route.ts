import { z } from "zod";
import type { NextRequest } from "next/server";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json, sameOrigin } from "@/lib/api";
const schema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(100),
  view: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    zoom: z.number().min(1).max(20),
  }),
});
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    const input = schema.parse(await request.json());
    const { error } = await c.client
      .from("saved_views")
      .upsert({ ...input, workspace_id: c.workspaceId, created_by: c.user.id });
    if (error) throw error;
    return json({ saved: true });
  } catch (e) {
    return apiError(e);
  }
}

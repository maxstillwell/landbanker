import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json, sameOrigin } from "@/lib/api";
const schema = z.object({ title: z.string().trim().min(1).max(160), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request); const c = await workspaceContext();
    if (!["owner", "admin", "editor"].includes(c.role)) throw new Error("Workspace is read-only.");
    const p = schema.parse(await request.json()); const id = randomUUID();
    const { error } = await c.client.from("land_parcels").insert({ id, workspace_id: c.workspaceId, title: p.title, latitude: p.latitude, longitude: p.longitude, source: "User created", status: "research", metadata: { location_source: "map", boundary_status: "unverified" }, created_by: c.user.id });
    if (error) throw error; return json({ id });
  } catch (error) { return apiError(error); }
}

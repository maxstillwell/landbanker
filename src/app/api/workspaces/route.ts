import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { workspaceContext } from "@/lib/workspace";
import { json, apiError, sameOrigin } from "@/lib/api";
export async function GET() {
  try {
    const c = await workspaceContext();
    return json({ current: c.workspaceId, members: c.members });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    const { id } = z.object({ id: z.uuid() }).parse(await request.json());
    if (!c.members.some((m) => m.workspace_id === id))
      throw new Error("Workspace unavailable");
    (await cookies()).set("lb_workspace", id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 31536000,
    });
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

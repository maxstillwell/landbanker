import "server-only";
import { serverClient } from "./supabase/server";
import { cookies } from "next/headers";
export async function workspaceContext() {
  const client = await serverClient();
  const { data: identity, error: authError } = await client.auth.getUser();
  if (authError || !identity.user) throw new Error("Sign in required");
  const { data: members, error } = await client
    .from("workspace_memberships")
    .select("workspace_id,role,workspaces(id,name)")
    .eq("user_id", identity.user.id)
    .eq("status", "active");
  if (error) throw error;
  const preferred = (await cookies()).get("lb_workspace")?.value;
  const member =
    members?.find((m) => m.workspace_id === preferred) || members?.[0];
  if (!member) throw new Error("No active workspace. Contact support.");
  return {
    client,
    user: identity.user,
    workspaceId: member.workspace_id,
    role: member.role,
    members,
  };
}

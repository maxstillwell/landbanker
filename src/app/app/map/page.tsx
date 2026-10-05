import MapWorkspace from "@/components/map-loader";
import { workspaceContext } from "@/lib/workspace";
export default async function Page() {
  const c = await workspaceContext();
  const w = c.members.find((m) => m.workspace_id === c.workspaceId)?.workspaces;
  const name =
    (Array.isArray(w)
      ? w[0]?.name
      : (w as unknown as { name?: string } | null)?.name) || "Your Workspace";
  return (
    <MapWorkspace
      userId={c.user.id}
      workspaceId={c.workspaceId}
      workspaceName={name}
      role={c.role}
    />
  );
}

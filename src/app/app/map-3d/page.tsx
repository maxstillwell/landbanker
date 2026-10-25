import MapLibreWorkspace from "@/components/maplibre-loader";
import { workspaceContext } from "@/lib/workspace";

export default async function Map3DPage() {
  const context = await workspaceContext();
  const workspace = context.members.find(
    (member) => member.workspace_id === context.workspaceId,
  )?.workspaces;
  const workspaceName =
    (Array.isArray(workspace)
      ? workspace[0]?.name
      : (workspace as unknown as { name?: string } | null)?.name) ||
    "Your Workspace";

  return (
    <MapLibreWorkspace
      userId={context.user.id}
      workspaceId={context.workspaceId}
      workspaceName={workspaceName}
      role={context.role}
    />
  );
}

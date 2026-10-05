"use client";
import { useState } from "react";
import { apiRequest } from "@/lib/field-queue";
type Member = {
  workspace_id: string;
  role: string;
  workspaces: { name: string } | { name: string }[] | null;
};
export function WorkspaceSelector({ name }: { name: string }) {
  const [members, setMembers] = useState<Member[] | null>(null),
    [error, setError] = useState("");
  return (
    <div className="workspace-selector">
      <button
        className="workspace-pill"
        aria-label="Choose workspace"
        aria-expanded={!!members}
        onClick={async () => {
          if (members) {
            setMembers(null);
            return;
          }
          try {
            const r = await fetch("/api/workspaces");
            if (!r.ok) throw new Error("Workspaces unavailable");
            setMembers((await r.json()).members);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Workspaces unavailable");
          }
        }}
      >
        {name} ▾
      </button>
      {members ? (
        <div className="workspace-menu">
          {members.map((m) => (
            <button
              key={m.workspace_id}
              onClick={async () => {
                try {
                  await apiRequest("/api/workspaces", { id: m.workspace_id });
                  window.location.reload();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Workspace unavailable",
                  );
                }
              }}
            >
              {(Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces)
                ?.name || "Workspace"}
              <small>{m.role}</small>
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

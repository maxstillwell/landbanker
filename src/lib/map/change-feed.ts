import type { ViewportRows } from "../hooks/use-viewport";
export type MapChange = {
  kind: keyof ViewportRows | "layers";
  id: string;
  operation: "upsert" | "delete";
  row?: unknown;
  viewport_only?: boolean;
};
export function applyMapChanges(
  rows: ViewportRows,
  changes: MapChange[],
  limit = 500,
): ViewportRows {
  const result = { ...rows };
  for (const kind of ["parcels", "observations", "features"] as const) {
    const next = new Map<string, unknown>(rows[kind].map((r) => [r.id, r]));
    for (const c of changes.filter((c) => c.kind === kind)) {
      if (c.operation === "delete") next.delete(c.id);
      else if (
        c.row &&
        typeof c.row === "object" &&
        (c.row as { id?: string }).id === c.id
      )
        next.set(c.id, c.row);
    }
    // If a full viewport exceeds the current ceiling, leave bounded selection deterministic.
    Object.assign(result, {
      [kind]: [...next.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, limit)
        .map(([, row]) => row),
    });
  }
  return result;
}

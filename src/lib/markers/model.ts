import { z } from "zod";
import { MARKER_ICONS } from "./catalog";
export const markerInput = z
  .object({
    id: z.uuid(),
    latitude: z.number().min(-85.051129).max(85.051129),
    longitude: z.number().min(-180).max(180),
    icon: z.enum(MARKER_ICONS.map((i) => i[0])),
    name: z.string().trim().min(1).max(160),
    description: z.string().max(2000).default(""),
    color: z.enum(["lime", "blue", "red", "orange", "neutral"]),
    size: z.enum(["small", "medium", "large"]),
    show_label: z.boolean(),
    status: z.enum(["existing", "proposed", "planned", "research_note"]),
    linked_property_id: z.uuid().nullable(),
    linked_research_area_id: z.uuid().nullable(),
  })
  .strict();
export type MarkerInput = z.infer<typeof markerInput>;
export type WorkspaceMarker = MarkerInput & {
  workspace_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
export function markerFields(row: WorkspaceMarker): MarkerInput {
  return markerInput.parse(
    Object.fromEntries(
      Object.keys(markerInput.shape).map((key) => [
        key,
        row[key as keyof WorkspaceMarker],
      ]),
    ),
  );
}

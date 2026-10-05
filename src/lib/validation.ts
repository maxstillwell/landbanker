import { z } from "zod";
export const observationInput = z.object({
  id: z.uuid(),
  workspace_id: z.uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  title: z.string().trim().min(1).max(160),
  notes: z.string().max(20000).default(""),
  observed_at: z.iso.datetime(),
  linked_parcel_id: z.uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export const mediaInput = z.object({
  id: z.uuid(),
  observation_id: z.uuid(),
  workspace_id: z.uuid(),
  original_filename: z.string().min(1).max(160),
  mime_type: z.enum(["image/jpeg", "image/png", "image/heic"]),
  size_bytes: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024),
  captured_at: z.iso.datetime().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export function mediaPath(
  workspace: string,
  observation: string,
  id: string,
  mime: string,
) {
  const extension =
    mime === "image/png" ? "png" : mime === "image/heic" ? "heic" : "jpg";
  return `${workspace}/${observation}/${id}.${extension}`;
}
export function validateCoordinates(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

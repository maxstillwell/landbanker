import { z } from "zod";
export const savedViewInput = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(100),
  view: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    zoom: z.number().min(1).max(20),
    parcel_ids: z.array(z.uuid()).max(100).default([]),
    layer_ids: z.array(z.uuid()).max(100).default([]),
    official_layers: z
      .array(
        z.object({
          catalog_id: z.string().min(1).max(100),
          visible: z.boolean(),
          opacity: z.number().min(0).max(1),
          position: z.number().int().min(0).max(100),
        }),
      )
      .max(30)
      .default([]),
  }),
});
export type SavedViewInput = z.infer<typeof savedViewInput>;

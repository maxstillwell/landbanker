import { z } from "zod";
export const parcelPoint = z.object({
  state: z.enum(["VIC", "NSW"]),
  latitude: z.coerce.number().min(-40).max(-27),
  longitude: z.coerce.number().min(140).max(154),
  address: z.string().trim().max(160).default(""),
  source: z.string().max(100).default(""),
});

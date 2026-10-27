import { z } from "zod";

// Camera zoom remains fractional. Request/cache zoom uses its containing integer
// level, after validation: invalid or out-of-range input must never be clamped away.
export const viewportZoom = z.preprocess((value) => {
  if (value === undefined) return 12;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return value;
}, z.number().finite().min(0).max(22).transform(Math.floor));

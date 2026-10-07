import { z } from "zod";
import { timeoutFetch } from "./network";
export const clientFailureInput = z
  .object({
    event: z.enum(["frontend_fatal", "upload_failed"]),
  })
  .strict();
export type ClientFailure = z.infer<typeof clientFailureInput>["event"];
const lastSent = new Map<ClientFailure, number>();
export function reportClientFailure(event: ClientFailure) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - (lastSent.get(event) || 0) < 60000) return;
  lastSent.set(event, now);
  // No error message, stack, address, geometry, request URL, token or user ID.
  // Diagnostic delivery must never interrupt recovery or the durable photo queue.
  void timeoutFetch(
    "/api/telemetry",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({ event }),
    },
    5000,
  ).catch(() => {});
}

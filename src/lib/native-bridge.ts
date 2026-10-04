import { z } from "zod";
import type { LocationFix } from "./types";
export const nativeEvents = z.object({
  version: z.literal(1),
  type: z.enum([
    "nativeReady",
    "locationUpdated",
    "locationPermissionChanged",
    "photoSelected",
    "appBecameActive",
    "appBecameInactive",
    "networkStatusChanged",
    "nativeError",
  ]),
  requestId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
});
export type NativeCommand =
  | "requestCurrentLocation"
  | "startLocationFollow"
  | "stopLocationFollow"
  | "openCamera"
  | "openPhotoLibrary"
  | "openShareSheet"
  | "hapticFeedback"
  | "openExternalNavigation";
declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        landBanker?: { postMessage: (message: unknown) => void };
      };
    };
    LandBankerBridge?: { receive: (message: unknown) => void };
  }
}
export function nativeAvailable() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.webkit?.messageHandlers?.landBanker)
  );
}
export function sendNative(
  type: NativeCommand,
  payload: Record<string, unknown> = {},
) {
  if (!nativeAvailable()) return false;
  window.webkit!.messageHandlers!.landBanker!.postMessage({
    version: 1,
    type,
    requestId: crypto.randomUUID(),
    payload,
  });
  return true;
}
export function subscribeNative(
  handler: (event: z.infer<typeof nativeEvents>) => void,
) {
  window.LandBankerBridge = {
    receive(message) {
      const parsed = nativeEvents.safeParse(message);
      if (parsed.success) handler(parsed.data);
    },
  };
  sendNative("hapticFeedback", { style: "ready" });
  return () => {
    delete window.LandBankerBridge;
  };
}
export function locationFromPayload(
  p: Record<string, unknown>,
): LocationFix | null {
  const result = z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().nonnegative(),
      timestamp: z.number(),
    })
    .safeParse(p);
  return result.success ? result.data : null;
}

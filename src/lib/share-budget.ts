import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { tokenHash } from "./sharing";
import { RateWindow } from "./rate-window";
const callers = new RateWindow(120, 60000),
  tokens = new RateWindow(60, 60000);
let lastWarning = 0;
export class ShareRateLimit extends Error {
  constructor() {
    super("Too many share requests. Try again in a minute.");
  }
}
export async function shareGatewayArguments(token: string) {
  const secret = process.env.LANDOS_SHARE_GATEWAY_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32)
    throw new Error("LandOS share gateway is not configured.");
  const h = await headers();
  // Trust only the hosting platform's reserved address header. Other deployments
  // use one conservative caller bucket in the distributed database gateway.
  const address = process.env.VERCEL
    ? h.get("x-vercel-forwarded-for") || "unknown"
    : "self-hosted";
  if (!callers.allow(tokenHash(address)) || !tokens.allow(tokenHash(token))) {
    if (Date.now() - lastWarning >= 60000) {
      lastWarning = Date.now();
      console.warn(
        JSON.stringify({
          event: "landos_share_budget_exceeded",
          observed_at: new Date().toISOString(),
        }),
      );
    }
    throw new ShareRateLimit();
  }
  return {
    p_token: token,
    p_gateway_secret: secret,
    p_caller_hash: createHmac("sha256", secret).update(address).digest("hex"),
  };
}

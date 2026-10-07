import "server-only";
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
export async function checkShareBudget(token: string) {
  const h = await headers();
  // Trust only the hosting platform's reserved address header. Other deployments
  // share a conservative instance-wide budget until an authenticated gateway exists.
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
}

import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "./config";
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  // Next may expose an internal bind address here. Trust deployment configuration,
  // never an arbitrary forwarded host supplied by a caller.
  const allowed = new Set([appUrl()]);
  if (process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`);
  if (!origin || !allowed.has(origin))
    throw new Error("Invalid request origin");
}
export function apiError(error: unknown) {
  console.error(
    "Land Banker API:",
    error instanceof Error ? error.message : "request failed",
  );
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Request failed" },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}
export function json(value: unknown) {
  return NextResponse.json(value, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

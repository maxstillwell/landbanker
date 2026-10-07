import { NextResponse, type NextRequest } from "next/server";
import { workspaceContext } from "@/lib/workspace";
import { apiError, sameOrigin } from "@/lib/api";
import { clientFailureInput } from "@/lib/client-failure";
import { RateWindow } from "@/lib/rate-window";
import { tokenHash } from "@/lib/sharing";
const budget = new RateWindow(10, 60000, 2000);
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const c = await workspaceContext();
    if (!budget.allow(tokenHash(c.user.id)))
      return NextResponse.json(
        { error: "Diagnostic budget exceeded" },
        {
          status: 429,
          headers: { "Cache-Control": "no-store", "Retry-After": "60" },
        },
      );
    if (Number(request.headers.get("content-length")) > 1024)
      throw new Error("Diagnostic payload too large");
    const body = await request.text();
    if (body.length > 1024) throw new Error("Diagnostic payload too large");
    const input = clientFailureInput.parse(JSON.parse(body));
    console.error(
      JSON.stringify({
        event: "landos_client_failure",
        category: input.event,
        observed_at: new Date().toISOString(),
        release: process.env.VERCEL_GIT_COMMIT_SHA || "local",
      }),
    );
    return NextResponse.json(
      { accepted: true },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

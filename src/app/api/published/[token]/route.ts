import { NextResponse } from "next/server";
import { resolveShare, shareStatus } from "@/lib/share-resolver";
import { ShareRateLimit } from "@/lib/share-budget";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const data = await resolveShare(token);
    const expired = !data && (await shareStatus(token)) === "expired";
    return NextResponse.json(
      data || {
        error: expired ? "This shared view has expired." : "Share unavailable",
      },
      {
        status: data ? 200 : expired ? 410 : 404,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch (e) {
    if (!(e instanceof ShareRateLimit)) throw e;
    return NextResponse.json(
      { error: e.message },
      {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": "60" },
      },
    );
  }
}

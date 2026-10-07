import { NextResponse } from "next/server";
import { resolveShare } from "@/lib/share-resolver";
import { ShareRateLimit } from "@/lib/share-budget";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const { share, status } = await resolveShare(token);
    const expired = status === "expired";
    return NextResponse.json(
      share || {
        error: expired ? "This shared view has expired." : "Share unavailable",
      },
      {
        status: share ? 200 : expired ? 410 : 404,
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
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "Retry-After": "60",
        },
      },
    );
  }
}

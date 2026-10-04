import { NextResponse } from "next/server";
import { resolveShare } from "@/lib/share-resolver";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const data = await resolveShare(token);
  return NextResponse.json(data || { error: "Share unavailable" }, {
    status: data ? 200 : 404,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

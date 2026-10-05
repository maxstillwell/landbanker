import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { safeNext, appUrl } from "@/lib/config";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const client = await serverClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(safeNext(request.nextUrl.searchParams.get("next")), appUrl()),
      );
  }
  return NextResponse.redirect(
    new URL("/login?error=confirmation_failed", appUrl()),
  );
}

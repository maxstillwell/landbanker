import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { serverClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/config";
export async function GET(request: NextRequest) {
  const hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (hash && ["signup", "recovery", "email"].includes(type || "")) {
    const c = await serverClient();
    const { error } = await c.auth.verifyOtp({
      token_hash: hash,
      type: type as EmailOtpType,
    });
    if (!error)
      return NextResponse.redirect(
        new URL(
          type === "recovery" ? "/app/reset-password" : "/app/map",
          appUrl(),
        ),
      );
  }
  return NextResponse.redirect(
    new URL("/login?error=confirmation_failed", appUrl()),
  );
}

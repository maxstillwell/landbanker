import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configured, supabaseConfig } from "@/lib/config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!configured()) return response;
  const { url, key } = supabaseConfig();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const { data, error } = await client.auth.getClaims();
  if (request.nextUrl.pathname.startsWith("/app") && (error || !data?.claims)) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.searchParams.set("next", request.nextUrl.pathname);
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  if (request.nextUrl.pathname.startsWith("/app"))
    response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/app/:path*", "/auth/:path*"] };

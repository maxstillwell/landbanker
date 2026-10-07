import type { Instrumentation } from "next";

// Next invokes this only for captured server failures. Emit fixed route
// metadata, never request paths/headers, errors, geometry, tokens or user data.
export const onRequestError: Instrumentation.onRequestError = async (
  _error,
  _request,
  context,
) => {
  console.error(
    JSON.stringify({
      event: "landos_server_error",
      route_type: context.routeType,
      route_pattern: context.routePath.slice(0, 160),
      observed_at: new Date().toISOString(),
      release: process.env.VERCEL_GIT_COMMIT_SHA || "local",
    }),
  );
};

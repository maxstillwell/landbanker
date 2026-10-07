import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
// Only called after fresh workspaceContext/RLS reads. Isolate account + Workspace;
// never cache authorization, and refresh before the signed URL's five-minute expiry.
const cache = new Map<string, { url: string; until: number }>();
const pending = new Map<string, Promise<string>>();
export async function signedMediaUrls(
  client: SupabaseClient,
  scope: string,
  paths: string[],
) {
  const unique = [...new Set(paths)];
  const fresh: string[] = [];
  const resolvers = new Map<
    string,
    { resolve: (url: string) => void; reject: (error: unknown) => void }
  >();
  for (const path of unique) {
    const key = `${scope}:${path}`;
    if ((cache.get(key)?.until || 0) <= Date.now()) cache.delete(key);
    if (cache.has(key) || pending.has(key)) continue;
    const promise = new Promise<string>((resolve, reject) =>
      resolvers.set(path, { resolve, reject }),
    );
    // Batch failures are also observed below; prevent an unhandled rejection between awaits.
    void promise.catch(() => {});
    pending.set(key, promise);
    fresh.push(path);
  }
  // Capture in-flight promises now: another request may finish and remove its
  // map entry while this request signs a different batch.
  const lookups = unique.map((path) => ({
    path,
    promise: cache.has(`${scope}:${path}`)
      ? Promise.resolve(cache.get(`${scope}:${path}`)!.url)
      : pending.get(`${scope}:${path}`)!,
  }));
  for (let offset = 0; offset < fresh.length; offset += 400) {
    await Promise.all(
      Array.from(
        { length: Math.min(4, Math.ceil((fresh.length - offset) / 100)) },
        async (_, i) => {
          const batch = fresh.slice(offset + i * 100, offset + (i + 1) * 100);
          try {
            const { data, error } = await client.storage
              .from("field-media")
              .createSignedUrls(batch, 300);
            if (error) throw error;
            const results = new Map(
              (data || []).map((item) => [item.path, item.signedUrl]),
            );
            for (const path of batch) {
              const url = results.get(path);
              if (!url) {
                resolvers
                  .get(path)!
                  .reject(new Error("Photo access unavailable"));
                continue;
              }
              cache.set(`${scope}:${path}`, {
                url,
                until: Date.now() + 240000,
              });
              resolvers.get(path)!.resolve(url);
            }
            while (cache.size > 2000) cache.delete(cache.keys().next().value!);
          } catch (e) {
            for (const path of batch) resolvers.get(path)!.reject(e);
          }
        },
      ),
    );
  }
  try {
    return new Map(
      await Promise.all(
        lookups.map(
          async ({ path, promise }) => [path, await promise] as const,
        ),
      ),
    );
  } finally {
    for (const path of fresh) pending.delete(`${scope}:${path}`);
  }
}

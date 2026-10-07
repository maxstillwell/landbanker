import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedMediaUrls } from "../src/lib/media-url-cache";
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
type Result = { data: { path: string; signedUrl: string }[]; error: null };
test("concurrent photo signing deduplicates and isolates account/Workspace", async () => {
  const pending = deferred<Result>();
  let calls = 0;
  const client = {
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => {
          calls++;
          if (calls === 1) return pending.promise;
          return {
            data: paths.map((path) => ({ path, signedUrl: `signed-${calls}` })),
            error: null,
          };
        },
      }),
    },
  } as unknown as SupabaseClient;
  const a = signedMediaUrls(client, "cache-account-A:workspace-A", ["photo"]),
    b = signedMediaUrls(client, "cache-account-A:workspace-A", ["photo"]);
  assert.equal(calls, 1);
  pending.resolve({
    data: [{ path: "photo", signedUrl: "signed-one" }],
    error: null,
  });
  assert.equal((await a).get("photo"), "signed-one");
  assert.equal((await b).get("photo"), "signed-one");
  assert.equal(
    (
      await signedMediaUrls(client, "cache-account-B:workspace-A", ["photo"])
    ).get("photo"),
    "signed-2",
  );
  assert.equal(
    (
      await signedMediaUrls(client, "cache-account-A:workspace-B", ["photo"])
    ).get("photo"),
    "signed-3",
  );
});
test("signing cache refreshes before the URL expires", async () => {
  mock.timers.enable({ apis: ["Date"], now: 1000 });
  let calls = 0;
  const client = {
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((path) => ({ path, signedUrl: `ttl-${++calls}` })),
          error: null,
        }),
      }),
    },
  } as unknown as SupabaseClient;
  try {
    const first = await signedMediaUrls(client, "ttl-scope", ["photo"]);
    mock.timers.setTime(2000);
    assert.equal(
      (await signedMediaUrls(client, "ttl-scope", ["photo"])).get("photo"),
      first.get("photo"),
    );
    assert.equal(calls, 1);
    mock.timers.setTime(241001);
    assert.equal(
      (await signedMediaUrls(client, "ttl-scope", ["photo"])).get("photo"),
      "ttl-2",
    );
  } finally {
    mock.timers.reset();
  }
});
test("a mixed signing waiter retains an earlier failed in-flight promise", async () => {
  const x = deferred<Result>(),
    y = deferred<Result>();
  let calls = 0;
  const client = {
    storage: {
      from: () => ({
        createSignedUrls: async () => (++calls === 1 ? x.promise : y.promise),
      }),
    },
  } as unknown as SupabaseClient;
  const first = signedMediaUrls(client, "mixed-cache-scope", ["x"]),
    firstRejected = assert.rejects(first, /denied/);
  const mixed = signedMediaUrls(client, "mixed-cache-scope", ["x", "y"]),
    mixedRejected = assert.rejects(mixed, /denied/);
  x.reject(new Error("denied"));
  await firstRejected;
  y.resolve({ data: [{ path: "y", signedUrl: "y-signed" }], error: null });
  await mixedRejected;
});

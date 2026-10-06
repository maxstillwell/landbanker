import { test } from "node:test";
import assert from "node:assert/strict";
import { assertIndependentBackend, safeNext } from "../src/lib/config";
import {
  planImport,
  mappedId,
  sourceHash,
  type Snapshot,
} from "../src/lib/import/transform";
import {
  activeShare,
  newShareToken,
  tokenHash,
  validShareToken,
} from "../src/lib/sharing";
import { observationInput, mediaInput } from "../src/lib/validation";
import { locationFromPayload } from "../src/lib/native-bridge";
const w = "11111111-1111-4111-8111-111111111111";
test("production backend isolation", () => {
  assert.throws(() =>
    assertIndependentBackend("https://kcdzzbmkqtuwfzbeqcks.supabase.co"),
  );
  assert.throws(() =>
    assertIndependentBackend("https://xlrtlqhhzhmdhrmuoyot.supabase.co"),
  );
  assert.throws(() => assertIndependentBackend("http://attacker.invalid"));
  assert.equal(
    assertIndependentBackend("http://127.0.0.1:54321"),
    "http://127.0.0.1:54321",
  );
});
test("stable workspace-scoped import identities and canonical hashes", () => {
  assert.equal(mappedId(w, "parcel", "42"), mappedId(w, "parcel", "42"));
  assert.notEqual(
    mappedId(w, "parcel", "42"),
    mappedId("other", "parcel", "42"),
  );
  assert.equal(sourceHash({ a: 1, b: 2 }), sourceHash({ b: 2, a: 1 }));
});
test("linked copy, pending media, orphan detection and unchanged source", () => {
  const s: Snapshot = {
    version: 1,
    source_project: "kcdzzbmkqtuwfzbeqcks",
    exported_at: "now",
    parcels: [{ id: "p", title: "A", lat: -37, lng: 144 }],
    observations: [
      {
        id: "o",
        title: "Visit",
        latitude: -37,
        longitude: 144,
        linked_parcel_id: "p",
      },
    ],
    media: [
      {
        id: "m",
        observation_id: "o",
        storage_path: "old/path",
        storage_bucket: "old",
        mime_type: "image/png",
        size_bytes: 23,
      },
    ],
    layers: [],
  };
  const p = planImport(s, w);
  assert.deepEqual(p.issues, []);
  assert.equal(p.records[1].row.linked_parcel_id, p.records[0].row.id);
  assert.equal(p.records[2].row.observation_id, p.records[1].row.id);
  assert.equal(p.records[2].row.storage_path, null);
  assert.equal(p.records[2].row.upload_status, "legacy_pending");
  assert.equal(s.media[0].storage_path, "old/path");
  s.media[0].observation_id = "missing";
  assert.equal(planImport(s, w).issues.length, 1);
});
test("secure share tokens, revoke and expiry", () => {
  const a = newShareToken(),
    b = newShareToken();
  assert.notEqual(a, b);
  assert.ok(validShareToken(a));
  assert.equal(tokenHash(a).length, 64);
  assert.notEqual(a, tokenHash(a));
  assert.equal(
    activeShare({ expires_at: "2020-01-01", revoked_at: null }),
    false,
  );
  assert.equal(
    activeShare({ expires_at: "2099-01-01", revoked_at: "now" }),
    false,
  );
  assert.equal(
    activeShare({ expires_at: "2099-01-01", revoked_at: null }),
    true,
  );
});
test("coordinate, media and navigation validation", () => {
  assert.equal(
    observationInput.safeParse({
      id: w,
      workspace_id: w,
      title: "A",
      latitude: 91,
      longitude: 12,
      observed_at: new Date().toISOString(),
    }).success,
    false,
  );
  assert.equal(
    mediaInput.safeParse({
      id: w,
      workspace_id: w,
      observation_id: w,
      original_filename: "x",
      mime_type: "text/html",
      size_bytes: 1,
      captured_at: null,
    }).success,
    false,
  );
  assert.equal(
    locationFromPayload({
      latitude: 0,
      longitude: 180,
      accuracy: 8,
      timestamp: 1,
    })?.accuracy,
    8,
  );
  assert.equal(
    locationFromPayload({
      latitude: 900,
      longitude: 0,
      accuracy: 8,
      timestamp: 1,
    }),
    null,
  );
  assert.equal(safeNext("//attacker.invalid"), "/app/map");
});

test("durable photo queue isolates accounts and resumes after partial upload failure", async () => {
  const fake = await import("fake-indexeddb");
  Object.assign(
    globalThis,
    Object.fromEntries(
      Object.entries(fake).filter(
        ([name]) => name === "indexedDB" || name.startsWith("IDB"),
      ),
    ),
  );
  const { storeDraft, listDrafts, processDraft } =
    await import("../src/lib/field-queue");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  try {
    const draft = {
      id: crypto.randomUUID(),
      userId: "queue-owner",
      workspaceId: w,
      input: {
        id: crypto.randomUUID(),
        workspace_id: w,
        title: "Visit",
        notes: "",
        latitude: 0,
        longitude: 0,
        metadata: { location_source: "manual", accuracy_m: null },
        observed_at: new Date().toISOString(),
        linked_parcel_id: null,
      },
      photos: [0, 1].map((i) => ({
        blob: new Blob(["photo bytes"]),
        status: "pending" as const,
        input: {
          id: crypto.randomUUID(),
          workspace_id: w,
          observation_id: w,
          original_filename: `photo-${i}.png`,
          mime_type: "image/png" as const,
          size_bytes: 11,
          captured_at: null,
          metadata: {},
        },
      })),
      status: "failed" as const,
      updatedAt: Date.now(),
    };
    await storeDraft(draft);
    assert.equal((await listDrafts("other-user", w)).length, 0);
    assert.equal(
      (await listDrafts("queue-owner", "other-workspace")).length,
      0,
    );
    let attempted = 0;
    await assert.rejects(
      processDraft(draft, async () => {
        if (++attempted === 2) throw new Error("Weak reception");
      }),
    );
    const [preserved] = await listDrafts("queue-owner", w);
    assert.equal(preserved.photos[0].status, "uploaded");
    assert.equal(preserved.photos[1].status, "failed");
    assert.equal(await preserved.photos[1].blob.text(), "photo bytes");
    let retried = 0;
    await processDraft(preserved, async () => {
      retried++;
    });
    assert.equal(retried, 1, "already uploaded photo is not reuploaded");
    assert.equal(
      (await listDrafts("queue-owner", w)).length,
      0,
      "remove only after complete upload",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("local layer draft survives storage reads and remains scoped to user/workspace", async () => {
  const fake = await import("fake-indexeddb");
  Object.assign(
    globalThis,
    Object.fromEntries(
      Object.entries(fake).filter(
        ([name]) => name === "indexedDB" || name.startsWith("IDB"),
      ),
    ),
  );
  const { readLayerDraft, writeLayerDraft } =
    await import("../src/lib/layer-draft");
  const layer = {
    id: w,
    name: "Local polygon",
    geojson: { type: "FeatureCollection" as const, features: [] },
  };
  await writeLayerDraft("owner", w, layer);
  assert.deepEqual(await readLayerDraft("owner", w), layer);
  assert.equal(await readLayerDraft("other", w), null);
  assert.equal(await readLayerDraft("owner", "other"), null);
  await writeLayerDraft("owner", w, null);
  assert.equal(await readLayerDraft("owner", w), null);
});

test("network timeout preserves retry semantics and propagates cancellation", async () => {
  const { timeoutFetch } = await import("../src/lib/network");
  const original = globalThis.fetch;
  globalThis.fetch = async (_input, init) =>
    new Promise((_resolve, reject) => {
      const signal = init?.signal;
      const abort = () => reject(signal?.reason || new Error("aborted"));
      if (signal?.aborted) abort();
      else signal?.addEventListener("abort", abort, { once: true });
    });
  try {
    await assert.rejects(
      timeoutFetch("https://test.invalid", {}, 5),
      /timed out.*draft is preserved/,
    );
    const controller = new AbortController();
    controller.abort(new Error("caller cancelled"));
    await assert.rejects(
      timeoutFetch("https://test.invalid", { signal: controller.signal }, 500),
      /caller cancelled/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("Australian area and line measurements use metric units", async () => {
  const { geometryMeasurement, formatArea, formatDistance } =
    await import("../src/lib/map/measurement");
  const line = geometryMeasurement({
    type: "LineString",
    coordinates: [
      [144, -37],
      [144.01, -37],
    ],
  });
  assert.ok(line.distanceM > 800 && line.distanceM < 1000);
  const polygon = geometryMeasurement({
    type: "Polygon",
    coordinates: [
      [
        [144, -37],
        [144.01, -37],
        [144.01, -37.01],
        [144, -37.01],
        [144, -37],
      ],
    ],
  });
  assert.ok(polygon.areaM2 > 900000 && polygon.areaM2 < 1100000);
  assert.equal(formatArea(1842), "1,842 m²");
  assert.equal(formatArea(426800), "42.68 ha");
  assert.equal(formatDistance(1840), "1.84 km");
});

test("official ESRI rings preserve parcel holes and multiple disjoint parts", async () => {
  const { esriRingsGeometry } = await import("../src/lib/map/esri-rings");
  const outer = [
      [0, 0],
      [0, 4],
      [4, 4],
      [4, 0],
      [0, 0],
    ],
    hole = [
      [1, 1],
      [2, 1],
      [2, 2],
      [1, 2],
      [1, 1],
    ],
    island = [
      [6, 0],
      [6, 1],
      [7, 1],
      [7, 0],
      [6, 0],
    ];
  const single = esriRingsGeometry([outer, hole]);
  assert.equal(single.type, "Polygon");
  assert.equal(single.coordinates.length, 2);
  const multi = esriRingsGeometry([hole, island, outer]);
  assert.equal(multi.type, "MultiPolygon");
  assert.equal(multi.coordinates.length, 2);
  assert.ok(multi.coordinates.some((p) => p.length === 2));
  assert.throws(() =>
    esriRingsGeometry([
      [
        [0, 0],
        [1, 1],
        [2, 0],
      ],
    ]),
  );
});

import {
  drawingGeometry,
  validGeometry,
  editablePoints,
} from "../src/lib/map/drawing";
test("drawing tools validate closed geometry without discarding imported holes", () => {
  const rectangle = drawingGeometry("Rectangle", [
    [144, -37],
    [144.01, -37.01],
  ]);
  assert.ok(rectangle && validGeometry(rectangle));
  assert.equal(drawingGeometry("LineString", [[144, -37]]), null);
  assert.equal(
    validGeometry({ type: "Point", coordinates: [181, -37] }),
    false,
  );
  assert.equal(
    validGeometry({
      type: "Polygon",
      coordinates: [
        [
          [144, -37],
          [145, -37],
          [145, -38],
        ],
      ],
    }),
    false,
  );
  assert.equal(
    editablePoints({
      type: "Polygon",
      coordinates: [
        [
          [144, -37],
          [145, -37],
          [145, -38],
          [144, -37],
        ],
        [
          [144.1, -37.1],
          [144.2, -37.1],
          [144.2, -37.2],
          [144.1, -37.1],
        ],
      ],
    }),
    null,
  );
});

import {
  safeSimple,
  insertVertex,
  deleteVertex,
  translatePoints,
  type XY,
} from "../src/lib/map/drawing-edit";
import {
  writeDrawingSession,
  readDrawingSession,
  type DrawingSession,
} from "../src/lib/layer-draft";
test("unfinished drawing persistence keeps name/layer/timestamps and isolates both account and workspace", async () => {
  const fake = await import("fake-indexeddb");
  globalThis.indexedDB = fake.indexedDB;
  globalThis.IDBKeyRange = fake.IDBKeyRange;
  const draft: DrawingSession = {
    version: 1,
    id: crypto.randomUUID(),
    userId: "alpha-user",
    workspaceId: w,
    kind: "Polygon",
    points: [
      [144, -37],
      [144.01, -37],
    ],
    name: "Acquisition review",
    layerName: "Analysis",
    targetLayerId: crypto.randomUUID(),
    createdAt: 123,
    updatedAt: 456,
  };
  await writeDrawingSession(draft.userId, w, draft);
  assert.deepEqual(await readDrawingSession(draft.userId, w), draft);
  assert.equal(await readDrawingSession("other-user", w), null);
  assert.equal(await readDrawingSession(draft.userId, "other-workspace"), null);
  await assert.rejects(writeDrawingSession("other-user", w, draft));
  await writeDrawingSession(draft.userId, w, null);
  assert.equal(await readDrawingSession(draft.userId, w), null);
});
test("safe simple edits preserve closed rings and reject minimum-count, crossing and out-of-world changes", () => {
  const polygon: XY[] = [
    [144, -37],
    [144.01, -37],
    [144.01, -36.99],
    [144, -36.99],
  ];
  const moved = translatePoints("Polygon", polygon, [0.03, 0.02]);
  assert.ok(moved);
  assert.ok(validGeometry(drawingGeometry("Polygon", moved)));
  const added = insertVertex("Polygon", polygon, 3);
  assert.equal(added?.length, 5);
  assert.ok(safeSimple("Polygon", added!));
  const removed = deleteVertex("Polygon", polygon, 0);
  assert.equal(removed?.length, 3);
  assert.equal(deleteVertex("Polygon", removed!, 0), null);
  assert.equal(
    deleteVertex(
      "LineString",
      [
        [144, -37],
        [145, -36],
      ],
      0,
    ),
    null,
  );
  assert.equal(
    safeSimple("Polygon", [
      [0, 0],
      [1, 1],
      [0, 1],
      [1, 0],
    ]),
    false,
  );
  assert.equal(
    safeSimple("Polygon", [
      [0, 0],
      [1, 0],
      [2, 0],
    ]),
    false,
  );
  assert.equal(translatePoints("Polygon", polygon, [100, 0]), null);
  const rectangle = translatePoints(
    "Rectangle",
    [
      [144, -37],
      [144.01, -36.99],
    ],
    [0.2, 0.3],
  );
  assert.ok(rectangle);
  assert.ok(validGeometry(drawingGeometry("Rectangle", rectangle)));
});

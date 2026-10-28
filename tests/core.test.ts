import { test } from "node:test";
import assert from "node:assert/strict";
import type { GeoJsonObject } from "geojson";
import { isLocationGeometry } from "../src/lib/map/location-geometry";
import { safeStoredFeatureIds } from "../src/lib/map/feature-identity";
import { isOfficialParcelSource, officialSelectionId, summarizeAreas, updateSelectedAreas } from "../src/lib/map/selection-summary";
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
import {
  clientFailureInput,
  reportClientFailure,
} from "../src/lib/client-failure";
import {
  basemapStyle,
  isMapLibreBasemap,
  scopedMapLibrePreference,
  terrainTileJsonUrl,
} from "../src/lib/map/maplibre-config";
import {
  observationsGeoJson,
  parcelsGeoJson,
  workspaceFeaturesGeoJson,
} from "../src/lib/map/maplibre-geojson";
const w = "11111111-1111-4111-8111-111111111111";
test("selection summary preserves multipart and hole areas and warns about incomplete and overlapping totals", () => {
  const outer = [[143, -37], [143.02, -37], [143.02, -37.02], [143, -37.02], [143, -37]];
  const hole = [[143.005, -37.005], [143.015, -37.005], [143.015, -37.015], [143.005, -37.015], [143.005, -37.005]];
  const shape = { type: "Polygon" as const, coordinates: [outer, hole] };
  const item = { id: officialSelectionId("vic", "42"), label: "Lot", source: "Official", kind: "parcel" as const, geometry: shape };
  const result = summarizeAreas([item, { ...item, id: "other" }, { ...item, id: "unknown", geometry: null }]);
  assert(result.areaM2 > 0); assert(result.overlaps); assert(result.incomplete);
  assert.equal(officialSelectionId("VIC", "42"), officialSelectionId("vic", "42"));
  assert(isOfficialParcelSource("VIC", "Vicmap / VicPlan"));
  assert(!isOfficialParcelSource("VIC", "Imported workspace record"));
  assert.equal(updateSelectedAreas([item], { ...item, id: officialSelectionId("VIC", "42"), source: "Other representation" }, true).length, 0);
  const multipart = summarizeAreas([{ ...item, geometry: { type: "MultiPolygon", coordinates: [[outer, hole], [[[144, -37], [144.01, -37], [144.01, -37.01], [144, -37.01], [144, -37]]]] } }]);
  assert(multipart.areaM2 > result.areaM2 / 2);
});
test("legacy workspace features with equally long geometry retain distinct render identities", () => {
  const feature = (x: number) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: [x, -37] } });
  const layer = { id: "layer", workspace_id: w, name: "Legacy", layer_kind: "geojson", layer_data: {}, metadata: {}, geojson: { type: "FeatureCollection" as const, features: [feature(143), feature(144)] } };
  assert.equal(JSON.stringify(layer.geojson.features[0].geometry).length, JSON.stringify(layer.geojson.features[1].geometry).length);
  const first = workspaceFeaturesGeoJson([layer]);
  assert.equal(first.index.size, 2);
  assert.equal(new Set(first.collection.features.map((item) => item.id)).size, 2);
  assert.deepEqual(first.collection.features.map((item) => item.id), workspaceFeaturesGeoJson([layer]).collection.features.map((item) => item.id));
  assert.equal(safeStoredFeatureIds(layer.geojson.features), false);
  const withIds = layer.geojson.features.map((item) => ({ ...item, id: crypto.randomUUID() }));
  assert.equal(safeStoredFeatureIds(withIds), true);
  assert.equal(safeStoredFeatureIds([withIds[0], withIds[0]]), false);
  const radius = { ...layer, id: "radius", layer_kind: "radius", geojson: null, layer_data: { centre: [-37, 143], rings: [{ kilometres: 1, colour: "#00aa00" }, { kilometres: 2, colour: "#00bb00" }] } };
  const rings = workspaceFeaturesGeoJson([radius]);
  assert.equal(rings.index.size, 2);
  assert(rings.collection.features.every((item) => item.geometry.type === "Polygon" && item.properties?.layerId === "radius"));
});
test("only valid location points are eligible for preserving an original geometry during boundary association", () => {
  assert(isLocationGeometry({ type: "Point", coordinates: [143.85, -37.56] }));
  assert(isLocationGeometry({ type: "Feature", geometry: { type: "Point", coordinates: [143.85, -37.56] }, properties: {} }));
  assert(!isLocationGeometry({ type: "Point", coordinates: [200, -37] }));
  assert(!isLocationGeometry({ type: "Polygon", coordinates: [] }));
  assert(!isLocationGeometry(null));
});
test("MapLibre preview configuration is scoped and only accepts secure terrain configuration", () => {
  assert.equal(isMapLibreBasemap("dark"), true);
  assert.equal(isMapLibreBasemap("satellite"), true);
  const satellite = basemapStyle("satellite");
  assert.equal(typeof satellite, "object");
  if (typeof satellite !== "string") {
    const source = satellite.sources["dea-satellite"];
    assert(source && source.type === "raster");
    assert.match(source.tiles?.[0] || "", /ga_ls8cls9c_gm_cyear_3/);
    assert.match(source.attribution || "", /Geoscience Australia/);
  }
  const hybrid = basemapStyle("hybrid");
  assert.notEqual(typeof hybrid, "string");
  if (typeof hybrid !== "string") {
    assert.equal(hybrid.sources.openmaptiles?.type, "vector");
    assert(hybrid.layers.some((layer) => layer.id === "hybrid-place-labels"));
    assert(hybrid.layers.some((layer) => layer.id === "hybrid-road-labels"));
  }
  assert.notEqual(
    scopedMapLibrePreference("owner-a", w),
    scopedMapLibrePreference("owner-b", w),
  );
  assert.equal(terrainTileJsonUrl("http://example.test/dem.json"), null);
  assert.equal(
    terrainTileJsonUrl("https://example.test/dem.json"),
    "https://example.test/dem.json",
  );
});
test("MapLibre workspace overlays preserve boundaries and fall back to saved location points", () => {
  const parcels = parcelsGeoJson([
    {
      id: "saved-with-boundary",
      workspace_id: w,
      title: "Boundary",
      latitude: null,
      longitude: null,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [143, -37],
            [144, -37],
            [144, -38],
            [143, -37],
          ],
        ],
      } as GeoJsonObject,
      notes: null,
      status: "saved",
      metadata: {},
    },
    {
      id: "no-boundary",
      workspace_id: w,
      title: "No boundary",
      latitude: -37,
      longitude: 143,
      geometry: null,
      notes: null,
      status: "saved",
      metadata: {},
    },
  ]);
  assert.equal(parcels.features.length, 2);
  assert.equal(parcels.features[0].geometry.type, "Polygon");
  assert.equal(parcels.features[0].properties?.recordId, "saved-with-boundary");
  assert.deepEqual(parcels.features[1].geometry, {
    type: "Point",
    coordinates: [143, -37],
  });
  const wrapped = parcelsGeoJson([{ id: "wrapped", workspace_id: w, title: "Wrapped boundary", latitude: -37, longitude: 143, geometry: { type: "Feature", properties: {}, geometry: parcels.features[0].geometry } as GeoJsonObject, notes: null, status: "saved", metadata: {} }]);
  assert.equal(wrapped.features[0].geometry.type, "Polygon");
  const pointOnly = parcelsGeoJson([{ id: "point", workspace_id: w, title: "Location", latitude: null, longitude: null, geometry: { type: "Point", coordinates: [143, -37] } as GeoJsonObject, notes: null, status: "saved", metadata: {} }]);
  assert.equal(pointOnly.features[0].geometry.type, "Point");
  const observations = observationsGeoJson([
    {
      id: "field-note",
      workspace_id: w,
      title: "Field note",
      latitude: -37,
      longitude: 143,
      notes: null,
      observed_at: "2026-01-01T00:00:00.000Z",
      metadata: {},
      field_observation_media: [],
    },
  ]);
  assert.equal(observations.features[0].properties?.recordId, "field-note");
  assert.deepEqual(observations.features[0].geometry, {
    type: "Point",
    coordinates: [143, -37],
  });
});
test("client failure telemetry allows only fixed categories and sends no private payload", async () => {
  assert(clientFailureInput.safeParse({ event: "frontend_fatal" }).success);
  assert(
    !clientFailureInput.safeParse({
      event: "upload_failed",
      photo_url: "private",
    }).success,
  );
  assert(
    !clientFailureInput.safeParse({
      event: "upload_failed",
      geometry: [145, -37],
    }).success,
  );
  assert(
    !clientFailureInput.safeParse({ event: "arbitrary_error_text" }).success,
  );
  const originalFetch = globalThis.fetch;
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const bodies: string[] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
  });
  globalThis.fetch = async (_url, init) => {
    bodies.push(String(init?.body));
    return new Response("{}", { status: 202 });
  };
  try {
    reportClientFailure("frontend_fatal");
    reportClientFailure("frontend_fatal");
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    assert.deepEqual(bodies, [JSON.stringify({ event: "frontend_fatal" })]);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousWindow)
      Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
test("recent searches are account/Workspace scoped, bounded and clearable", async () => {
  const fake = await import("fake-indexeddb");
  Object.assign(
    globalThis,
    Object.fromEntries(
      Object.entries(fake).filter(
        ([name]) => name === "indexedDB" || name.startsWith("IDB"),
      ),
    ),
  );
  const { readRecentSearches, rememberSearch } =
    await import("../src/lib/layer-draft");
  for (let i = 0; i < 12; i++)
    await rememberSearch("search-owner", w, {
      query: `Local search ${i}`,
      state: "VIC",
      mode: "address",
      searchedAt: i,
    });
  assert.equal((await readRecentSearches("search-owner", w)).length, 8);
  assert.deepEqual(await readRecentSearches("another-account", w), []);
  assert.deepEqual(
    await readRecentSearches("search-owner", "another-workspace"),
    [],
  );
  await rememberSearch("search-owner", w, {
    query: " LOCAL SEARCH 11 ",
    state: "VIC",
    mode: "address",
    searchedAt: 13,
  });
  const items = await readRecentSearches("search-owner", w);
  assert.equal(items.length, 8);
  assert.equal(
    items.filter((i) => i.query.toLowerCase() === "local search 11").length,
    1,
  );
  await rememberSearch("search-owner", w, null);
  assert.deepEqual(await readRecentSearches("search-owner", w), []);
});
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

import {
  addressQueries,
  parcelIdentifierQuery,
} from "../src/lib/map/parcel-search-query";
test("official address parsing keeps multi-word roads, units, punctuation and explicit state", () => {
  assert.match(
    addressQueries("701 Sturt Street, Ballarat VIC 3350", "VIC")[0],
    /HOUSE_NUMBER_1=701 AND ROAD_NAME='STURT' AND ROAD_TYPE='STREET' AND LOCALITY_NAME LIKE 'BALLARAT%'/,
  );
  assert.match(
    addressQueries("2/701 Sturt St Ballarat", "VIC")[0],
    /HOUSE_NUMBER_1=701/,
  );
  assert.match(
    addressQueries("Unit 2, 701 Sturt St Ballarat", "VIC")[0],
    /HOUSE_NUMBER_1=701/,
  );
  assert.match(
    addressQueries("99 Old Northern Road", "VIC")[0],
    /ROAD_NAME='OLD NORTHERN'/,
  );
  assert.match(
    addressQueries("5 James St, Dunoon NSW", "NSW")[0],
    /housenumber='5'.*%JAMES%.*%STREET%.*%DUNOON%/,
  );
  assert.match(
    addressQueries("Ballarat Sturt Street", "VIC")[1],
    /%BALLARAT%.*%STURT%/,
  );
  assert.throws(() => addressQueries("///", "VIC"));
  assert(
    !addressQueries("5 James'; DROP TABLE x; --", "NSW").join().includes(";"),
  );
});
test("parcel identifier queries use only verified provider fields", () => {
  assert.equal(
    parcelIdentifierQuery("PFI: 12345", "VIC"),
    "PARCEL_PFI='12345'",
  );
  assert.equal(parcelIdentifierQuery("CADID: 12345", "NSW"), "cadid=12345");
  assert.equal(
    parcelIdentifierQuery("1/DP123456", "NSW"),
    "lotnumber='1' AND planlabel='DP123456'",
  );
  assert.equal(
    parcelIdentifierQuery("Lot 1 PS123456", "VIC"),
    "PARCEL_LOT_NUMBER='1' AND PARCEL_PLAN_NUMBER='PS123456'",
  );
  assert.throws(() => parcelIdentifierQuery("CADID: 1 OR 1=1", "NSW"));
  assert.throws(() => parcelIdentifierQuery("PFI: 12345", "NSW"));
});

import { intersectsViewport } from "../src/lib/map/viewport";
test("viewport intersection finds crossing geometry and excludes holes/false envelopes", () => {
  const b: [number, number, number, number] = [0, 0, 1, 1];
  assert(
    intersectsViewport(
      {
        type: "LineString",
        coordinates: [
          [-2, 0.5],
          [2, 0.5],
        ],
      },
      b,
    ),
  );
  assert(
    !intersectsViewport(
      {
        type: "LineString",
        coordinates: [
          [-1, 0.2],
          [0.2, 2],
        ],
      },
      b,
    ),
  );
  assert(
    intersectsViewport(
      {
        type: "Polygon",
        coordinates: [
          [
            [-2, -2],
            [2, -2],
            [2, 2],
            [-2, 2],
            [-2, -2],
          ],
        ],
      },
      b,
    ),
  );
  assert(
    !intersectsViewport(
      {
        type: "Polygon",
        coordinates: [
          [
            [-2, -2],
            [2, -2],
            [2, 2],
            [-2, 2],
            [-2, -2],
          ],
          [
            [-0.1, -0.1],
            [-0.1, 1.1],
            [1.1, 1.1],
            [1.1, -0.1],
            [-0.1, -0.1],
          ],
        ],
      },
      b,
    ),
  );
  assert(
    intersectsViewport(
      {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
          [
            [
              [3, 3],
              [4, 3],
              [4, 4],
              [3, 3],
            ],
          ],
        ],
      },
      b,
    ),
  );
});

import { RateWindow } from "../src/lib/rate-window";
import { readShareUrls, storeShareUrl } from "../src/lib/layer-draft";
test("share URLs stay scoped on device, and rate windows reset/bound callers", async () => {
  const url = `https://preview.example/share/${"Q".repeat(43)}`;
  await storeShareUrl("share-user", "share-workspace", "share-id", url);
  assert.deepEqual(await readShareUrls("share-other", "share-workspace"), {});
  assert.deepEqual(
    await readShareUrls("share-user", "share-other-workspace"),
    {},
  );
  assert.equal(
    (await readShareUrls("share-user", "share-workspace"))["share-id"],
    url,
  );
  await assert.rejects(
    storeShareUrl(
      "share-user",
      "share-workspace",
      "bad",
      "javascript:alert(1)",
    ),
  );
  const window = new RateWindow(2, 100, 10);
  assert(window.allow("a", 0));
  assert(window.allow("a", 1));
  assert(!window.allow("a", 2));
  assert(window.allow("b", 2));
  assert(window.allow("a", 101));
});

test("malformed imported geometry cannot break or falsely match a viewport", () => {
  const b: [number, number, number, number] = [0, 0, 1, 1];
  for (const value of [
    { type: "Polygon", coordinates: null },
    {
      type: "LineString",
      coordinates: [
        [null, 1],
        [1, null],
      ],
    },
    { type: "FeatureCollection", features: [] },
  ]) {
    assert.equal(
      intersectsViewport(value as unknown as import("geojson").Geometry, b),
      false,
    );
  }
});

import { officialTileUrl } from "../src/lib/map/maplibre-official";
import { circleFeature, geometryBounds } from "../src/lib/map/maplibre-scene";
test("MapLibre official raster requests preserve catalog sublayers and exact Web Mercator tile envelopes", () => {
  const source = {
    id: "test",
    name: "Official test",
    service_url: "https://government.example/MapServer/",
    renderer: "arcgis_export" as const,
    layer_ids: "1,3",
    attribution: "Government",
    min_zoom: 8,
    opacity: 0.35,
  };
  const template = officialTileUrl(source);
  assert(template.endsWith("bbox={bbox-epsg-3857}"));
  const url = new URL(template.replace("{bbox-epsg-3857}", "1,2,3,4"));
  assert.equal(url.pathname, "/MapServer/export");
  assert.equal(url.searchParams.get("layers"), "show:1,3");
  assert.equal(url.searchParams.get("bboxSR"), "3857");
  assert.equal(url.searchParams.get("imageSR"), "3857");
  assert.equal(url.searchParams.get("transparent"), "true");
  assert.equal(url.searchParams.get("bbox"), "1,2,3,4");
  assert.equal(
    officialTileUrl({
      ...source,
      renderer: "tile",
      service_url: "https://government.example/{z}/{x}/{y}.png",
    }),
    "https://government.example/{z}/{x}/{y}.png",
  );
});
test("MapLibre scene bounds retain multipart geometry and GPS accuracy circles use metre radii", () => {
  const circle = circleFeature(-37, 144, 100, "blue");
  const bounds = geometryBounds(circle);
  assert(bounds.getWest() < 144 && bounds.getEast() > 144);
  assert(bounds.getSouth() < -37 && bounds.getNorth() > -37);
  assert(Math.abs((bounds.getNorth() + 37) * 111195 - 100) < 1);
  const multi = geometryBounds({
    type: "FeatureCollection",
    features: [
      circle,
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "GeometryCollection",
          geometries: [{ type: "Point", coordinates: [150, -30] }],
        },
      },
    ],
  });
  assert.equal(multi.getEast(), 150);
  assert.equal(multi.getNorth(), -30);
  assert(geometryBounds({ type: "FeatureCollection", features: [] }).isEmpty());
});

import { viewportZoom } from "../src/lib/map/viewport-input";
import {
  zoneCategory,
  officialZoneCode,
  ZONE_CATEGORIES,
} from "../src/lib/map/zoning-style";
import {
  officialFeatureKey,
  parcelFromOfficialFeature,
} from "../src/lib/map/official-selection";
import { OFFICIAL_MAP_LAYERS } from "../src/lib/map/official-map-catalog";
test("viewport request zoom accepts fractional camera levels, validates bounds before normalization", () => {
  for (const [input, expected] of [
    [13.42, 13],
    ["14.8", 14],
    [0, 0],
    [22, 22],
    [undefined, 12],
  ] as const)
    assert.equal(viewportZoom.parse(input), expected);
  for (const input of [
    -0.1,
    22.01,
    NaN,
    Infinity,
    -Infinity,
    "",
    " ",
    "not-a-number",
    null,
    true,
  ])
    assert.equal(viewportZoom.safeParse(input).success, false, String(input));
});
test("zoning visual groups preserve state-specific codes and legacy NSW E-zone ambiguity", () => {
  for (const [state, code, expected] of [
    ["VIC", "GRZ1", "residential"],
    ["VIC", "C1Z", "commercial"],
    ["VIC", "IN1Z", "industrial"],
    ["VIC", "FZ2", "rural"],
    ["VIC", "PCRZ", "conservation"],
    ["VIC", "PUZ1", "special"],
    ["NSW", "R1", "residential"],
    ["NSW", "B2", "commercial"],
    ["NSW", "IN1", "industrial"],
    ["NSW", "RU1", "rural"],
    ["NSW", "C2", "conservation"],
    ["NSW", "SP2", "special"],
    ["NSW", "E1", "unknown"],
    ["VIC", "unreviewed", "unknown"],
  ] as const)
    assert.equal(zoneCategory(state, code), expected, `${state} ${code}`);
  assert.equal(
    zoneCategory("NSW", "E1", "National Parks and Nature Reserves"),
    "conservation",
  );
  assert.equal(zoneCategory("NSW", "E1", "Local Centre"), "commercial");
  assert.equal(zoneCategory("NSW", "E4", "General Industrial"), "industrial");
  assert.equal(
    officialZoneCode("NSW", { LAY_CLASS: "Land zoning", SYM_CODE: "R2" }),
    "R2",
  );
  assert.equal(
    new Set(Object.values(ZONE_CATEGORIES).map((v) => v.color)).size,
    7,
  );
});
test("official parcel picks retain provider geometry/identifiers and never invent unidentified Properties", () => {
  const layer = OFFICIAL_MAP_LAYERS["vic-parcels"];
  const feature = {
    type: "Feature" as const,
    properties: {
      PARCEL_PFI: "123",
      PARCEL_LOT_NUMBER: "7",
      PARCEL_PLAN_NUMBER: "PS42",
    },
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [145.18, -37.85],
          [145.19, -37.85],
          [145.19, -37.86],
          [145.18, -37.85],
        ],
      ],
    },
  };
  assert.equal(officialFeatureKey(layer, feature), "vic-parcels:123");
  const selected = parcelFromOfficialFeature(layer, feature);
  assert(selected);
  assert.equal(selected.geometry, feature.geometry);
  assert.equal(selected.sourceId, "123");
  const tapped = parcelFromOfficialFeature(layer, feature, [145.185, -37.852]);
  assert.equal(tapped?.longitude, 145.185);
  assert.equal(tapped?.latitude, -37.852);
  assert.equal(selected.lot, "7");
  assert.equal(selected.plan, "PS42");
  assert(selected.areaM2 > 0);
  assert.equal(
    parcelFromOfficialFeature(layer, { ...feature, properties: {} }),
    null,
  );
  assert.equal(
    parcelFromOfficialFeature(OFFICIAL_MAP_LAYERS["vic-zoning"], feature),
    null,
  );
  assert.equal(
    officialFeatureKey(layer, { ...feature, properties: {} }),
    officialFeatureKey(layer, { ...feature, properties: {} }),
  );
  assert(!isMapLibreBasemap("__proto__"));
  assert(!isMapLibreBasemap("toString"));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Polygon, MultiPolygon } from "geojson";
import type { CatalogLayer } from "../src/lib/map/catalog-types";
import {
  propertyIntersection,
  esriProperty,
  propertyGeometry,
} from "../src/lib/planning/geometry";
import { queryPropertyPlanning } from "../src/lib/planning/query";
function rectangle(x: number, y: number, w = 1, h = 1): Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
        [x, y],
      ],
    ],
  };
}
const property = rectangle(144, -37);
const source = {
  id: "vic-zoning",
  name: "Victoria zoning",
  state: "VIC",
  enabled: true,
  provider: "Victorian Government",
  category: "Planning",
  source_url: "https://planning.vic.gov.au",
  usage_notes: "Indicative, not a planning certificate.",
  attribution: "Victorian Government",
  update_frequency: null,
} as CatalogLayer;
test("planning clips full/partial/no intersection using real polygon area", () => {
  assert.equal(
    propertyIntersection(property, property)?.intersection_percent,
    100,
  );
  assert.ok(
    Math.abs(
      propertyIntersection(property, rectangle(144, -37, 0.5))!
        .intersection_percent! - 50,
    ) < 1e-7,
  );
  assert.equal(propertyIntersection(property, rectangle(146, -37)), null);
});
test("planning preserves multipolygon parts and holes, never uses centroid/envelope coverage", () => {
  const multi: MultiPolygon = {
    type: "MultiPolygon",
    coordinates: [property.coordinates, rectangle(146, -37).coordinates],
  };
  assert.ok(
    Math.abs(
      propertyIntersection(multi, property)!.intersection_percent! - 50,
    ) < 1e-7,
  );
  const withHole: Polygon = {
    type: "Polygon",
    coordinates: [
      rectangle(144, -37, 2, 2).coordinates[0],
      rectangle(144.5, -36.5, 1, 1).coordinates[0],
    ],
  };
  assert.equal(
    propertyIntersection(withHole, rectangle(144.7, -36.3, 0.2, 0.2)),
    null,
  );
  assert.equal(
    propertyIntersection(withHole, rectangle(144, -37, 2, 2))
      ?.intersection_percent,
    100,
  );
  assert.equal(esriProperty(multi).rings.length, 2);
  assert.equal(esriProperty(withHole).rings.length, 2);
  assert.deepEqual(
    propertyGeometry({ type: "Feature", properties: {}, geometry: multi }),
    multi,
  );
});
test("point and line intersections never fabricate percent coverage", () => {
  assert.deepEqual(
    propertyIntersection(property, {
      type: "Point",
      coordinates: [144.5, -36.5],
    }),
    { intersection_area_m2: null, intersection_percent: null },
  );
  assert.deepEqual(
    propertyIntersection(property, {
      type: "LineString",
      coordinates: [
        [143, -36.5],
        [146, -36.5],
      ],
    }),
    { intersection_area_m2: null, intersection_percent: null },
  );
});
const response = (features: unknown[] = []) =>
  new Response(JSON.stringify({ features }), {
    headers: { "Content-Type": "application/json" },
  });
const official = (g: Polygon, attributes: Record<string, unknown> = {}) => ({
  geometry: { rings: g.coordinates },
  attributes: {
    OBJECTID: 42,
    ZONE_CODE: "FZ",
    ZONE_DESCRIPTION: "Farming Zone",
    private_extra: "must not expose",
    ...attributes,
  },
});
test("official planning query submits full geometry, returns coverage and allowlisted provenance", async () => {
  const result = await queryPropertyPlanning(
    { id: "p", state: "VIC", geometry: property },
    [source],
    async (input, init) => {
      assert.equal(
        String(input),
        "https://spatial.planning.vic.gov.au/gis/rest/services/planning_scheme_zones/MapServer/0/query",
      );
      assert.equal(init?.method, "POST");
      const params = new URLSearchParams(String(init?.body));
      assert.equal(params.get("spatialRel"), "esriSpatialRelIntersects");
      assert.equal(JSON.parse(params.get("geometry")!).rings.length, 1);
      return response([official(rectangle(144, -37, 0.5))]);
    },
  );
  assert.equal(result.layers[0].status, "matched");
  const control = result.layers[0].controls[0];
  assert.equal(control.property_id, "p");
  assert.equal(control.source_feature_id, "0:42");
  assert.equal(control.control_name, "Farming Zone");
  assert.equal(control.control_code, "FZ");
  assert.ok(Math.abs(control.intersection_percent! - 50) < 1e-7);
  assert(!("private_extra" in control.source_metadata));
  assert(result.layers[0].attribution);
  assert(control.queried_at);
});
test("planning distinguishes empty source, nonintersection, unavailable, failed and unsupported", async () => {
  const cases: [typeof fetch, string][] = [
    [async () => response(), "no_result"],
    [async () => response([official(rectangle(147, -37))]), "no_intersection"],
    [
      async () => new Response("Unavailable", { status: 503 }),
      "source_unavailable",
    ],
    [
      async () => new Response(JSON.stringify({ error: { code: 400 } })),
      "request_failed",
    ],
    [
      async () =>
        new Response(
          JSON.stringify({ features: [], exceededTransferLimit: true }),
        ),
      "request_failed",
    ],
    [
      async () =>
        response([{ attributes: { OBJECTID: 42 }, geometry: { rings: null } }]),
      "request_failed",
    ],
  ];
  for (const [fetcher, status] of cases) {
    const result = await queryPropertyPlanning(
      { id: "p", state: "VIC", geometry: property },
      [source],
      fetcher,
    );
    assert.equal(result.layers[0].status, status);
    assert.equal(result.layers[0].controls.length, 0);
  }
  const never: typeof fetch = async () => {
    throw new Error("Unexpected request");
  };
  assert.equal(
    (
      await queryPropertyPlanning(
        { id: "p", state: "QLD", geometry: property },
        [source],
        never,
      )
    ).status,
    "unsupported_location",
  );
  assert.equal(
    (
      await queryPropertyPlanning(
        { id: "p", state: "VIC", geometry: null },
        [source],
        never,
      )
    ).status,
    "geometry_unavailable",
  );
});
test("one failed source cannot discard another matched control", async () => {
  const result = await queryPropertyPlanning(
    { id: "p", state: "VIC", geometry: property },
    [source, { ...source, id: "vic-bushfire" }],
    async (input) =>
      String(input).includes("/19/")
        ? new Response("fail", { status: 503 })
        : response([official(property)]),
  );
  assert.equal(result.layers[0].status, "matched");
  assert.equal(result.layers[1].status, "source_unavailable");
});

import { propertyCentroid } from "../src/lib/planning/centroid";
import { nearProperty } from "../src/lib/planning/proximity";
test("Property centroid preserves multipart weighting and nearby does not create relationships", () => {
  const multi: MultiPolygon = {
    type: "MultiPolygon",
    coordinates: [
      rectangle(144, -37).coordinates,
      rectangle(146, -37).coordinates,
    ],
  };
  const center = propertyCentroid(multi)!;
  assert.ok(Math.abs(center[0] - 145.5) < 0.000001);
  assert.ok(Math.abs(center[1] + 36.5) < 0.000001);
  assert(nearProperty(property, [144.5, -36.5]));
  assert(nearProperty(property, [145.003, -36.5]));
  assert(!nearProperty(property, [145.03, -36.5]));
});

import { applyMapChanges } from "../src/lib/map/change-feed";
test("incremental map changes reconcile create/update/delete and reject mismatched identities", () => {
  const initial = {
    parcels: [],
    observations: [],
    features: [],
  } as import("../src/lib/hooks/use-viewport").ViewportRows;
  const first = applyMapChanges(initial, [
    {
      kind: "features",
      id: "a",
      operation: "upsert",
      row: {
        id: "a",
        layer_id: "l",
        workspace_id: "w",
        feature: {
          type: "Feature",
          properties: { name: "Created" },
          geometry: { type: "Point", coordinates: [144, -37] },
        },
      },
    },
  ]);
  assert.equal(first.features.length, 1);
  const second = applyMapChanges(first, [
    {
      kind: "features",
      id: "a",
      operation: "upsert",
      row: {
        ...first.features[0],
        feature: {
          ...first.features[0].feature,
          properties: { name: "Updated" },
        },
      },
    },
  ]);
  assert.equal(second.features[0].feature.properties?.name, "Updated");
  assert.equal(
    applyMapChanges(second, [
      { kind: "features", id: "a", operation: "delete" },
    ]).features.length,
    0,
  );
  assert.equal(
    applyMapChanges(initial, [
      { kind: "features", id: "a", operation: "upsert", row: { id: "wrong" } },
    ]).features.length,
    0,
  );
});

test('tiny Australian parcel centroid avoids cancellation in absolute coordinates',()=>{
 const center=propertyCentroid({type:'Polygon',coordinates:[[[144,-36.9999],[144.001,-36.9999],[144.001,-36.99989],[144,-36.9999]]]})!;
 assert.ok(Math.abs(center[0]-144.00066666666666)<1e-10);assert.ok(Math.abs(center[1]+36.999896666666665)<1e-10);
});

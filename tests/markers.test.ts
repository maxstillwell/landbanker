import { test } from "node:test";
import assert from "node:assert/strict";
import { MARKER_ICONS } from "../src/lib/markers/catalog";
import { markerInput } from "../src/lib/markers/model";
import { markerSvg } from "../src/components/markers/render";
const input = {
  id: "11111111-1111-4111-8111-111111111111",
  latitude: -37.85,
  longitude: 145.18,
  name: "School",
  icon: "school",
  description: "",
  color: "lime",
  size: "medium",
  show_label: false,
  status: "research_note",
  linked_property_id: null,
  linked_research_area_id: null,
};
test("manual markers validate bounded coordinates, curated styles and independent relationships", () => {
  assert.ok(markerInput.safeParse(input).success);
  for (const change of [
    { latitude: 91 },
    { longitude: 181 },
    { icon: "<script>" },
    { color: "#fff" },
    { size: "huge" },
    { name: "" },
    { linked_property_id: "other" },
    { created_by: "forged" },
  ])
    assert.equal(markerInput.safeParse({ ...input, ...change }).success, false);
});
test("all 33 curated Lucide icons produce bounded vector pin artwork", () => {
  assert.equal(MARKER_ICONS.length, 33);
  assert.equal(new Set(MARKER_ICONS.map((i) => i[0])).size, 33);
  for (const [key] of MARKER_ICONS) {
    const svg = markerSvg(key, "blue");
    assert.match(svg, /<svg /);
    assert.match(svg, /viewBox="0 0 48 56"/);
    assert.match(svg, /#64b5f6/);
    assert.ok(svg.length < 10000);
    assert.ok(!svg.includes("undefined"));
  }
});

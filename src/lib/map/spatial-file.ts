import { kml } from "@tmcw/togeojson";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import { validCollection } from "./drawing";

const MAX_FILE = 3_000_000;
const MAX_EXPANDED = 6_000_000;

/** Parse one bounded spatial file without persisting its original contents. */
export async function parseSpatialFile(file: File): Promise<FeatureCollection> {
  if (file.size > MAX_FILE) throw new Error("Choose a spatial file under 3 MB.");
  const lower = file.name.toLowerCase();
  let result: unknown;
  if (lower.endsWith(".geojson") || lower.endsWith(".json")) {
    result = JSON.parse(await file.text());
  } else {
    let text: string;
    if (lower.endsWith(".kmz")) {
      let chosen = false;
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (entry) => {
        if (!entry.name.toLowerCase().endsWith(".kml")) return false;
        if (chosen) throw new Error("This KMZ contains multiple KML files; import them separately.");
        if (entry.originalSize > MAX_EXPANDED) throw new Error("The KML inside this archive is too large.");
        chosen = true; return true;
      } });
      const data = Object.values(entries)[0];
      if (!data || data.length > MAX_EXPANDED) throw new Error("The archive needs a KML file under 6 MB.");
      text = strFromU8(data);
    } else if (lower.endsWith(".kml")) text = await file.text();
    else throw new Error("Choose KML, KMZ or GeoJSON.");
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("KML document declarations are not supported.");
    const xml = new DOMParser().parseFromString(text, "application/xml");
    if (xml.querySelector("parsererror")) throw new Error("The KML could not be parsed.");
    result = kml(xml);
  }
  const collection = result as FeatureCollection;
  if (!collection || collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || !collection.features.length || collection.features.length > 5000 || !validCollection(collection)) throw new Error("The file needs up to 5,000 valid, supported geographic features.");
  if (JSON.stringify(collection).length > MAX_FILE) throw new Error("The imported geometry is too large to save.");
  return { type: "FeatureCollection", features: collection.features.map((feature) => ({ ...feature, properties: { ...feature.properties, landos_source_filename: file.name.slice(0, 160) } })) };
}

function xml(value: unknown) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!); }
function coordinates(points: Position[]) { return points.map((point) => point.join(",")).join(" "); }
function kmlGeometry(geometry: Geometry): string {
  switch (geometry.type) {
    case "Point": return `<Point><coordinates>${coordinates([geometry.coordinates])}</coordinates></Point>`;
    case "LineString": return `<LineString><coordinates>${coordinates(geometry.coordinates)}</coordinates></LineString>`;
    case "Polygon": return `<Polygon>${geometry.coordinates.map((ring, index) => `<${index ? "innerBoundaryIs" : "outerBoundaryIs"}><LinearRing><coordinates>${coordinates(ring)}</coordinates></LinearRing></${index ? "innerBoundaryIs" : "outerBoundaryIs"}>`).join("")}</Polygon>`;
    case "MultiPoint": return `<MultiGeometry>${geometry.coordinates.map((point) => kmlGeometry({ type: "Point", coordinates: point })).join("")}</MultiGeometry>`;
    case "MultiLineString": return `<MultiGeometry>${geometry.coordinates.map((line) => kmlGeometry({ type: "LineString", coordinates: line })).join("")}</MultiGeometry>`;
    case "MultiPolygon": return `<MultiGeometry>${geometry.coordinates.map((polygon) => kmlGeometry({ type: "Polygon", coordinates: polygon })).join("")}</MultiGeometry>`;
    default: throw new Error("This geometry cannot be exported to KML.");
  }
}
export type SpatialExportFormat = "geojson" | "kml" | "kmz" | "csv";
export function spatialExport(features: Feature[], format: SpatialExportFormat): string | ArrayBuffer {
  const collection: FeatureCollection = { type: "FeatureCollection", features };
  if (!features.length || !validCollection(collection)) throw new Error("There is no valid geometry to export.");
  if (format === "geojson") return JSON.stringify(collection, null, 2);
  if (format === "csv") {
    const columns = [...new Set(features.flatMap((feature) => Object.keys(feature.properties || {})))].slice(0, 200);
    const cell = (value: unknown) => { let text = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? ""); if (/^\s*[=+\-@]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
    return [columns.map(cell).join(","), ...features.map((feature) => columns.map((column) => cell(feature.properties?.[column])).join(","))].join("\r\n");
  }
  const document = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${features.map((feature) => `<Placemark><name>${xml(feature.properties?.name || feature.properties?.title || "LandOS feature")}</name><ExtendedData>${Object.entries(feature.properties || {}).slice(0, 200).map(([key, value]) => `<Data name="${xml(key)}"><value>${xml(typeof value === "object" && value !== null ? JSON.stringify(value) : value)}</value></Data>`).join("")}</ExtendedData>${kmlGeometry(feature.geometry)}</Placemark>`).join("")}</Document></kml>`;
  if (format === "kml") return document;
  const bytes = zipSync({ "doc.kml": strToU8(document) });
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

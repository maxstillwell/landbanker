import "server-only";
import { addressQueries, parcelIdentifierQuery } from "./parcel-search-query";
import { esriRingsGeometry } from "./esri-rings";
import type { Feature, Point, Polygon, MultiPolygon } from "geojson";
import type {
  AddressResult,
  OfficialParcel,
  SupportedState,
} from "./parcel-types";
import { geometryMeasurement } from "./measurement";
import { recordProviderHealth } from "../provider-health";
export const parcelSources = {
  VIC: {
    name: "Vicmap / VicPlan",
    address:
      "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/VicPlan_PropertyAndParcel/MapServer/2",
    parcel:
      "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/VicPlan_PropertyAndParcel/MapServer/4",
  },
  NSW: {
    name: "NSW Spatial Services",
    address:
      "https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Geocoded_Addressing_Theme/MapServer/1",
    parcel:
      "https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/MapServer/8",
  },
} as const;
type Response = {
  features?: Feature[];
  error?: { message: string };
  exceededTransferLimit?: boolean;
};
async function query(
  url: string,
  params: Record<string, string>,
): Promise<Response> {
  const source = Object.entries(parcelSources).find(
    ([, source]) => source.address === url || source.parcel === url,
  );
  const id = source
    ? `${source[0].toLowerCase()}-${source[1].address === url ? "addresses" : "parcels"}`
    : "official-parcels";
  const provider = source?.[1].name || "Official parcel source",
    started = performance.now();
  try {
    const r = await fetch(
      `${url}/query?${new URLSearchParams({ ...params, f: params.f || "geojson", outSR: "4326", returnGeometry: "true" })}`,
      { signal: AbortSignal.timeout(15000), next: { revalidate: 3600 } },
    );
    if (!r.ok)
      throw new Error(
        "Official source temporarily unavailable. Your saved LandOS data is unaffected.",
      );
    const data = await r.json();
    if (data.error)
      throw new Error(
        "Official source could not answer this query. Try a full address or another location.",
      );
    if (params.f === "json" && data.features)
      data.features = data.features.map(
        (feature: {
          attributes: Record<string, unknown>;
          geometry: { rings: unknown };
        }) => ({
          type: "Feature",
          properties: feature.attributes,
          geometry: esriRingsGeometry(feature.geometry.rings),
        }),
      );
    recordProviderHealth(id, provider, "healthy", performance.now() - started);
    return data;
  } catch {
    recordProviderHealth(
      id,
      provider,
      "unavailable",
      performance.now() - started,
    );
    throw new Error(
      "Official source temporarily unavailable. Your saved LandOS data is unaffected.",
    );
  }
}
export async function searchOfficialAddresses(
  text: string,
  state: SupportedState,
): Promise<AddressResult[]> {
  const words = text.toUpperCase().split(/\W+/).filter(Boolean);
  let result: Response = {};
  for (const where of addressQueries(text, state)) {
    result = await query(parcelSources[state].address, {
      where,
      outFields:
        state === "VIC" ? "EZI_ADDRESS,PROPERTY_PFI" : "address,gurasid",
      resultRecordCount: "20",
    });
    if (result.features?.length) break;
  }
  return (result.features || [])
    .flatMap((feature) => {
      if (feature.geometry?.type !== "Point") return [];
      const [longitude, latitude] = (feature.geometry as Point).coordinates;
      const address = String(
        feature.properties?.[state === "VIC" ? "EZI_ADDRESS" : "address"] || "",
      );
      if (!address || !Number.isFinite(latitude) || !Number.isFinite(longitude))
        return [];
      return [
        {
          address,
          state,
          latitude,
          longitude,
          source: parcelSources[state].name,
          addressId: String(
            feature.properties?.[
              state === "VIC" ? "PROPERTY_PFI" : "gurasid"
            ] || "",
          ),
        },
      ];
    })
    .sort(
      (a, b) =>
        words.filter((w) => b.address.toUpperCase().includes(w)).length -
        words.filter((w) => a.address.toUpperCase().includes(w)).length,
    )
    .slice(0, 8);
}
export async function lookupOfficialParcels(
  point: AddressResult,
): Promise<OfficialParcel[]> {
  const { state, latitude, longitude } = point;
  // Bound official queries to the supported states; not an assertion of nationwide coverage.
  if (latitude < -40 || latitude > -27 || longitude < 140 || longitude > 154)
    throw new Error("Parcel lookup currently supports Victoria and NSW only.");
  const source = parcelSources[state];
  const result = await query(source.parcel, {
    f: state === "NSW" ? "json" : "geojson",
    where: "1=1",
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields:
      state === "VIC"
        ? "PARCEL_PFI,PARCEL_SPI,PARCEL_LOT_NUMBER,PARCEL_PLAN_NUMBER,PARCEL_REG_DATE"
        : "cadid,lotnumber,planlabel,lotidstring,lastupdate",
    resultRecordCount: "20",
  });
  return parcelsFromFeatures(result, point).map((parcel) =>
    point.address
      ? parcel
      : {
          ...parcel,
          address:
            [parcel.lot ? `Lot ${parcel.lot}` : null, parcel.plan]
              .filter(Boolean)
              .join(" ") || `Parcel ${parcel.sourceId}`,
        },
  );
}
function parcelsFromFeatures(
  result: Response,
  point: AddressResult,
): OfficialParcel[] {
  const { state } = point;
  const source = parcelSources[state];
  return (result.features || []).flatMap((feature) => {
    if (
      feature.geometry?.type !== "Polygon" &&
      feature.geometry?.type !== "MultiPolygon"
    )
      return [];
    const p = feature.properties || {};
    const id = p[state === "VIC" ? "PARCEL_PFI" : "cadid"];
    if (id == null) return [];
    const geometry = feature.geometry as Polygon | MultiPolygon;
    const updated = state === "NSW" ? p.lastupdate : null;
    const timestamp = updated ? new Date(updated) : null;
    return [
      {
        ...point,
        geometry,
        source: source.name,
        sourceUrl: source.parcel,
        sourceId: String(id),
        lot:
          p[state === "VIC" ? "PARCEL_LOT_NUMBER" : "lotnumber"]?.toString() ||
          null,
        plan:
          p[state === "VIC" ? "PARCEL_PLAN_NUMBER" : "planlabel"]?.toString() ||
          null,
        areaM2: geometryMeasurement(geometry).areaM2,
        sourceUpdatedAt:
          timestamp && Number.isFinite(timestamp.getTime())
            ? timestamp.toISOString()
            : null,
        retrievedAt: new Date().toISOString(),
      },
    ];
  });
}

export async function searchOfficialParcelIdentifiers(
  text: string,
  state: SupportedState,
): Promise<OfficialParcel[]> {
  const source = parcelSources[state];
  const result = await query(source.parcel, {
    f: state === "NSW" ? "json" : "geojson",
    where: parcelIdentifierQuery(text, state),
    outFields:
      state === "VIC"
        ? "PARCEL_PFI,PARCEL_SPI,PARCEL_LOT_NUMBER,PARCEL_PLAN_NUMBER"
        : "cadid,lotnumber,planlabel,lotidstring,lastupdate",
    resultRecordCount: "20",
  });
  return parcelsFromFeatures(result, {
    state,
    latitude: 0,
    longitude: 0,
    address: "",
    source: source.name,
  }).map((parcel) => {
    // A boundary vertex is on the returned parcel, unlike a centroid outside a concave parcel/hole.
    const coordinate =
      parcel.geometry.type === "Polygon"
        ? parcel.geometry.coordinates[0][0]
        : parcel.geometry.coordinates[0][0][0];
    return {
      ...parcel,
      longitude: coordinate[0],
      latitude: coordinate[1],
      address: `Lot ${parcel.lot || ""} ${parcel.plan || parcel.sourceId}`,
    };
  });
}

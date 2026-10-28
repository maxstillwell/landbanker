import type { Feature, FeatureCollection, Geometry } from "geojson";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import type { MapData, Observation, Parcel, SpatialLayer } from "@/lib/types";
import { validGeometry } from "@/lib/map/drawing";
import { circleFeature } from "@/lib/map/maplibre-scene";

type WorkspaceFeature = {
  id: string;
  layerId: string;
  layerName: string;
  feature: Feature;
};

function feature<T extends Geometry>(
  id: string,
  geometry: T,
  properties: Record<string, unknown>,
): Feature<T> {
  return { type: "Feature", id, properties: { ...properties, recordId: id }, geometry };
}

export function parcelsGeoJson(parcels: Parcel[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: parcels.flatMap<Feature>((parcel) => {
      const value = parcel.geometry as Geometry | Feature | null;
      const candidate = value?.type === "Feature" ? value.geometry : value;
      const boundary = validGeometry(candidate) && (candidate.type === "Polygon" || candidate.type === "MultiPolygon") ? candidate : null;
      return boundary
        ? [
            feature(parcel.id, boundary, {
              kind: "parcel",
              title: parcel.title,
              address: parcel.address || "",
              state: parcel.state || "",
              source: parcel.source || "",
            }),
          ]
        : validGeometry(candidate) && candidate.type === "Point"
          ? [feature(parcel.id, candidate, { kind: "parcel", title: parcel.title })]
        : parcel.latitude != null && parcel.longitude != null
          ? [
              feature(
                parcel.id,
                {
                  type: "Point",
                  coordinates: [parcel.longitude, parcel.latitude],
                },
                { kind: "parcel", title: parcel.title },
              ),
            ]
          : [];
    }),
  };
}

export function observationsGeoJson(
  observations: Observation[],
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: observations.map((observation) =>
      feature(
        observation.id,
        {
          type: "Point",
          coordinates: [observation.longitude, observation.latitude],
        },
        { kind: "observation", title: observation.title },
      ),
    ),
  };
}

export function workspaceFeaturesGeoJson(layers: SpatialLayer[]): {
  collection: FeatureCollection;
  index: Map<string, WorkspaceFeature>;
} {
  const index = new Map<string, WorkspaceFeature>();
  const features: Feature[] = [];
  for (const layer of layers) {
    if (layer.layer_kind === "radius") {
      const centre = layer.layer_data.centre;
      const rings = layer.layer_data.rings;
      if (Array.isArray(centre) && centre.length >= 2 && centre.slice(0, 2).every(Number.isFinite) && Array.isArray(rings)) {
        rings.forEach((ring: { kilometres?: unknown; colour?: unknown }, ringIndex: number) => {
          const km = Number(ring?.kilometres);
          if (!Number.isFinite(km) || km <= 0 || km > 500) return;
          const shape = circleFeature(centre[0], centre[1], km * 1000, typeof ring.colour === "string" ? ring.colour : "#d8ff43");
          shape.id = `radius-${ringIndex}`;
          shape.properties = { ...shape.properties, name: `${layer.name} · ${km} km`, drawing_kind: "Radius" };
          const id = `${layer.id}:${shape.id}`;
          index.set(id, { id, layerId: layer.id, layerName: layer.name, feature: shape });
          features.push(feature(id, shape.geometry, { kind: "workspace-feature", layerId: layer.id, layerName: layer.name, title: shape.properties.name, color: shape.properties.color }));
        });
      }
      continue;
    }
    const legacy = new Map<string, Set<string>>();
    for (const input of layer.geojson?.features || []) {
      if (input.id != null || !input.geometry) continue;
      const value = JSON.stringify([input.geometry, input.properties]);
      const hash = legacyHash(value);
      const group = legacy.get(hash) || new Set<string>();
      group.add(value);
      legacy.set(hash, group);
    }
    const occurrences = new Map<string, number>();
    for (const input of layer.geojson?.features || []) {
      if (!input.geometry) continue;
      let key = input.id != null ? String(input.id) : "";
      if (input.id == null) {
        const value = JSON.stringify([input.geometry, input.properties]);
        const hash = legacyHash(value);
        const collision = (legacy.get(hash)?.size || 0) > 1;
        const base = `legacy:${hash}${collision ? `:${value}` : ""}`;
        const count = occurrences.get(base) || 0;
        occurrences.set(base, count + 1);
        key = `${base}:${count}`;
      }
      const id = `${layer.id}:${key}`;
      const output = feature(id, input.geometry, {
        kind: "workspace-feature",
        layerId: layer.id,
        layerName: layer.name,
        title: String(
          input.properties?.name || input.properties?.title || layer.name,
        ),
      });
      index.set(id, {
        id,
        layerId: layer.id,
        layerName: layer.name,
        feature: input,
      });
      features.push(output);
    }
  }
  return { collection: { type: "FeatureCollection", features }, index };
}

function legacyHash(value: string) {
  return bytesToHex(sha256(utf8ToBytes(value)));
}

export function mapLibreCollections(data: MapData) {
  return {
    parcels: parcelsGeoJson(data.parcels),
    observations: observationsGeoJson(data.observations),
    workspace: workspaceFeaturesGeoJson(data.layers),
  };
}

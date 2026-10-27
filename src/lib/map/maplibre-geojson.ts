import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { MapData, Observation, Parcel, SpatialLayer } from "@/lib/types";

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
  return { type: "Feature", id, properties, geometry };
}

export function parcelsGeoJson(parcels: Parcel[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: parcels.flatMap((parcel) =>
      parcel.geometry
        ? [
            feature(parcel.id, parcel.geometry as Geometry, {
              kind: "parcel",
              title: parcel.title,
              address: parcel.address || "",
              state: parcel.state || "",
              source: parcel.source || "",
            }),
          ]
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
          : [],
    ),
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
    for (const input of layer.geojson?.features || []) {
      if (!input.geometry) continue;
      const id = `${layer.id}:${String(input.id || cryptoSafeId(input))}`;
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

function cryptoSafeId(feature: Feature) {
  // This only identifies an in-memory render feature; it is never persisted.
  return `${feature.geometry?.type || "geometry"}:${JSON.stringify(feature.geometry).length}`;
}

export function mapLibreCollections(data: MapData) {
  return {
    parcels: parcelsGeoJson(data.parcels),
    observations: observationsGeoJson(data.observations),
    workspace: workspaceFeaturesGeoJson(data.layers),
  };
}

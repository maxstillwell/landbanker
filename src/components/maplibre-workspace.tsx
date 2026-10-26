"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Geometry } from "geojson";
import Link from "next/link";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandLockup } from "@/components/brand-lockup";
import { ParcelSearch } from "@/components/parcel-search";
import { WorkspaceSelector } from "@/components/workspace-selector";
import { timeoutFetch } from "@/lib/network";
import {
  MAPLIBRE_BASEMAPS,
  OPENFREEMAP_ATTRIBUTION,
  isMapLibreBasemap,
  scopedMapLibrePreference,
  terrainTileJsonUrl,
  type MapLibreBasemap,
} from "@/lib/map/maplibre-config";
import { mapLibreCollections } from "@/lib/map/maplibre-geojson";
import type { OfficialParcel, SupportedState } from "@/lib/map/parcel-types";
import type { MapData, Observation, Parcel } from "@/lib/types";
import { formatArea } from "@/lib/map/measurement";
import { locationFromPayload, sendNative, subscribeNative } from "@/lib/native-bridge";
import { mergeMapPages, type MapPage } from "@/lib/map/data-pages";

type Props = {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  role: string;
};

type Selection =
  | { kind: "parcel"; parcel: Parcel }
  | { kind: "official"; parcel: OfficialParcel }
  | { kind: "observation"; observation: Observation }
  | { kind: "workspace-feature"; title: string; layerName: string }
  | null;

const EMPTY_DATA: MapData = {
  parcels: [],
  observations: [],
  layers: [],
  savedViews: [],
};
const INITIAL_CENTER: [number, number] = [143.8503, -37.5622];
const INITIAL_ZOOM = 10.5;
const TERRAIN_TILEJSON = terrainTileJsonUrl(
  process.env.NEXT_PUBLIC_LANDOS_TERRAIN_TILEJSON_URL,
);

function mapSource(map: Map, name: string) {
  return map.getSource(name) as GeoJSONSource | undefined;
}

function setGeoJson(map: Map, name: string, data: FeatureCollection) {
  mapSource(map, name)?.setData(data);
}

function emptyCollection(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function addWorkspaceSources(map: Map) {
  map.addSource("landos-parcels", { type: "geojson", data: emptyCollection() });
  map.addLayer({
    id: "landos-parcel-fill",
    type: "fill",
    source: "landos-parcels",
    paint: { "fill-color": "#a8cb71", "fill-opacity": 0.16 },
  });
  map.addLayer({
    id: "landos-parcel-outline",
    type: "line",
    source: "landos-parcels",
    paint: { "line-color": "#274d40", "line-width": 2.5 },
  });
  map.addSource("landos-observations", {
    type: "geojson",
    data: emptyCollection(),
  });
  map.addLayer({
    id: "landos-observation-points",
    type: "circle",
    source: "landos-observations",
    paint: {
      "circle-radius": 7,
      "circle-color": "#e29a55",
      "circle-stroke-color": "#fffaf0",
      "circle-stroke-width": 2,
    },
  });
  map.addSource("landos-workspace-features", {
    type: "geojson",
    data: emptyCollection(),
  });
  map.addLayer({
    id: "landos-workspace-fill",
    type: "fill",
    source: "landos-workspace-features",
    filter: ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]],
    paint: { "fill-color": "#86bccc", "fill-opacity": 0.16 },
  });
  map.addLayer({
    id: "landos-workspace-line",
    type: "line",
    source: "landos-workspace-features",
    paint: { "line-color": "#397b88", "line-width": 2 },
  });
  map.addLayer({
    id: "landos-workspace-points",
    type: "circle",
    source: "landos-workspace-features",
    filter: ["==", ["geometry-type"], "Point"],
    paint: { "circle-radius": 6, "circle-color": "#397b88" },
  });
  map.addSource("landos-official-parcel", {
    type: "geojson",
    data: emptyCollection(),
  });
  map.addLayer({
    id: "landos-official-parcel-fill",
    type: "fill",
    source: "landos-official-parcel",
    paint: { "fill-color": "#e29a55", "fill-opacity": 0.2 },
  });
  map.addLayer({
    id: "landos-official-parcel-outline",
    type: "line",
    source: "landos-official-parcel",
    paint: { "line-color": "#a95525", "line-width": 3 },
  });
  map.addSource("landos-location", { type: "geojson", data: emptyCollection() });
  map.addLayer({
    id: "landos-location-accuracy",
    type: "circle",
    source: "landos-location",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 18, 28],
      "circle-color": "#4b91f1",
      "circle-opacity": 0.16,
      "circle-stroke-color": "#4b91f1",
      "circle-stroke-width": 1,
    },
  });
  map.addLayer({
    id: "landos-location-point",
    type: "circle",
    source: "landos-location",
    paint: {
      "circle-radius": 7,
      "circle-color": "#4b91f1",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
    },
  });
}

function installBuildings(map: Map) {
  if (map.getLayer("landos-3d-buildings")) return true;
  const base = map
    .getStyle()
    .layers?.find(
      (layer) =>
        layer.type === "fill" &&
        "source" in layer &&
        "source-layer" in layer &&
        layer["source-layer"] === "building",
    ) as maplibregl.FillLayerSpecification | undefined;
  if (!base?.source || !base["source-layer"]) return false;
  map.addLayer({
    id: "landos-3d-buildings",
    type: "fill-extrusion",
    source: base.source,
    "source-layer": base["source-layer"],
    minzoom: 13,
    paint: {
      "fill-extrusion-color": "#b7ad9a",
      "fill-extrusion-height": [
        "coalesce",
        ["to-number", ["get", "render_height"], 0],
        ["to-number", ["get", "height"], 0],
      ],
      "fill-extrusion-base": [
        "coalesce",
        ["to-number", ["get", "render_min_height"], 0],
        ["to-number", ["get", "min_height"], 0],
      ],
      "fill-extrusion-opacity": 0.78,
    },
  });
  return true;
}

function boundsForGeometry(map: Map, geometry: Geometry) {
  const bounds = new maplibregl.LngLatBounds();
  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      bounds.extend([value[0], value[1]]);
      return;
    }
    value.forEach(visit);
  };
  if (geometry.type === "GeometryCollection") geometry.geometries.forEach((item) => {
    if (item.type !== "GeometryCollection") visit(item.coordinates);
  });
  else visit(geometry.coordinates);
  return bounds;
}

export default function MapLibreWorkspace({
  userId,
  workspaceId,
  workspaceName,
  role,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const watchId = useRef<number | null>(null);
  const [data, setData] = useState<MapData>(EMPTY_DATA);
  const [basemap, setBasemap] = useState<MapLibreBasemap>("streets");
  const [mode3d, setMode3d] = useState(false);
  const [buildingsAvailable, setBuildingsAvailable] = useState(false);
  const [terrainEnabled, setTerrainEnabled] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [parcelState, setParcelState] = useState<SupportedState>("VIC");
  const [notice, setNotice] = useState("");
  const [location, setLocation] = useState<{
    longitude: number;
    latitude: number;
    accuracy: number;
  } | null>(null);
  const [following, setFollowing] = useState(false);

  const collections = useMemo(() => mapLibreCollections(data), [data]);
  const dataRef = useRef(data);
  const collectionsRef = useRef(collections);
  const locationRef = useRef(location);
  const selectionRef = useRef(selection);
  const mode3dRef = useRef(mode3d);
  const appliedStyleRef = useRef<MapLibreBasemap>("streets");
  useEffect(() => {
    dataRef.current = data;
    collectionsRef.current = collections;
  }, [collections, data]);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);
  useEffect(() => {
    mode3dRef.current = mode3d;
  }, [mode3d]);
  const preferenceKey = useMemo(
    () => scopedMapLibrePreference(userId, workspaceId),
    [userId, workspaceId],
  );

  const applyCollections = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    setGeoJson(map, "landos-parcels", collections.parcels);
    setGeoJson(map, "landos-observations", collections.observations);
    setGeoJson(map, "landos-workspace-features", collections.workspace.collection);
  }, [collections]);

  const applyLocation = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    setGeoJson(
      map,
      "landos-location",
      location
        ? {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { accuracy: location.accuracy },
                geometry: {
                  type: "Point",
                  coordinates: [location.longitude, location.latitude],
                },
              },
            ],
          }
        : emptyCollection(),
    );
  }, [location]);

  const applyOfficialParcel = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const official = selection?.kind === "official" ? selection.parcel : null;
    setGeoJson(
      map,
      "landos-official-parcel",
      official
        ? {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { title: official.address },
                geometry: official.geometry,
              },
            ],
          }
        : emptyCollection(),
    );
  }, [selection]);

  const loadData = useCallback(async () => {
    try {
      // The parallel renderer deliberately uses the existing bounded first page.
      // Production viewport/change-feed parity remains a later migration gate.
      const response = await timeoutFetch("/api/map?page=0", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Workspace map data is unavailable.");
      setData(mergeMapPages([(await response.json()) as MapPage]));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load workspace data.");
    }
  }, []);

  const selectOfficialParcel = useCallback((parcel: OfficialParcel) => {
    setSelection({ kind: "official", parcel });
    mapRef.current?.fitBounds(boundsForGeometry(mapRef.current, parcel.geometry), {
      padding: 72,
      maxZoom: 18,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650,
    });
  }, []);

  const updateLocation = useCallback(
    (next: { longitude: number; latitude: number; accuracy: number }) => {
      setLocation(next);
      if (following)
        mapRef.current?.easeTo({
          center: [next.longitude, next.latitude],
          zoom: Math.max(16, mapRef.current.getZoom()),
          duration: 350,
        });
    },
    [following],
  );

  useEffect(() => {
    const raw = window.localStorage.getItem(preferenceKey);
    if (isMapLibreBasemap(raw)) setBasemap(raw);
  }, [preferenceKey]);

  useEffect(() => {
    if (!container.current) return;
    let map: Map;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: MAPLIBRE_BASEMAPS.streets.styleUrl,
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        maxPitch: 70,
      });
    } catch {
      setNotice("The 3D map engine could not start in this browser.");
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
    if (typeof document !== "undefined" && !window.matchMedia("(max-width: 767px)").matches)
      map.addControl(new maplibregl.FullscreenControl(), "bottom-left");
    const styleReady = () => {
      try {
        // A style can finish after a user switches base maps. Never add the
        // same source twice if MapLibre emits a second completion event.
        if (!map.getSource("landos-parcels")) addWorkspaceSources(map);
        const foundBuildings = installBuildings(map);
        setBuildingsAvailable(foundBuildings);
        if (!mode3dRef.current && map.getLayer("landos-3d-buildings"))
          map.setLayoutProperty("landos-3d-buildings", "visibility", "none");
        setGeoJson(map, "landos-parcels", collectionsRef.current.parcels);
        setGeoJson(map, "landos-observations", collectionsRef.current.observations);
        setGeoJson(
          map,
          "landos-workspace-features",
          collectionsRef.current.workspace.collection,
        );
        const currentLocation = locationRef.current;
        setGeoJson(
          map,
          "landos-location",
          currentLocation
            ? {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    properties: { accuracy: currentLocation.accuracy },
                    geometry: {
                      type: "Point",
                      coordinates: [currentLocation.longitude, currentLocation.latitude],
                    },
                  },
                ],
              }
            : emptyCollection(),
        );
        const currentSelection = selectionRef.current;
        const official =
          currentSelection?.kind === "official" ? currentSelection.parcel : null;
        setGeoJson(
          map,
          "landos-official-parcel",
          official
            ? {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    properties: { title: official.address },
                    geometry: official.geometry,
                  },
                ],
              }
            : emptyCollection(),
        );
      } catch {
        setNotice("The 3D basemap loaded with limited workspace overlays.");
      }
    };
    const click = (event: maplibregl.MapMouseEvent) => {
      const results = map.queryRenderedFeatures(event.point, {
        layers: [
          "landos-parcel-fill",
          "landos-observation-points",
          "landos-workspace-fill",
          "landos-workspace-line",
          "landos-workspace-points",
        ].filter((id) => Boolean(map.getLayer(id))),
      });
      const first = results[0];
      if (!first) return;
      const id = String(first.id || "");
      if (first.properties?.kind === "parcel") {
        const parcel = dataRef.current.parcels.find((item) => item.id === id);
        if (parcel) setSelection({ kind: "parcel", parcel });
      } else if (first.properties?.kind === "observation") {
        const observation = dataRef.current.observations.find((item) => item.id === id);
        if (observation) setSelection({ kind: "observation", observation });
      } else if (first.properties?.kind === "workspace-feature") {
        const feature = collectionsRef.current.workspace.index.get(id);
        if (feature)
          setSelection({
            kind: "workspace-feature",
            title: String(first.properties.title || "Workspace feature"),
            layerName: feature.layerName,
          });
      }
    };
    map.on("style.load", styleReady);
    map.on("click", click);
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container.current);
    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    applyCollections();
  }, [applyCollections]);
  useEffect(() => {
    applyLocation();
  }, [applyLocation]);
  useEffect(() => {
    applyOfficialParcel();
  }, [applyOfficialParcel]);

  useEffect(() => {
    const stop = subscribeNative((event) => {
      if (event.type === "locationUpdated") {
        const fix = locationFromPayload(event.payload);
        if (fix)
          updateLocation({
            longitude: fix.longitude,
            latitude: fix.latitude,
            accuracy: fix.accuracy,
          });
      }
      if (event.type === "locationPermissionChanged" && event.payload.status === "denied")
        setNotice("Location access was denied. You can enable it in Settings.");
    });
    return () => {
      stop();
      sendNative("stopLocationFollow");
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [updateLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (appliedStyleRef.current !== basemap) {
      appliedStyleRef.current = basemap;
      map.setStyle(MAPLIBRE_BASEMAPS[basemap].styleUrl);
    }
    window.localStorage.setItem(preferenceKey, basemap);
  }, [basemap, preferenceKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (mode3d) {
      map.setPitch(55);
      if (map.getLayer("landos-3d-buildings"))
        map.setLayoutProperty("landos-3d-buildings", "visibility", "visible");
    } else {
      map.setPitch(0);
      if (map.getLayer("landos-3d-buildings"))
        map.setLayoutProperty("landos-3d-buildings", "visibility", "none");
    }
  }, [mode3d]);

  function changeBasemap(next: MapLibreBasemap) {
    setBasemap(next);
    setNotice(`${MAPLIBRE_BASEMAPS[next].label} basemap selected.`);
  }

  function toggleTerrain() {
    const map = mapRef.current;
    if (!map || !TERRAIN_TILEJSON) return;
    if (terrainEnabled) {
      map.setTerrain(null);
      setTerrainEnabled(false);
      return;
    }
    if (!map.getSource("landos-terrain"))
      map.addSource("landos-terrain", {
        type: "raster-dem",
        url: TERRAIN_TILEJSON,
        tileSize: 512,
        maxzoom: 14,
      });
    map.setTerrain({ source: "landos-terrain", exaggeration: 1.15 });
    setTerrainEnabled(true);
  }

  function locate(keepFollowing: boolean) {
    setFollowing(keepFollowing);
    if (sendNative(keepFollowing ? "startLocationFollow" : "requestCurrentLocation")) return;
    if (!navigator.geolocation) {
      setNotice("Location is unavailable on this device.");
      return;
    }
    const success = (position: GeolocationPosition) => {
      const next = {
        longitude: position.coords.longitude,
        latitude: position.coords.latitude,
        accuracy: position.coords.accuracy,
      };
      updateLocation(next);
      mapRef.current?.easeTo({ center: [next.longitude, next.latitude], zoom: 16 });
    };
    const failure = () => setNotice("Unable to obtain your location.");
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (keepFollowing)
      watchId.current = navigator.geolocation.watchPosition(success, failure, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      });
    else
      navigator.geolocation.getCurrentPosition(success, failure, {
        enableHighAccuracy: true,
        timeout: 20000,
      });
  }

  function stopFollow() {
    setFollowing(false);
    sendNative("stopLocationFollow");
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }

  const selectedGeometry: Geometry | null =
    selection?.kind === "parcel"
      ? (selection.parcel.geometry as Geometry | null)
      : selection?.kind === "official"
        ? selection.parcel.geometry
        : null;
  const selectedTitle =
    selection?.kind === "parcel"
      ? selection.parcel.address || selection.parcel.title
      : selection?.kind === "official"
        ? selection.parcel.address
        : selection?.kind === "observation"
          ? selection.observation.title
          : selection?.kind === "workspace-feature"
            ? selection.title
            : "3D map preview";

  return (
    <main className="maplibre-app">
      <div ref={container} className="maplibre-canvas" aria-label="LandOS 3D map" />
      <header className="maplibre-header">
        <BrandLockup href="/app/map" compact />
        <WorkspaceSelector name={workspaceName} />
        <Link className="icon-button" href="/app/settings" aria-label="Workspace settings">⚙</Link>
      </header>
      <section className="maplibre-toolbar" aria-label="Map controls">
        <div className="maplibre-control-group" aria-label="Basemap">
          {(Object.keys(MAPLIBRE_BASEMAPS) as MapLibreBasemap[]).map((item) => (
            <button
              key={item}
              className={basemap === item ? "active" : ""}
              onClick={() => changeBasemap(item)}
              aria-pressed={basemap === item}
            >
              {MAPLIBRE_BASEMAPS[item].label}
            </button>
          ))}
        </div>
        <div className="maplibre-control-group">
          <button
            className={mode3d ? "active" : ""}
            onClick={() => setMode3d((current) => !current)}
            aria-pressed={mode3d}
          >
            {mode3d ? "2D view" : "3D view"}
          </button>
          <button onClick={() => mapRef.current?.easeTo({ pitch: 0, bearing: 0 })}>Reset north</button>
          <button onClick={() => locate(false)}>Locate</button>
          <button className={following ? "active" : ""} onClick={() => (following ? stopFollow() : locate(true))}>
            {following ? "Following" : "Follow"}
          </button>
        </div>
      </section>
      <aside className="maplibre-inspector" aria-live="polite">
        <div className="maplibre-inspector-heading">
          <div>
            <p className="eyebrow">MAP ENGINE PREVIEW</p>
            <h1>{selectedTitle}</h1>
          </div>
          {selection ? <button onClick={() => setSelection(null)} aria-label="Clear selection">×</button> : null}
        </div>
        {selection?.kind === "parcel" ? (
          <dl className="maplibre-details">
            <dt>Saved property</dt><dd>{selection.parcel.title}</dd>
            <dt>Area</dt><dd>{selection.parcel.hectares ? `${selection.parcel.hectares.toFixed(2)} ha` : "Not recorded"}</dd>
            <dt>Source</dt><dd>{selection.parcel.source || "Workspace"}</dd>
          </dl>
        ) : null}
        {selection?.kind === "official" ? (
          <dl className="maplibre-details">
            <dt>Official parcel</dt><dd>{selection.parcel.state} · {selection.parcel.sourceId}</dd>
            <dt>Lot / Plan</dt><dd>{[selection.parcel.lot, selection.parcel.plan].filter(Boolean).join(" / ") || "Not supplied"}</dd>
            <dt>Area</dt><dd>{formatArea(selection.parcel.areaM2)}</dd>
            <dt>Source</dt><dd>{selection.parcel.source}</dd>
          </dl>
        ) : null}
        {selection?.kind === "observation" ? <p>Field observation · open the established workspace to view notes and private media.</p> : null}
        {selection?.kind === "workspace-feature" ? <p>My Layer · {selection.layerName}</p> : null}
        {selectedGeometry ? <button onClick={() => mapRef.current?.fitBounds(boundsForGeometry(mapRef.current, selectedGeometry), { padding: 72, maxZoom: 18 })}>Fit property</button> : null}
        {!selection ? (
          <>
            <p className="maplibre-summary">A parallel MapLibre/WebGL experiment for this {role} workspace. Saved properties, observations and My Layers are read from the existing secure workspace; drawing, official overlays and sharing remain in the established Leaflet workspace during this validation stage.</p>
            <ParcelSearch
              key={`${userId}:${workspaceId}`}
              userId={userId}
              workspaceId={workspaceId}
              state={parcelState}
              identifyActive={false}
              onStateChange={setParcelState}
              onIdentify={() => setNotice("Map tap identify remains in the established workspace for this prototype.")}
              onSelect={selectOfficialParcel}
              onAddress={(address) => mapRef.current?.easeTo({ center: [address.longitude, address.latitude], zoom: 16 })}
            />
          </>
        ) : null}
        <div className="maplibre-engine-status">
          <strong>3D status</strong>
          <span>{buildingsAvailable ? "Building extrusion data is available where the basemap supplies heights." : "This basemap has no building source for extrusion."}</span>
          <button disabled={!TERRAIN_TILEJSON} onClick={toggleTerrain} aria-pressed={terrainEnabled}>
            {terrainEnabled ? "Terrain on" : TERRAIN_TILEJSON ? "Enable terrain" : "Terrain source not configured"}
          </button>
          <small>Building heights are source-derived and approximate. Terrain requires a reviewed raster-DEM TileJSON; no third-party paid service is configured.</small>
        </div>
        <Link className="maplibre-workflow-link" href="/app/map">Open full LandOS workspace</Link>
      </aside>
      {location ? <div className="maplibre-accuracy">Accuracy ±{Math.round(location.accuracy)} m</div> : null}
      {notice ? <div className="maplibre-notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div> : null}
      <div className="maplibre-attribution">{OPENFREEMAP_ATTRIBUTION}</div>
    </main>
  );
}

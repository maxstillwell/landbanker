"use client";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map-ui-polish.css";
import { MapIcon } from "./map-icon";
import {
  geometryBounds,
  latLng,
  setView,
  installScene,
  setSceneData,
  circleFeature,
  geometryFeature,
  type LatLng,
} from "@/lib/map/maplibre-scene";
import { installOfficialRasters } from "@/lib/map/maplibre-official";
import {
  MAPLIBRE_BASEMAPS,
  basemapAttribution,
  basemapStyle,
  isMapLibreBasemap,
  type MapLibreBasemap,
} from "@/lib/map/maplibre-config";
import { mapLibreCollections } from "@/lib/map/maplibre-geojson";
import { terrainProvider, availableTerrainProviders, TILEZEN_TEST_PROVIDER } from "@/lib/map/terrain-provider";
import { applyTerrain, terrainElevation, waitForTerrainSample, visibleTerrainCoverage, TERRAIN_SOURCE, elevationProfile, profileSummary, parcelElevation, type Position, type HeightSample } from "@/lib/map/terrain";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { OfficialMapLayers, useOfficialMapLayers } from "./official-map-layers";
import { CatalogueFeatureInspector, useCatalogueMapLayers, type LayerOptions } from "./catalogue-map-layers";
import { FloatingMapWidget } from "./floating-map-widget";
import { BasemapSelector } from "./basemap-selector";
import { BrandLockup } from "@/components/brand-lockup";
import * as exifr from "exifr";
import { browserClient } from "@/lib/supabase/browser";
import type {
  MapData,
  LocationFix,
  Observation,
  SpatialLayer,
  Parcel,
} from "@/lib/types";
import {
  sendNative,
  subscribeNative,
  locationFromPayload,
} from "@/lib/native-bridge";
import {
  apiRequest,
  listDrafts,
  removeDraft,
  storeDraft,
  processDraft,
  type FieldDraft,
  type QueuePhoto,
} from "@/lib/field-queue";
import {
  readLayerDraft,
  writeLayerDraft,
  readSpatialImportDraft,
  writeSpatialImportDraft,
  type SpatialImportDraft,
  type LocalLayerDraft,
} from "@/lib/layer-draft";
import { parseSpatialFile, spatialExport, type SpatialExportFormat } from "@/lib/map/spatial-file";
import { propertyGeometry } from "@/lib/planning/geometry";
import { isLocationGeometry } from "@/lib/map/location-geometry";
import { ParcelSearch } from "./parcel-search";
import { GlobalMapSearch } from "./global-map-search";
import type { MapSelection } from "@/lib/map/selection";
import type { OfficialParcel, SupportedState } from "@/lib/map/parcel-types";
import { timeoutFetch } from "@/lib/network";
import { mergeMapPages, type MapPage } from "@/lib/map/data-pages";
import { WorkspaceSelector } from "./workspace-selector";
import { LayerLibrary } from "./layer-library";
import type { CatalogLayer, ActiveLayer } from "@/lib/map/catalog-types";
import {
  safeSimple,
  translatePoints,
  insertVertex,
  deleteVertex,
} from "@/lib/map/drawing-edit";
import { useDrawingSession } from "@/lib/hooks/use-drawing-session";
import { ShareWorkspace } from "./share-workspace";
import { SavedViewPreview } from "./saved-view-preview";
import type { SavedViewInput } from "@/lib/map/view-input";
import { PropertyWorkspace } from "./property-workspace";
import { PhotoPreview } from "./photo-preview";
import { useViewport } from "@/lib/hooks/use-viewport";
import type { MapChange } from "@/lib/map/change-feed";
import { ShapeDraft } from "./shape-draft";
import { ElevationProfileChart } from "./elevation-profile-chart";
import {
  drawingGeometry,
  editablePoints,
  type DrawingKind,
} from "@/lib/map/drawing";
import type { Feature } from "geojson";
import { isOfficialParcelSource, officialSelectionId, summarizeAreas, updateSelectedAreas, type SelectedArea } from "@/lib/map/selection-summary";
import { polishDarkBasemap } from "@/lib/map/dark-style";
import { ExportMenu } from "./export-menu";
import { ResearchRelations } from "./research-relations";
import { safeStoredFeatureIds, stableFeatureId } from "@/lib/map/feature-identity";
import {
  formatArea,
  formatDistance,
  geometryMeasurement,
  distanceMetres,
} from "@/lib/map/measurement";
const emptyData: MapData = {
  parcels: [],
  observations: [],
  layers: [],
  savedViews: [],
};
function centerFieldPoint(
  map: MapLibreMap | null,
  latitude: number,
  longitude: number,
  zoom: number,
) {
  if (!map) return;
  const inspector = map.getContainer().parentElement?.querySelector(".inspector");
  const sheet = window.matchMedia("(max-width: 767px)").matches && inspector?.getAttribute("aria-hidden") !== "true"
    ? inspector?.getBoundingClientRect().height || 0
    : 0;
  map.jumpTo({
    center: [longitude, latitude],
    zoom,
    padding: { top: 0, bottom: sheet, left: 0, right: 0 },
  });
}
type Props = {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  role: string;
  esriApiKey?: string;
  adminTerrainPreview?: boolean;
};
type CameraView = { center: [number, number]; zoom: number; bearing: number; pitch: number };
type SelectedAreaDetail = SelectedArea & { detail: NonNullable<MapSelection> };
function cameraView(m: MapLibreMap): CameraView {
  const c = m.getCenter();
  return { center: [c.lng, c.lat], zoom: m.getZoom(), bearing: m.getBearing(), pitch: m.getPitch() };
}
function sameCamera(a: CameraView, b: CameraView) {
  return Math.abs(a.center[0] - b.center[0]) < 0.00001 && Math.abs(a.center[1] - b.center[1]) < 0.00001 && Math.abs(a.zoom - b.zoom) < 0.01 && Math.abs(a.bearing - b.bearing) < 0.1 && Math.abs(a.pitch - b.pitch) < 0.1;
}
export default function MapWorkspace({
  userId,
  workspaceId,
  workspaceName,
  role,
  esriApiKey,
  adminTerrainPreview,
}: Props) {
  const mapNode = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const cameraHistory = useRef<CameraView[]>([]);
  const cameraIndex = useRef(0);
  const historyNavigation = useRef(false);
  const [historyPosition, setHistoryPosition] = useState({ index: 0, length: 1 });
  const homeKey = `landos:map-home:v1:${userId}:${workspaceId}`;
  const [styleRevision, setStyleRevision] = useState(0);
  const basemapRef = useRef<MapLibreBasemap>("streets");
  const [basemap, setBasemap] = useState<MapLibreBasemap>("streets");
  const watch = useRef<number | null>(null);
  const followRef = useRef(false);
  const locateRequested = useRef(false);
  const [locating, setLocating] = useState(false);
  const [radiusKm, setRadiusKm] = useState("1");
  const [workspaceVisibility, setWorkspaceVisibility] = useState({ parcels: true, observations: true, features: true });
  const [layerOpacity, setLayerOpacity] = useState<Record<string, number>>({});
  const opacityKey = `landos:layer-opacity:v1:${userId}:${workspaceId}`;
  const [opacityScope, setOpacityScope] = useState("");
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(opacityKey) || "{}");
      const valid = Object.entries(saved && typeof saved === "object" ? saved : {}).filter(([id, value]) => id.length <= 100 && typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1).slice(0, 1000);
      setLayerOpacity(Object.fromEntries(valid) as Record<string, number>);
    } catch { setLayerOpacity({}); }
    setOpacityScope(opacityKey);
  }, [opacityKey]);
  useEffect(() => {
    if (opacityScope !== opacityKey) return;
    try { localStorage.setItem(opacityKey, JSON.stringify(layerOpacity)); } catch { /* Optional device preference. */ }
  }, [layerOpacity, opacityKey, opacityScope]);
  const locationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploading = useRef(false);
  const importInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [visibleParcelIds, setVisibleParcelIds] = useState<Set<string> | null>(
    null,
  );
  const [visibleUserLayerIds, setVisibleUserLayerIds] =
    useState<Set<string> | null>(null);
  const [catalog, setCatalog] = useState<CatalogLayer[]>([]);
  const [layerOptions, setLayerOptions] = useState<LayerOptions>({});
  const [activeLayers, setActiveLayers] = useState<ActiveLayer[]>([]);
  const [pendingView, setPendingView] = useState<{
    scope: string;
    id: string;
    view: SavedViewInput["view"];
  } | null>(null);
  const loadedPages = useRef(1);
  const requestGeneration = useRef(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [data, setData] = useState<MapData>(emptyData);
  const [overviewReady, setOverviewReady] = useState(false);
  const viewport = useViewport(map, `${userId}:${workspaceId}`, overviewReady);
  const refreshViewport = viewport.refresh;
  useEffect(() => {
    if (!viewport.error) setDismissedMapError("");
  }, [viewport.error]);
  const renderedData = useMemo<MapData>(() => {
    if (!viewport.ready) return emptyData;
    const byLayer = new Map<string, Feature[]>();
    for (const row of viewport.rows.features) {
      const list = byLayer.get(row.layer_id) || [];
      list.push(row.feature);
      byLayer.set(row.layer_id, list);
    }
    return {
      ...data,
      parcels: viewport.rows.parcels,
      observations: viewport.rows.observations,
      layers: [...byLayer]
        .map<SpatialLayer>(([id, features]) => ({
          ...data.layers.find((l) => l.id === id),
          id,
          workspace_id: workspaceId,
          name: data.layers.find((l) => l.id === id)?.name || "Workspace layer",
          layer_kind: "geojson",
          layer_data: {},
          metadata: {},
          geojson: { type: "FeatureCollection" as const, features },
        }))
        .concat(data.layers.filter((l) => l.layer_kind === "radius")),
    };
  }, [data, viewport.ready, viewport.rows, workspaceId]);
  const [parcelState, setParcelState] = useState<SupportedState>("VIC");
  const [identifyState, setIdentifyState] = useState<SupportedState | null>(
    null,
  );
  const identifyStateRef = useRef<SupportedState | null>(null);
  const [identifyBusy, setIdentifyBusy] = useState(false);
  const [identifiedParcels, setIdentifiedParcels] = useState<OfficialParcel[]>(
    [],
  );
  const [boundaryCandidates, setBoundaryCandidates] = useState<OfficialParcel[]>([]);
  const [previewCandidates, setPreviewCandidates] = useState<string[]>([]);
  const [candidateProperty, setCandidateProperty] = useState("");
  const [candidateLatitude, setCandidateLatitude] = useState("");
  const [candidateLongitude, setCandidateLongitude] = useState("");
  const [fix, setFix] = useState<LocationFix | null>(null);
  const [follow, setFollow] = useState(false);
  const [notice, setNotice] = useState("");
  const [dismissedMapError, setDismissedMapError] = useState("");
  const [draft, setDraft] = useState<FieldDraft | null>(null);
  const draftRef = useRef<FieldDraft | null>(null);
  const transientObservations = useRef(new Set<string>());
  const photoProcessing = useRef(0);
  const photoTasks = useRef(Promise.resolve());
  const nativePhotoActive = useRef(false);
  const [processingPhotos, setProcessingPhotos] = useState(0);
  const [queue, setQueue] = useState<FieldDraft[]>([]);
  const [online, setOnline] = useState(true);
  const [sheet, setSheet] = useState<"collapsed" | "medium" | "expanded">(
    "collapsed",
  );
  const [isMobile, setIsMobile] = useState(false);
  const [searchOpen,setSearchOpen]=useState(false);
  const [mobileMore, setMobileMore] = useState(false);
  const [sheetDrag, setSheetDrag] = useState(0);
  const dragStart = useRef<number | null>(null);
  const dragged = useRef(false);
  useEffect(() => { const media = window.matchMedia("(max-width: 767px)"); const update = () => { setIsMobile(media.matches); if (media.matches) { setRightOpen(false); setSheet("collapsed"); } }; update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  const layoutKey = `landos:workspace-layout:v2:${userId}:${workspaceId}`;
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [drawer, setDrawer] = useState<"search" | "layers" | "properties" | "research" | "observations" | "views">("layers");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [displayOpen,setDisplayOpen]=useState(false);
  const [researchVisible,setResearchVisible]=useState(true);
  const [highlightsVisible,setHighlightsVisible]=useState(true);
  const [labelsVisible,setLabelsVisible]=useState(true);
  const [recordSearch,setRecordSearch]=useState("");
  const [researchSearch,setResearchSearch]=useState("");
  const [observationSearch,setObservationSearch]=useState("");
  const [importDestination,setImportDestination]=useState<"property"|"research"|"layer">("layer");
  const [radiusOpen, setRadiusOpen] = useState(false);
  const [radiusPlacement, setRadiusPlacement] = useState(false);
  const radiusPlacementRef = useRef(false);
  const radiusClickRef = useRef<(lat:number,lng:number)=>void>(()=>{});
  const finishDrawingRef = useRef<()=>Promise<void>>(async()=>{});
  const rectangleDrag = useRef(false);
  const [discardedDraft,setDiscardedDraft] = useState<LocalLayerDraft|null>(null);
  const inspectorSize = "expanded";
  const [layoutScope, setLayoutScope] = useState("");
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(layoutKey) || "null");
      if (!window.matchMedia("(max-width: 767px)").matches && typeof saved?.leftOpen === "boolean") setLeftOpen(saved.leftOpen);
      if (!window.matchMedia("(max-width: 767px)").matches && typeof saved?.rightOpen === "boolean") setRightOpen(saved.rightOpen);
      if (["search", "layers", "properties", "research", "observations", "views"].includes(saved?.drawer)) setDrawer(saved.drawer);
    } catch {
      /* Device preference is optional. */
    }
    setLayoutScope(layoutKey);
  }, [layoutKey]);
  useEffect(() => {
    if (layoutScope !== layoutKey) return;
    try {
      localStorage.setItem(layoutKey, JSON.stringify({ leftOpen, rightOpen, inspectorSize, drawer }));
    } catch {
      /* Device preference is optional. */
    }
  }, [layoutKey, layoutScope, leftOpen, rightOpen, inspectorSize, drawer]);
  useEffect(() => {
    if (!leftOpen || drawer !== "search") return;
    const timer = window.setTimeout(() => document.querySelector<HTMLInputElement>(".workspace-library .parcel-search form input")?.focus(), 0);
    return () => clearTimeout(timer);
  }, [leftOpen, drawer]);
  const [mapMode, setMapMode] = useState<"2d" | "3d">("2d");
  const [parcelHeights, setParcelHeights] = useState<ReturnType<typeof parcelElevation>>(null);
  const [parcelHeightMessage, setParcelHeightMessage] = useState("");
  const [profilePoints, setProfilePoints] = useState<Position[]>([]);
  const [profile, setProfile] = useState<HeightSample[]>([]);
  const profileMode = useRef(false);
  const elevationMode = useRef(false);
  const [elevationActive, setElevationActive] = useState(false);
  const [elevationPosition, setElevationPosition] = useState<[number, number] | null>(null);
  const [profileDrawing, setProfileDrawing] = useState(false);
  useEffect(() => {
    const m = map.current;
    if (!m || !styleRevision) return;
    const id = "landos-elevation-profile";
    if (!m.getSource(id)) m.addSource(id, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    if (!m.getLayer(id)) m.addLayer({ id, type: "line", source: id, paint: { "line-color": "#ffca62", "line-width": 3 } });
    (m.getSource(id) as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: profilePoints.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: profilePoints } }] : [] });
  }, [profilePoints, styleRevision]);
  const [hillshade, setHillshade] = useState(false);
  const [terrainExaggeration, setTerrainExaggeration] = useState(1);
  const [pointElevation, setPointElevation] = useState<number | null>(null);
  const [pointStatus, setPointStatus] = useState<"unavailable" | "loading" | "available" | "timed-out" | "provider-error">("unavailable");
  const sampleAbort = useRef<AbortController | null>(null);
  const [terrainFailed,setTerrainFailed]=useState(false);
  const [terrainWaited,setTerrainWaited]=useState(false);
  const [terrainCoverage, setTerrainCoverage] = useState<"unknown" | "partial" | "loaded">("unknown");
  const providers = useMemo(() => [...availableTerrainProviders(terrainProvider({
    id: "configured", label: "Configured DEM", url: process.env.NEXT_PUBLIC_TERRAIN_TILEJSON_URL || undefined,
    tiles: process.env.NEXT_PUBLIC_TERRAIN_XYZ_URL ? [process.env.NEXT_PUBLIC_TERRAIN_XYZ_URL] : undefined,
    tileSize: process.env.NEXT_PUBLIC_TERRAIN_TILE_SIZE === "256" ? 256 : (!process.env.NEXT_PUBLIC_TERRAIN_TILE_SIZE || process.env.NEXT_PUBLIC_TERRAIN_TILE_SIZE === "512") ? 512 : undefined,
    maxzoom: process.env.NEXT_PUBLIC_TERRAIN_XYZ_URL ? Number(process.env.NEXT_PUBLIC_TERRAIN_MAXZOOM || "12") : undefined,
    datumVerified: process.env.NEXT_PUBLIC_TERRAIN_DATUM_VERIFIED === "1",
    attribution: process.env.NEXT_PUBLIC_TERRAIN_ATTRIBUTION,
    resolution: process.env.NEXT_PUBLIC_TERRAIN_RESOLUTION,
    datum: process.env.NEXT_PUBLIC_TERRAIN_DATUM,
    accuracy: process.env.NEXT_PUBLIC_TERRAIN_ACCURACY,
  }), process.env.NEXT_PUBLIC_TERRAIN_TEST_TILEZEN === "1", process.env.NODE_ENV === "development"), ...(adminTerrainPreview ? [{ ...TILEZEN_TEST_PROVIDER, id: "admin-preview", label: "Administrator terrain preview", tiles: ["/api/terrain-preview/{z}/{x}/{y}"] }] : [])], [adminTerrainPreview]);
  const [providerId, setProviderId] = useState(process.env.NEXT_PUBLIC_TERRAIN_PROVIDER || "configured");
  const dem = providers.find((provider) => provider.id === providerId) || providers[0] || null;
  const exaggerationRef = useRef(terrainExaggeration);
  exaggerationRef.current = terrainExaggeration;
  useEffect(() => { const m = map.current; if (!m || !elevationPosition || pointElevation === null || !labelsVisible) return; const el = document.createElement("div"); el.className = "map-measurement-label"; el.textContent = `${pointElevation.toFixed(1)} m (approx.)`; const marker = new maplibregl.Marker({ element: el }).setLngLat(elevationPosition).addTo(m); return () => { marker.remove(); }; }, [elevationPosition, pointElevation, styleRevision, labelsVisible]);

  useEffect(() => { const cancel = (event: KeyboardEvent) => { if (event.key === "Escape" && (elevationMode.current || profileMode.current)) { elevationMode.current = false; setElevationActive(false); profileMode.current = false; setProfileDrawing(false); setProfilePoints([]); sampleAbort.current?.abort(); setPointStatus("unavailable"); } }; window.addEventListener("keydown", cancel); return () => window.removeEventListener("keydown", cancel); }, []);
  useEffect(() => () => { sampleAbort.current?.abort(); }, [providerId, styleRevision, mapMode, terrainExaggeration]);
  useEffect(() => {
    const m = map.current;
    if (!m || !styleRevision || !dem) return;
    try { applyTerrain(m, dem, mapMode === "3d", hillshade, terrainExaggeration); }
    catch { setTerrainFailed(true); }
  }, [styleRevision, mapMode, hillshade, terrainExaggeration, dem]);
  useEffect(() => {
    const m = map.current;
    if (!m || !styleRevision || mapMode !== "3d" || !dem) return;
    let lastCheck = 0;
    const update = () => {
      try { setTerrainCoverage(visibleTerrainCoverage(m)); }
      catch { setTerrainCoverage("unknown"); }
    };
    const onRender = () => {
      if (performance.now() - lastCheck < 250) return;
      lastCheck = performance.now();
      update();
    };
    const onMove = () => setTerrainCoverage("unknown");
    update();
    m.on("movestart", onMove);
    m.on("render", onRender);
    m.on("idle", update);
    return () => { m.off("movestart", onMove); m.off("render", onRender); m.off("idle", update); };
  }, [styleRevision, mapMode, terrainExaggeration, dem]);
  const terrainMetadata = `Resolution: ${dem?.resolution || "unknown"}; vertical datum: ${dem?.datum || "unknown"}; accuracy: ${dem?.accuracy || "unknown"}.`;
  const [tab, setTab] = useState<"observations" | "layers" | "parcels">(
    "observations",
  );
  const [selection, setSelection] = useState<MapSelection>(null);
  const [selectedAreas, setSelectedAreas] = useState<SelectedAreaDetail[]>([]);
  const [selectedResearch, setSelectedResearch] = useState<{ layer: SpatialLayer; features: Feature[] } | null>(null);
  const [showDrawingArea, setShowDrawingArea] = useState(false);
  const [showDrawingEdges, setShowDrawingEdges] = useState(false);
  const [showParcelEdges, setShowParcelEdges] = useState(false);
  const [measurementScope, setMeasurementScope] = useState("");
  const measurementKey = `landos:measurements:v1:${userId}:${workspaceId}`;
  useEffect(() => { try { const p = JSON.parse(localStorage.getItem(measurementKey) || "{}"); setShowDrawingArea(p.area === true); setShowDrawingEdges(p.edges === true); setShowParcelEdges(p.parcelEdges === true); } catch { /* Optional device preference. */ } setMeasurementScope(measurementKey); }, [measurementKey]);
  useEffect(() => { if (measurementScope !== measurementKey) return; try { localStorage.setItem(measurementKey, JSON.stringify({ area: showDrawingArea, edges: showDrawingEdges, parcelEdges: showParcelEdges })); } catch { /* Optional device preference. */ } }, [measurementKey, measurementScope, showDrawingArea, showDrawingEdges, showParcelEdges]);
  const [deletedFeature, setDeletedFeature] = useState<{ layerId: string; feature: Feature } | null>(null);
  useEffect(() => { setParcelHeights(null); setParcelHeightMessage(""); }, [selectedAreas]);
  const selectedAreasRef = useRef<SelectedAreaDetail[]>([]);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectionDetails, setSelectionDetails] = useState(false);
  const [hitChoices, setHitChoices] = useState<{ id: string; kind: string; title: string; layerId?: string; shift: boolean }[]>([]);
  const multiSelectRef = useRef(false);
  const applyArea = useCallback((item: SelectedAreaDetail, shift = false) => {
    setSelectedResearch(null);
    const additive = shift || multiSelectRef.current;
    const existing = selectedAreasRef.current;
    const present = existing.some((entry) => entry.id === item.id);
    if (additive && !present && existing.length >= 50) {
      setNotice("Select up to 50 parcels or features at a time.");
      return;
    }
    const next = updateSelectedAreas(existing, item, additive);
    selectedAreasRef.current = next;
    setSelectedAreas(next);
    setSelection(additive && present ? null : item.detail);
    setSelectionDetails(next.length > 1);
  }, []);
  const areaSummary = useMemo(() => summarizeAreas(selectedAreas), [selectedAreas]);
  const clearAreas = useCallback(() => { selectedAreasRef.current = []; setSelectedAreas([]); setSelectedResearch(null); setSelection(null); setSelectionDetails(false); }, []);
  const removeArea = useCallback((id: string) => {
    const next = selectedAreasRef.current.filter((item) => item.id !== id);
    selectedAreasRef.current = next; setSelectedAreas(next); setSelection(null); setSelectionDetails(next.length > 0);
  }, []);
  const selectSavedParcel = useCallback((record: Parcel, shift = false) => {
    const id = record.state && record.source_parcel_id && isOfficialParcelSource(record.state, record.source) ? officialSelectionId(record.state, record.source_parcel_id) : `workspace:${record.id}`;
    applyArea({ id, label: record.address || record.title, source: record.source || "Workspace", kind: "parcel", geometry: null, location: record.longitude != null && record.latitude != null ? [record.longitude, record.latitude] : undefined, detail: { kind: "parcel", record } }, shift);
    void timeoutFetch(`/api/properties/${record.id}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok || !body.property) throw new Error("Property geometry unavailable");
      const property = body.property as Parcel;
      const next = selectedAreasRef.current.map((item) => item.id === id && item.detail.kind === "parcel" && item.detail.record.id === record.id ? { ...item, geometry: propertyGeometry(property.geometry), detail: { kind: "parcel" as const, record: property } } : item);
      selectedAreasRef.current = next; setSelectedAreas(next);
    }).catch(() => setNotice("Property boundary is unavailable; the area total is incomplete."));
  }, [applyArea]);
  const selected =
    selection?.kind === "observation"
      ? viewport.rows.observations.find((o) => o.id === selection.record.id) ||
        data.observations.find((o) => o.id === selection.record.id) ||
        selection.record
      : null;
  const selectedParcel = selection?.kind === "parcel" ? selection.record : null;
  const officialParcel = selection?.kind === "official-parcel" ? selection.record : null;
  const selectedBoundary = useMemo(() => propertyGeometry(selectedParcel?.geometry), [selectedParcel?.geometry]);
  const selectedLocation = useMemo(() => {
    const value = selectedParcel?.geometry as import("geojson").Geometry | import("geojson").Feature | null | undefined;
    const candidate = value?.type === "Feature" ? value.geometry : value;
    return candidate?.type === "Point" && isLocationGeometry(candidate) ? candidate : null;
  }, [selectedParcel?.geometry]);
  const selectedDrawing = selection?.kind === "drawing"
    ? selection.record.geojson?.features.find((f) => f.id != null && String(f.id) === selection.featureId) || mapLibreCollections({ ...emptyData, layers: [selection.record] }).workspace.index.get(selection.featureId)?.feature || [...mapLibreCollections({ ...emptyData, layers: [selection.record] }).workspace.index.values()].find((item) => String(item.feature.id) === selection.featureId)?.feature
    : null;
  const savedAreaPreference=selectedDrawing?.properties?.measurement_area;
  const savedEdgePreference=selectedDrawing?.properties?.measurement_edges;
  useEffect(()=>{if(typeof savedAreaPreference==="boolean")setShowDrawingArea(savedAreaPreference);if(typeof savedEdgePreference==="boolean")setShowDrawingEdges(savedEdgePreference);},[savedAreaPreference,savedEdgePreference,selectedDrawing?.id]);
  const selectedPropertyId = selectedParcel?.id;
  useEffect(() => {
    if (selection || draft) { if (draft || !multiSelectRef.current || !window.matchMedia("(max-width: 767px)").matches) { setRightOpen(true); if (window.matchMedia("(max-width: 767px)").matches) setSheet(draft ? "expanded" : "medium"); } setLeftOpen(false); }
  }, [selection, draft]);
  useEffect(() => {
    function changed(event: Event) {
      const detail = (
        event as CustomEvent<{ scope: string; changes: MapChange[] }>
      ).detail;
      if (detail?.scope !== `${userId}:${workspaceId}`) return;
      const changes = detail.changes.filter((c) => !c.viewport_only);
      setData((current) => {
        const merge = (rows: { id: string }[], kind: MapChange["kind"]) => {
          const entries = new Map(rows.map((row) => [row.id, row]));
          for (const c of changes.filter((c) => c.kind === kind)) {
            if (c.operation === "delete") entries.delete(c.id);
            else if (c.row) {
              const row =
                kind === "layers"
                  ? {
                      ...(c.row as SpatialLayer),
                      geojson:
                        (entries.get(c.id) as SpatialLayer | undefined)
                          ?.geojson || null,
                    }
                  : (c.row as { id: string });
              entries.set(c.id, row);
            }
          }
          return [...entries.values()].slice(0, 1000);
        };
        const layers = (merge(current.layers, "layers") as SpatialLayer[]).map(
          (layer) => {
            if (!layer.geojson) return layer;
            const features = new Map(
              layer.geojson.features.map((f) => [String(f.id), f]),
            );
            for (const change of detail.changes.filter(
              (c) => c.kind === "features",
            )) {
              const row = change.row as
                { layer_id: string; feature: Feature } | undefined;
              if (change.operation === "delete" && !change.viewport_only)
                features.delete(change.id);
              else if (row?.layer_id === layer.id)
                features.set(change.id, row.feature);
            }
            return {
              ...layer,
              geojson: {
                type: "FeatureCollection" as const,
                features: [...features.values()],
              },
            };
          },
        );
        return {
          ...current,
          parcels: merge(current.parcels, "parcels") as Parcel[],
          observations: merge(
            current.observations,
            "observations",
          ) as Observation[],
          layers,
        };
      });
      setSelection((current) => {
        if (!current) return current;
        if (current.kind === "official-parcel") return current;
        const kind =
          current.kind === "parcel"
            ? "parcels"
            : current.kind === "observation"
              ? "observations"
              : current.kind === "drawing"
                ? "layers"
                : null;
        const change = changes.find(
          (c) => c.kind === kind && c.id === current.record.id,
        );
        if (change?.operation === "delete") return null;
        if (
          current.kind === "drawing" &&
          changes.some(
            (c) =>
              c.kind === "features" &&
              c.id === current.featureId &&
              c.operation === "delete",
          )
        )
          return null;
        if (current.kind === "parcel" && change?.row)
          return { ...current, record: change.row as Parcel };
        return current;
      });
    }
    window.addEventListener("landos:map-data-changed", changed);
    return () => window.removeEventListener("landos:map-data-changed", changed);
  }, [userId, workspaceId]);
  useEffect(() => {
    if (!selectedPropertyId) return;
    setCandidateProperty("");
    setBoundaryCandidates([]);
    setPreviewCandidates([]);
    const controller = new AbortController();
    fetch(`/api/properties/${selectedPropertyId}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Property unavailable");
        return body.property as Parcel;
      })
      .then((property) => {
        if (controller.signal.aborted) return;
        setSelection((current) =>
          current?.kind === "parcel" && current.record.id === selectedPropertyId
            ? { kind: "parcel", record: property }
            : current,
        );
        const boundary = propertyGeometry(property.geometry);
        const next = selectedAreasRef.current.map((item) => item.detail.kind === "parcel" && item.detail.record.id === property.id ? { ...item, geometry: boundary, detail: { kind: "parcel" as const, record: property } } : item);
        selectedAreasRef.current = next;
        setSelectedAreas(next);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setNotice(
            "Property details temporarily unavailable. Saved data is unaffected.",
          );
      });
    return () => controller.abort();
  }, [selectedPropertyId, workspaceId, userId]);
  function setSelected(record: Observation | null) {
    setSelection(record ? { kind: "observation", record } : null);
  }
  const selectOfficialParcel = useCallback((record: OfficialParcel, shift = false, fit = true) => {
    applyArea({ id: officialSelectionId(record.state, record.sourceId), label: record.address || record.sourceId, source: record.source, kind: "parcel", geometry: record.geometry, detail: { kind: "official-parcel", record } }, shift);
    setTab("parcels");
    setSheet("medium");
    if (map.current && fit && !shift && !multiSelectRef.current) {
      const boundary = geometryBounds(record.geometry);
      map.current.fitBounds(boundary, {
        padding: 30,
        maxZoom: 18,
      });
    }
  }, [applyArea]);
  const selectOfficialOnMap = useCallback((record: OfficialParcel, shift: boolean) => selectOfficialParcel(record, shift, false), [selectOfficialParcel]);
  const [localLayer, setLocalLayer] = useState<LocalLayerDraft | null>(null);
  const [spatialImport, setSpatialImport] = useState<SpatialImportDraft | null>(null);
  const [importScope, setImportScope] = useState("");
  const importWrites = useRef(Promise.resolve());
  const [importSaving, setImportSaving] = useState(false);
  const panelRevision = useRef(0);
  useEffect(() => { let active = true; void readSpatialImportDraft(userId, workspaceId).then((draft) => { if (!active) return; setSpatialImport(draft); if (draft) { setTab("layers"); setRightOpen(true); setSheet("expanded"); setNotice("An unfinished spatial import was restored from this device."); } setImportScope(`${userId}:${workspaceId}`); }).catch(() => { if (active) setNotice("Unable to read the spatial import draft on this device."); }); return () => { active = false; }; }, [userId, workspaceId]);
  useEffect(() => { if (importScope !== `${userId}:${workspaceId}`) return; importWrites.current = importWrites.current.catch(() => {}).then(() => writeSpatialImportDraft(userId, workspaceId, spatialImport)); void importWrites.current.catch(() => setNotice("Unable to preserve the import preview on this device. Keep this screen open.")); }, [spatialImport, importScope, userId, workspaceId]);
  const updateLocalLayer = useCallback(
    async (value: LocalLayerDraft | null) => {
      setLocalLayer(value);
      try {
        await writeLayerDraft(userId, workspaceId, value);
        return true;
      } catch {
        setNotice(
          "Unable to preserve layer draft. Keep this screen open until saved to Workspace.",
        );
        return false;
      }
    },
    [userId, workspaceId],
  );
  useEffect(() => {
    let active = true;
    void readLayerDraft(userId, workspaceId)
      .then((value) => {
        if (active) setLocalLayer(value);
      })
      .catch(() => setNotice("Device layer storage unavailable."));
    return () => {
      active = false;
    };
  }, [userId, workspaceId]);
  const session = useDrawingSession(userId, workspaceId);
  const inspectOfficial = useCallback(() => {
    setSelection(null);
    setSelectionDetails(false);
    setTab("layers");
    setRightOpen(true);
    setSheet("medium");
  }, []);
  const officialLayers = useOfficialMapLayers({
    map,
    revision: styleRevision,
    blocked: Boolean(session.active || draft || identifyState || elevationActive || profileDrawing || radiusPlacement),
    onPick: inspectOfficial,
    onParcel: selectOfficialOnMap,
  });
  const officialModeRef = useRef(officialLayers.mode);
  officialModeRef.current = officialLayers.mode;
  const clearOfficialInspector = officialLayers.setSelected;
  const inspectCatalogue = useCallback(()=>{clearOfficialInspector(null);setSelectedResearch(null);inspectOfficial();},[clearOfficialInspector,inspectOfficial]);
  const catalogueLayers = useCatalogueMapLayers({map,revision:styleRevision,catalog,active:activeLayers,options:layerOptions,
    blocked:Boolean(session.active || draft || identifyState || elevationActive || profileDrawing || radiusPlacement),onPick:inspectCatalogue});
  const clearCatalogueInspector = catalogueLayers.setSelected;
  useEffect(()=>{if(selection || officialLayers.selected || selectedResearch)clearCatalogueInspector(null);},[selection,officialLayers.selected,selectedResearch,clearCatalogueInspector]);
  useEffect(() => {
    if (selection?.kind === "parcel" || selection?.kind === "official-parcel")
      clearOfficialInspector(null);
  }, [selection?.kind, clearOfficialInspector]);
  const drawMode = Boolean(session.active);
  const activeTool = drawMode ? `draw-${session.active!.kind.toLowerCase()}` : elevationActive ? "select-elevation" : profileDrawing ? "draw-elevation-profile" : radiusPlacement ? "draw-radius" : "navigate";
  useEffect(()=>{const m=map.current;if(!m||!(drawMode||profileDrawing||elevationActive||radiusPlacement))return;const zoom=m.doubleClickZoom.isEnabled();m.doubleClickZoom.disable();return()=>{if(zoom)m.doubleClickZoom.enable();};},[drawMode,profileDrawing,elevationActive,radiusPlacement]);
  const activeDrawing = session.active;
  const discardDrawing = session.discard;
  useEffect(() => { const cancel = (event: KeyboardEvent) => { if (event.key !== "Escape" || !activeDrawing) return; if (!window.confirm("Cancel this unfinished drawing?")) return; drawing.current = false; void discardDrawing().catch(() => setNotice("Unable to discard the drawing; its device draft is preserved.")); }; window.addEventListener("keydown", cancel); return () => window.removeEventListener("keydown", cancel); }, [activeDrawing, discardDrawing]);
  const kind: DrawingKind = session.active?.kind || "Polygon";
  useEffect(() => { const m = map.current; if (!m) return; m.getCanvas().style.cursor = elevationActive || profileDrawing || drawMode || radiusPlacement ? "crosshair" : ""; return () => { m.getCanvas().style.cursor = ""; }; }, [elevationActive, profileDrawing, drawMode, radiusPlacement, styleRevision]);
  const drawPoints = useMemo(
    () => session.active?.points.map((p) => latLng(p[1], p[0])) || [],
    [session.active?.points],
  );
  useEffect(() => {
    const m = map.current;
    if (!m || !styleRevision || !labelsVisible) return;
    const editing = Boolean(session.active?.originalFeature);
    const geometry = drawMode ? drawingGeometry(kind, session.active!.points) : localLayer?.geojson.features[0]?.geometry || selectedDrawing?.geometry || officialParcel?.geometry || null;
    if (!geometry) return;
    const temporary = localLayer?.geojson.features[0]?.properties;
    const showEdges = localLayer ? temporary?.measurement_edges === true : selectedDrawing || editing || drawMode ? showDrawingEdges : showParcelEdges;
    const showArea = localLayer ? temporary?.measurement_area !== false : Boolean((selectedDrawing || editing || drawMode) && showDrawingArea);
    if (!showEdges && !showArea) return;
    const lines = geometry.type === "LineString" ? [geometry.coordinates] : geometry.type === "Polygon" ? geometry.coordinates : geometry.type === "MultiPolygon" ? geometry.coordinates.flat() : [];
    const segments = lines.flatMap((line) => line.slice(1).map((point, i) => ({ a: line[i], b: point })));
    const stride = Math.max(1, Math.ceil(segments.length / 40));
    const markers: maplibregl.Marker[] = [];
    const add = (position: number[], text: string) => {
      if (!Number.isFinite(position[0]) || !Number.isFinite(position[1])) return;
      const el = document.createElement("div"); el.className = "map-measurement-label"; el.textContent = text;
      markers.push(new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([position[0], position[1]]).addTo(m));
    };
    if (showEdges) segments.forEach(({ a, b }, i) => { if (i % stride === 0) add([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], formatDistance(distanceMetres(a, b))); });
    if (showArea && lines.length) {
      const bounds = geometryBounds(geometry); const centre = bounds.getCenter(); const measurement = geometryMeasurement(geometry);
      add([centre.lng, centre.lat], measurement.areaM2 ? formatArea(measurement.areaM2) : formatDistance(measurement.distanceM));
    }
    return () => markers.forEach((marker) => marker.remove());
  }, [selectedDrawing, officialParcel, showDrawingArea, showDrawingEdges, showParcelEdges, styleRevision, session.active, kind, localLayer, drawMode, labelsVisible]);
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const changeSession = session.change;
  const sessionRef = session.ref;
  const setDrawPoints = useCallback(
    (value: LatLng[] | ((points: LatLng[]) => LatLng[])) => {
      const current = sessionRef.current;
      if (!current) return;
      const points =
        typeof value === "function"
          ? value(current.points.map((p) => latLng(p[1], p[0])))
          : value;
      if (points.length > 200) {
        setNotice(
          "Up to 200 editable vertices. Dense imported geometry remains view-only.",
        );
        return;
      }
      const xy: [number, number][] = points.map((p) => [p.lng, p.lat]);
      const min =
        current.kind === "Polygon" ? 3 : current.kind === "Point" ? 1 : 2;
      if (xy.length >= min && !safeSimple(current.kind, xy)) {
        setNotice(
          "This edit would make the shape invalid. Try another position.",
        );
        return;
      }
      changeSession({ points: xy }, true);
    },
    [changeSession, sessionRef],
  );
  const drawing = useRef(false);
  const drawKind = useRef<DrawingKind>("Polygon");
  const canManage = ["owner", "admin"].includes(role);
  const canWrite = ["owner", "admin", "editor"].includes(role);
  const reload = useCallback(async () => {
    const generation = ++requestGeneration.current;
    try {
      const pages = await Promise.all(
        Array.from({ length: loadedPages.current }, async (_, page) => {
          const r = await timeoutFetch(`/api/map?overview=1&page=${page}`, {
            cache: "no-store",
          });
          if (!r.ok)
            throw new Error(
              "Session or connection unavailable. Your device drafts are safe.",
            );
          return (await r.json()) as MapPage;
        }),
      );
      if (generation !== requestGeneration.current) return true;
      setData(mergeMapPages(pages));
      setOverviewReady(true);
      refreshViewport();
      setHasMore(Object.values(pages.at(-1)!.pagination.hasMore).some(Boolean));
      return true;
    } catch (e) {
      if (generation === requestGeneration.current)
        setNotice(e instanceof Error ? e.message : "Unable to refresh");
      return false;
    }
  }, [refreshViewport]);
  async function loadMore() {
    if (loadingMore) return;
    if (loadedPages.current >= 10) {
      setNotice(
        "The first 1,000 records per category are loaded. Larger workspaces need additional paging support.",
      );
      return;
    }
    setLoadingMore(true);
    loadedPages.current += 1;
    try {
      if (!(await reload())) loadedPages.current -= 1;
    } finally {
      setLoadingMore(false);
    }
  }
  const reloadLibrary = useCallback(async (fresh = false) => {
    try {
      const response = await fetch("/api/layer-library", { cache: "no-store" });
      if (!response.ok) throw new Error("Layer Library unavailable");
      const result = await response.json();
      setCatalog(result.catalog);
      setActiveLayers((current) => result.active.map((layer: ActiveLayer) => ({ ...layer, visible: fresh ? false : (current.find((item) => item.catalog_id === layer.catalog_id)?.visible ?? false) })));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Layer Library unavailable");
    }
  }, []);
  useEffect(() => {
    void reloadLibrary(true);
  }, [reloadLibrary]);
  useEffect(() => {
    const m = map.current;
    if (!m?.getSource("landos-parcels")) return;
    return installOfficialRasters(
      m,
      [...activeLayers]
        .sort((a, b) => b.position - a.position)
        .flatMap((item) => {
          const source = catalog.find(
            (l) => l.id === item.catalog_id && l.enabled,
          );
          return source && item.visible
            ? [{ ...source, opacity: Number(item.opacity) }]
            : [];
        }),
    );
  }, [catalog, activeLayers, styleRevision]);
  async function changeOfficialLayer(item: ActiveLayer, remove = false) {
    const previous = activeLayers;
    setActiveLayers((current) =>
      remove
        ? current.filter((l) => l.catalog_id !== item.catalog_id)
        : [
            ...current.filter((l) => l.catalog_id !== item.catalog_id),
            item,
          ].sort((a, b) => a.position - b.position),
    );
    try {
      await apiRequest("/api/layer-library", {
        id: item.catalog_id,
        action: remove ? "remove" : "save",
        visible: item.visible,
        opacity: Number(item.opacity),
        position: item.position,
      });
      await reloadLibrary();
    } catch (e) {
      setActiveLayers(previous);
      setNotice(e instanceof Error ? e.message : "Layer change failed");
    }
  }
  async function reorderOfficialLayers(ids: string[]) {
    const previous = activeLayers;
    setActiveLayers(
      ids.map((id, position) => ({
        ...activeLayers.find((item) => item.catalog_id === id)!,
        position,
      })),
    );
    try {
      const response = await timeoutFetch("/api/layer-library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Layer ordering failed");
    } catch (e) {
      setActiveLayers(previous);
      setNotice(e instanceof Error ? e.message : "Layer ordering failed");
    }
  }
  const reloadQueue = useCallback(async () => {
    try {
      setQueue(await listDrafts(userId, workspaceId));
    } catch {
      setNotice(
        "Device storage unavailable. Keep this screen open until upload succeeds.",
      );
    }
  }, [userId, workspaceId]);
  const saveDraft = useCallback(
    async (d: FieldDraft) => {
      draftRef.current = d;
      setDraft(d);
      try {
        const meaningful = Boolean(d.input.title.trim() || d.input.notes.trim() || d.photos.length || d.photoSelection || d.input.metadata?.location_intentional);
        if (transientObservations.current.has(d.id) && !meaningful) return;
        transientObservations.current.delete(d.id);
        await storeDraft(d);
        await reloadQueue();
      } catch {
        setNotice(
          "Unable to preserve this draft on device. Do not close this screen.",
        );
      }
    },
    [reloadQueue],
  );
  const pauseObservation = useCallback(async () => {
    const current = draftRef.current;
    if (!current) return true;
    if (current.status === "uploading" || photoProcessing.current || (current.photoSelection && nativePhotoActive.current)) {
      setNotice("Wait for the current photo or upload operation to finish.");
      return false;
    }
    try {
      if (transientObservations.current.has(current.id)) transientObservations.current.delete(current.id);
      else await storeDraft(current);
      if (draftRef.current?.id === current.id) {
        draftRef.current = null;
        setDraft(null);
      }
      await reloadQueue();
      return true;
    } catch {
      setNotice("Unable to preserve this draft on device. Keep this screen open until it is saved.");
      return false;
    }
  }, [reloadQueue]);
  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        void pauseObservation().then((saved) => { if (saved) window.dispatchEvent(new Event("landos:focus-search")); });
      }
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, [pauseObservation]);
  const updateLocation = useCallback((location: LocationFix) => {
    setLocating(false);
    if (locationTimer.current) clearTimeout(locationTimer.current);
    setFix(location);
    if (map.current && (followRef.current || locateRequested.current))
      centerFieldPoint(
        map.current,
        location.latitude,
        location.longitude,
        Math.max(16, map.current.getZoom()),
      );
    locateRequested.current = false;
  }, []);
  function armParcelIdentify(state: SupportedState) {
    const next = identifyStateRef.current === state ? null : state;
    identifyStateRef.current = next;
    setIdentifyState(next);
    if (next) setLeftOpen(false);
    setIdentifiedParcels([]);
    setNotice(
      next
        ? `Tap the map to identify an official ${state} parcel.`
        : "Map parcel identify cancelled.",
    );
  }
  const identifyParcelAt = useCallback(
    async (state: SupportedState, latitude: number, longitude: number) => {
      setIdentifyBusy(true);
      setIdentifiedParcels([]);
      try {
        const response = await timeoutFetch(
          `/api/parcels/lookup?${new URLSearchParams({ state, latitude: String(latitude), longitude: String(longitude), address: "" })}`,
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Official parcel identify failed");
        const parcels = (result.parcels || []) as OfficialParcel[];
        if (parcels.length === 1) selectOfficialParcel(parcels[0]);
        else if (parcels.length > 1) {
          setIdentifiedParcels(parcels);
          setTab("parcels");
          setLeftOpen(false);
          setRightOpen(true);
          setSheet("medium");
          setNotice("Multiple official parcels found. Choose one to preview.");
        } else
          setNotice(
            "No official parcel was returned at that point. Check the selected state or try nearby.",
          );
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "Parcel identify failed");
      } finally {
        setIdentifyBusy(false);
      }
    },
    [selectOfficialParcel],
  );
  useEffect(() => {
    if (!mapNode.current) return;
    let m: MapLibreMap;
    try {
      m = new maplibregl.Map({
        container: mapNode.current,
        style: MAPLIBRE_BASEMAPS.streets.styleUrl,
        center: [143.8503, -37.5622],
        zoom: 11,
        maxPitch: 70,
        boxZoom: false,
      });
    } catch {
      setNotice(
        "MapLibre could not start. Your device drafts are preserved; use a browser with WebGL enabled.",
      );
      return;
    }
    map.current = m;
    m.addControl(new maplibregl.NavigationControl(), "bottom-left");
    m.on("style.load", () => {
      sampleAbort.current?.abort(); setPointStatus("unavailable"); setPointElevation(null);
      if(basemapRef.current === "dark")polishDarkBasemap(m);
      installScene(m);
      setStyleRevision((n) => n + 1);
    });
    const storageKey = `landos:map-camera:v1:${userId}:${workspaceId}`;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (
        stored &&
        Array.isArray(stored.center) &&
        stored.center.length === 2 &&
        stored.center.every(Number.isFinite) &&
        Math.abs(stored.center[0]) <= 180 &&
        Math.abs(stored.center[1]) <= 85 &&
        Number.isFinite(stored.zoom)
      ) {
        m.jumpTo({
          center: stored.center,
          zoom: Math.max(1, Math.min(20, stored.zoom)),
          pitch: 0,
        });
      }
      if (isMapLibreBasemap(stored?.basemap) || ["satellite", "hybrid", "nsw-aerial"].includes(stored?.basemap)) {
        const restoredBasemap: MapLibreBasemap = stored.basemap === "hybrid" && (esriApiKey || adminTerrainPreview) ? "hybrid" : ["esri-satellite", "satellite"].includes(stored.basemap) && (esriApiKey || adminTerrainPreview) ? "esri-satellite" : ["light", "dark"].includes(stored.basemap) ? stored.basemap : "streets";
        setBasemap(restoredBasemap);
        basemapRef.current = restoredBasemap;
        m.setStyle(basemapStyle(restoredBasemap, esriApiKey, adminTerrainPreview));
      }
    } catch {
      /* Device storage restrictions must not prevent map use. */
    }
    cameraHistory.current = [cameraView(m)];
    cameraIndex.current = 0;
    setHistoryPosition({ index: 0, length: 1 });
    m.on("moveend", (event) => {
      const view = cameraView(m);
      if (historyNavigation.current) historyNavigation.current = false;
      else if ((!followRef.current || event.originalEvent) && !sameCamera(cameraHistory.current[cameraIndex.current], view)) {
        const entries = cameraHistory.current.slice(0, cameraIndex.current + 1);
        entries.push(view);
        cameraHistory.current = entries.slice(-50);
        cameraIndex.current = cameraHistory.current.length - 1;
        setHistoryPosition({ index: cameraIndex.current, length: cameraHistory.current.length });
      }
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            center: m.getCenter().toArray(),
            zoom: m.getZoom(),
            basemap: m.getContainer().dataset.basemap || "light",
          }),
        );
      } catch {
        /* Camera persistence is optional; drawing recovery is separate. */
      }
    });
    m.on("error", (event) => {
      const source = (event as { sourceId?: string }).sourceId;
      if (source === TERRAIN_SOURCE) { setTerrainFailed(true); return; }
      if ((basemapRef.current === "esri-satellite" || basemapRef.current === "hybrid") && source === "esri-imagery") {
        basemapRef.current = "streets";
        setBasemap("streets");
        m.setStyle(MAPLIBRE_BASEMAPS.streets.styleUrl);
        setNotice("Satellite imagery is unavailable. Showing Streets; your workspace selection and drafts are preserved.");
        return;
      }
      if (source?.startsWith("landos-reference-"))
        setNotice(
          "An official reference source is unavailable. Check coverage or retry later; no result is not no restriction.",
        );
      else if (!source?.startsWith("landos-"))
        setNotice(
          "Basemap source unavailable. Your saved work and device drafts are preserved.",
        );
    });
    m.on("movestart", () => { sampleAbort.current?.abort(); setPointStatus("unavailable"); setPointElevation(null); setParcelHeights(null); setParcelHeightMessage(""); });
    m.on("click", (e: maplibregl.MapMouseEvent) => {
      if (radiusPlacementRef.current) { radiusClickRef.current(e.lngLat.lat,e.lngLat.lng); return; }
      if (elevationMode.current) { const point: [number, number] = [e.lngLat.lng, e.lngLat.lat]; sampleAbort.current?.abort(); const controller = new AbortController(); sampleAbort.current = controller; setElevationPosition(point); setPointElevation(null); setPointStatus("loading"); void waitForTerrainSample(m, point, exaggerationRef.current, controller.signal).then((result) => { if (controller.signal.aborted) return; if (result.status === "available") { setPointElevation(result.value); setPointStatus("available"); } else if (result.status !== "cancelled") setPointStatus(result.status); }); return; }
      if (profileMode.current) { setProfilePoints((points) => points.length >= 100 ? points : [...points, [e.lngLat.lng, e.lngLat.lat]]); return; }
      if (drawing.current) {
        if (rectangleDrag.current) return;
        setDrawPoints((points) =>
          drawKind.current === "Point"
            ? [e.lngLat]
            : drawKind.current === "Rectangle" && points.length >= 2
              ? [e.lngLat]
              : [...points, e.lngLat],
        );
        return;
      }
      const current = draftRef.current;
      if (current && current.status !== "uploading") {
        void saveDraft({
          ...current,
          input: {
            ...current.input,
            latitude: e.lngLat.lat,
            longitude: e.lngLat.lng,
            metadata: { ...current.input.metadata, location_source: "map", location_intentional: true },
          },
          updatedAt: Date.now(),
        });
        return;
      }
      const state = identifyStateRef.current;
      if (state) {
        identifyStateRef.current = null;
        setIdentifyState(null);
        void identifyParcelAt(state, e.lngLat.lat, e.lngLat.lng);
        return;
      }
      if (officialModeRef.current === "zoning") return;
      const hits = m.queryRenderedFeatures([[e.point.x - 10, e.point.y - 10], [e.point.x + 10, e.point.y + 10]], {
        layers: [
          "landos-observations-point",
          "landos-features-point",
          "landos-features-line",
          "landos-features-fill",
          "landos-parcels-fill",
          "landos-parcels-point",
        ].filter((id) => !!m.getLayer(id)),
      });
      const unique = new Map<string, { id: string; kind: string; title: string; layerId?: string; shift: boolean }>();
      for (const hit of hits) {
        const id = String(hit.properties?.recordId ?? hit.id ?? "");
        const kind = String(hit.properties?.kind || "");
        if (!id || !kind) continue;
        unique.set(`${kind}:${id}`, { id, kind, title: String(hit.properties?.title || kind), layerId: hit.properties?.layerId as string | undefined, shift: Boolean(e.originalEvent?.shiftKey) });
      }
      const choices = [...unique.values()];
      if (choices.length > 1) setHitChoices(choices);
      else if (choices[0]) {
        setHitChoices([]);
        window.dispatchEvent(new CustomEvent("landos:select-rendered", { detail: { scope: `${userId}:${workspaceId}`, ...choices[0] } }));
      } else setHitChoices([]);
    });
    return () => {
      m.remove();
      map.current = null;
    };
  }, [adminTerrainPreview, esriApiKey, identifyParcelAt, saveDraft, setDrawPoints, userId, workspaceId]);
  useEffect(() => {
    void reloadQueue();
    const active = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void reload();
    };
    active();
    window.addEventListener("online", active);
    window.addEventListener("offline", active);
    const timer = window.setInterval(() => {
      if (navigator.onLine) void reload();
    }, 15000);
    const stop = subscribeNative((e) => {
      if (e.type === "locationUpdated") {
        const l = locationFromPayload(e.payload);
        if (l) updateLocation(l);
      }
      if (e.type === "nativeError") {
        if (locateRequested.current) {
          setLocating(false);
          if (locationTimer.current) clearTimeout(locationTimer.current);
          locateRequested.current = false;
          followRef.current = false;
          setFollow(false);
        }
        setNotice(String(e.payload.message || "Native action failed"));
      }
      if (
        e.type === "locationPermissionChanged" &&
        e.payload.status === "denied"
      ) {
        setLocating(false);
        if (locationTimer.current) clearTimeout(locationTimer.current);
        locateRequested.current = false;
        followRef.current = false;
        setFollow(false);
        setNotice(
          "Location access denied. Enable it in Settings or choose a map point.",
        );
      }
      if (
        e.type === "photoSelectionStarted" ||
        e.type === "photoSelectionFinished"
      ) {
        const current = draftRef.current;
        if (current && e.payload.observationId === current.id) {
          const started = e.type === "photoSelectionStarted";
          nativePhotoActive.current = started;
          const expected = Number(e.payload.count || 0);
          const failed = Number(e.payload.failed || 0);
          if (
            Number.isInteger(expected) &&
            expected >= 0 &&
            expected <= 10 &&
            Number.isInteger(failed) &&
            failed >= 0 &&
            failed <= expected
          ) {
            const progress = {
              expected,
              received: started ? 0 : current.photoSelection?.received || 0,
              finished: !started,
              failed,
            };
            void saveDraft({
              ...current,
              photoSelection:
                !started && progress.received === expected && failed === 0
                  ? undefined
                  : progress,
            });
          }
        }
      }
      if (e.type === "networkStatusChanged")
        setOnline(e.payload.online === true);
      if (e.type === "appBecameActive") {
        void reload();
        void reloadQueue();
      }
      if (e.type === "photoSelected") {
        const base64 = e.payload.base64;
        const current = draftRef.current;
        if (
          current &&
          (!e.payload.observationId ||
            e.payload.observationId === current.id) &&
          typeof base64 === "string" &&
          base64.length < 36e6
        ) {
          try {
            const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
            const file = new File(
              [bytes],
              String(e.payload.filename || "field-photo.jpg"),
              { type: String(e.payload.mimeType || "image/jpeg") },
            );
            void addPhotos([file], e.payload);
          } catch {
            setNotice("Unable to read native photo. Try again.");
          }
        }
      }
    });
    return () => {
      clearInterval(timer);
      if (locationTimer.current) clearTimeout(locationTimer.current);
      stop();
      window.removeEventListener("online", active);
      window.removeEventListener("offline", active);
      sendNative("stopLocationFollow");
      if (watch.current !== null)
        navigator.geolocation.clearWatch(watch.current);
    };
    // addPhotos reads the current draft ref rather than closing over form state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, reloadQueue, updateLocation]);
  useEffect(() => {
    function select(event: Event) {
      const detail = (event as CustomEvent).detail;
      if (detail.scope !== `${userId}:${workspaceId}`) return;
      clearOfficialInspector(null);
      if (detail.kind === "parcel") {
        const record = renderedData.parcels.find((p) => p.id === detail.id);
        if (record) {
          selectSavedParcel(record, Boolean(detail.shift));
          setTab("parcels");
          setSheet("medium");
        }
      } else if (detail.kind === "observation") {
        clearAreas();
        const record = renderedData.observations.find(
          (o) => o.id === detail.id,
        );
        if (record) {
          setSelection({ kind: "observation", record });
          setTab("observations");
          setSheet("expanded");
        }
      } else if (detail.kind === "workspace-feature") {
        const record = renderedData.layers.find((l) => l.id === detail.layerId);
        const feature = mapLibreCollections(renderedData).workspace.index.get(
          detail.id,
        )?.feature;
        if (record && feature) {
          const selectedDetail = {
            kind: "drawing",
            record,
            featureId: feature.id != null ? String(feature.id) : detail.id,
          } as const;
          if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
            const key = `feature:${record.id}:${String(feature.id ?? detail.id)}`;
            applyArea({ id: key, label: String(feature.properties?.name || record.name), source: `Layer: ${record.name}`, kind: "feature", geometry: record.layer_kind === "radius" ? propertyGeometry(feature.geometry) : null, previewGeometry: feature.geometry, detail: selectedDetail }, Boolean(detail.shift));
            if (record.layer_kind === "radius") { setTab("layers"); setSheet("medium"); return; }
            if (feature.id == null) { setTab("layers"); setSheet("medium"); setNotice("This legacy feature has no persisted ID; its total is unavailable until full geometry can be verified."); return; }
            void timeoutFetch(`/api/layers?id=${encodeURIComponent(record.id)}&feature=${encodeURIComponent(String(feature.id))}`).then(async (response) => {
              const body = await response.json();
              if (!response.ok || !body.feature) throw new Error("Full feature geometry is unavailable.");
              const matching = body.feature as Feature;
              const full = { ...record, geojson: { type: "FeatureCollection" as const, features: [matching] } };
              const geometry = matching ? propertyGeometry(matching.geometry) : null;
              const next = selectedAreasRef.current.map((item) => item.id === key ? { ...item, geometry, detail: { ...selectedDetail, record: full } } : item);
              selectedAreasRef.current = next; setSelectedAreas(next);
              setSelection((current) => current?.kind === "drawing" && current.record.id === full.id && current.featureId === selectedDetail.featureId ? { ...current, record: full } : current);
            }).catch(() => setNotice("Full feature geometry is unavailable; the area total is incomplete."));
          } else { if (!detail.shift && !multiSelectRef.current) clearAreas(); setSelection(selectedDetail); }
          setTab("layers");
          setSheet("medium");
        }
      }
    }
    window.addEventListener("landos:select-rendered", select);
    return () => window.removeEventListener("landos:select-rendered", select);
  }, [renderedData, userId, workspaceId, clearOfficialInspector, applyArea, clearAreas, selectSavedParcel]);
  useEffect(() => {
    const m = map.current;
    if (!m?.getSource("landos-parcels")) return;
    const visible = {
      ...renderedData,
      parcels: renderedData.parcels.filter(
        (p) => !visibleParcelIds || visibleParcelIds.has(p.id),
      ),
      layers: renderedData.layers.filter(
        (l) => (l.layer_kind === "research_area" ? researchVisible : workspaceVisibility.features) && (!visibleUserLayerIds || visibleUserLayerIds.has(l.id)),
      ),
    };
    const collections = mapLibreCollections(visible);
    setSceneData(m, "parcels", collections.parcels.features);
    setSceneData(m, "observations", collections.observations.features);
    setSceneData(m, "features", collections.workspace.collection.features);
    setSceneData(m, "local", spatialImport?.geojson.features || (workspaceVisibility.features ? localLayer?.geojson.features : []) || []);
    setSceneData(
      m,
      "draft",
      draft
        ? [
            geometryFeature({
              type: "Point",
              coordinates: [draft.input.longitude, draft.input.latitude],
            }),
          ]
        : [],
    );
    setSceneData(
      m,
      "selected",
      !highlightsVisible ? [] : selectedResearch ? selectedResearch.features : selectedAreas.length ? selectedAreas.flatMap((item) => item.geometry || item.previewGeometry ? [geometryFeature((item.geometry || item.previewGeometry)!)] : item.location ? [geometryFeature({ type: "Point", coordinates: item.location })] : []) : selectedDrawing?.geometry
        ? [geometryFeature(selectedDrawing.geometry)]
        : selectedBoundary
        ? [
            geometryFeature(
              selectedBoundary,
            ),
          ]
        : selectedParcel?.latitude != null && selectedParcel.longitude != null
          ? [geometryFeature({ type: "Point", coordinates: [selectedParcel.longitude, selectedParcel.latitude] })]
          : selectedLocation ? [geometryFeature(selectedLocation)]
          : selected ? [geometryFeature({ type: "Point", coordinates: [selected.longitude, selected.latitude] })] : [],
    );
    setSceneData(
      m,
      "official",
      highlightsVisible && officialParcel ? [geometryFeature(officialParcel.geometry)] : candidateProperty === selectedParcel?.id
        ? boundaryCandidates.filter((p) => previewCandidates.includes(p.sourceId)).map((p) => geometryFeature(p.geometry)) : [],
    );
    setSceneData(
      m,
      "gps",
      fix
        ? [circleFeature(fix.latitude, fix.longitude, fix.accuracy, "#4b91f1")]
        : [],
    );
  }, [
    renderedData,
    visibleParcelIds,
    visibleUserLayerIds,
    researchVisible,
    workspaceVisibility.features,
    highlightsVisible,
    localLayer,
    spatialImport,
    draft,
    selectedBoundary,
    selectedAreas,
    selectedResearch,
    selectedLocation,
    selectedParcel?.id,
    selectedParcel?.latitude,
    selectedParcel?.longitude,
    selected,
    selectedDrawing,
    officialParcel,
    boundaryCandidates,
    previewCandidates,
    candidateProperty,
    fix,
    styleRevision,
  ]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    for (const [name, visible] of Object.entries(workspaceVisibility)) {
      if(name === "features")continue;
      for (const kind of ["fill", "line", "point"]) {
        const id = `landos-${name}-${kind}`;
        if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
      }
    }
  }, [workspaceVisibility, styleRevision]);
  useEffect(() => {
    const m = map.current;
    if (!m?.getLayer("landos-features-fill")) return;
    const entries = Object.entries(layerOpacity);
    const expression = (entries.length ? ["match", ["coalesce", ["get", "layerId"], ""], ...entries.flatMap(([id, opacity]) => [id, opacity]), 1] : 1) as maplibregl.ExpressionSpecification | number;
    m.setPaintProperty("landos-features-fill", "fill-opacity", ["*", 0.14, expression] as maplibregl.ExpressionSpecification);
    m.setPaintProperty("landos-features-line", "line-opacity", expression);
    m.setPaintProperty("landos-features-point", "circle-opacity", expression);
    m.setPaintProperty("landos-features-point", "circle-stroke-opacity", expression);
  }, [layerOpacity, styleRevision]);
  useEffect(() => {
    const m = map.current;
    if (!m || !fix) return;
    const node = document.createElement("div");
    node.className = "gps-location";
    node.setAttribute("role", "img");
    node.setAttribute(
      "aria-label",
      `Current GPS location, accuracy ${Math.round(fix.accuracy)} metres`,
    );
    const marker = new maplibregl.Marker({ element: node })
      .setLngLat([fix.longitude, fix.latitude])
      .addTo(m);
    return () => {
      marker.remove();
    };
  }, [fix]);
  useEffect(() => {
    const m = map.current;
    if (!m || !highlightsVisible || !labelsVisible) return;
    const markers = selectedAreas.flatMap((item, index) => {
      const first = item.geometry?.type === "Polygon" ? item.geometry.coordinates[0]?.[0] : item.geometry?.type === "MultiPolygon" ? item.geometry.coordinates[0]?.[0]?.[0] : item.location;
      if (!first || !Number.isFinite(first[0]) || !Number.isFinite(first[1])) return [];
      const element = document.createElement("span");
      element.className = "parcel-selection-number";
      element.textContent = String(index + 1);
      element.setAttribute("aria-hidden", "true");
      return [new maplibregl.Marker({ element }).setLngLat([first[0], first[1]]).addTo(m)];
    });
    return () => markers.forEach((marker) => marker.remove());
  }, [selectedAreas,highlightsVisible,labelsVisible]);
  useEffect(() => {
    const m = map.current;
    if (!m?.getSource("landos-parcels")) return;
    const geometry = drawMode
      ? drawingGeometry(
          kind,
          drawPoints.map((p) => [p.lng, p.lat]),
        )
      : profileDrawing && profilePoints.length >= 2 ? { type: "LineString" as const, coordinates: profilePoints } : null;
    const preview = geometry || (drawMode && kind === "Polygon" && drawPoints.length === 2 ? {type:"LineString" as const,coordinates:drawPoints.map(p=>[p.lng,p.lat])} : null);
    setSceneData(m, "drawing", preview ? [geometryFeature(preview)] : []);
    if (!drawMode) return;
    // Editing takes place on the ground plane; the same MapLibre instance stays alive.
    m.jumpTo({ pitch: 0, bearing: 0 });
    const markers: maplibregl.Marker[] = [];
    function marker(
      position: number[],
      className: string,
      label: string,
      text: string,
      draggable: boolean,
    ) {
      const node = document.createElement("button");
      node.type = "button";
      node.className = className;
      node.style.width = "44px";
      node.style.height = "44px";
      const icon = document.createElement("span");
      icon.setAttribute("role", "img");
      icon.setAttribute("aria-label", label);
      icon.textContent = text;
      node.append(icon);
      const value = new maplibregl.Marker({ element: node, draggable })
        .setLngLat([position[0], position[1]])
        .addTo(m!);
      node.addEventListener("click", (event) => event.stopPropagation());
      node.addEventListener("dblclick", (event) => event.stopPropagation());
      markers.push(value);
      return { node, value };
    }
    drawPoints.forEach((point, index) => {
      const { node, value } = marker(
        [point.lng, point.lat],
        "drawing-vertex",
        `Vertex ${index + 1}`,
        "",
        true,
      );
      node.addEventListener("click", () => setSelectedVertex(index));
      value.on("dragend", () => {
        const p = value.getLngLat();
        const current = session.ref.current;
        if (!current) return;
        const next = current.points.map((v, i) =>
          i === index ? [p.lng, p.lat] : v,
        );
        const min =
          current.kind === "Polygon" ? 3 : current.kind === "Point" ? 1 : 2;
        if (next.length >= min && !safeSimple(current.kind, next)) {
          value.setLngLat([point.lng, point.lat]);
          setNotice("This vertex move would make the shape invalid.");
          return;
        }
        setDrawPoints((points) => points.map((v, i) => (i === index ? p : v)));
      });
    });
    const points = session.ref.current?.points || [];
    if (safeSimple(kind, points)) {
      if (kind === "LineString" || kind === "Polygon") {
        const count = kind === "Polygon" ? points.length : points.length - 1;
        for (let i = 0; i < count; i++) {
          const a = points[i],
            b = points[(i + 1) % points.length];
          const { node } = marker(
            [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
            "drawing-midpoint",
            `Add vertex after ${i + 1}`,
            "+",
            false,
          );
          node.addEventListener("click", () => {
            const current = session.ref.current;
            if (!current) return;
            const next = insertVertex(current.kind, current.points, i);
            if (next) {
              changeSession({ points: next }, true);
              setSelectedVertex(i + 1);
            } else setNotice("Cannot safely insert a vertex here.");
          });
        }
      }
      if (kind !== "Point") {
        const anchor = points.reduce(
          (a, p) => [a[0] + p[0] / points.length, a[1] + p[1] / points.length],
          [0, 0],
        );
        const { value } = marker(
          anchor,
          "drawing-move",
          "Move entire shape",
          "✥",
          true,
        );
        value.on("dragend", () => {
          const current = session.ref.current,
            position = value.getLngLat();
          if (!current) return;
          const next = translatePoints(current.kind, current.points, [
            position.lng - anchor[0],
            position.lat - anchor[1],
          ]);
          if (next) changeSession({ points: next }, true);
          else {
            setNotice("Cannot move this shape outside valid map coordinates.");
            value.setLngLat([anchor[0], anchor[1]]);
          }
        });
      }
    }
    return () => {
      markers.forEach((v) => v.remove());
    };
  }, [
    drawPoints,
    drawMode,
    profileDrawing,
    profilePoints,
    kind,
    session.ref,
    changeSession,
    setDrawPoints,
    styleRevision,
  ]);

  useEffect(() => {
    const node = mapNode.current;
    if (!node) return;
    const observer = new ResizeObserver(() => map.current?.resize());
    observer.observe(node);
    const timer = window.setTimeout(() => map.current?.resize(), 250);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [sheet]);
  function locate(keepFollowing = false) {
    locateRequested.current = true;
    setLocating(true);
    if (locationTimer.current) clearTimeout(locationTimer.current);
    locationTimer.current = setTimeout(() => {
      setLocating(false);
      locateRequested.current = false;
      setFollow(false);
      followRef.current = false;
      if (watch.current !== null)
        navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
      sendNative("stopLocationFollow");
      setNotice("Location request timed out. Check permissions and try again.");
    }, 22000);
    setFollow(keepFollowing);
    followRef.current = keepFollowing;
    if (
      sendNative(
        keepFollowing ? "startLocationFollow" : "requestCurrentLocation",
      )
    )
      return;
    if (!navigator.geolocation) {
      setLocating(false);
      if (locationTimer.current) clearTimeout(locationTimer.current);
      locateRequested.current = false;
      setFollow(false);
      followRef.current = false;
      setNotice("Location is unavailable on this device.");
      return;
    }
    const success = (p: GeolocationPosition) => {
      const l = {
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        accuracy: p.coords.accuracy,
        timestamp: p.timestamp,
      };
      updateLocation(l);
      if (!keepFollowing)
        centerFieldPoint(map.current, l.latitude, l.longitude, 16);
    };
    const failed = (e: GeolocationPositionError) => {
      setLocating(false);
      if (locationTimer.current) clearTimeout(locationTimer.current);
      locateRequested.current = false;
      followRef.current = false;
      setFollow(false);
      if (watch.current !== null)
        navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
      setNotice(
        e.code === 1
          ? "Location permission denied. Enable location access and try again."
          : e.code === 3
            ? "Location request timed out. Try again."
            : "Location is unavailable. Check your device and try again.",
      );
    };
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    if (keepFollowing)
      watch.current = navigator.geolocation.watchPosition(success, failed, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      });
    else
      navigator.geolocation.getCurrentPosition(success, failed, {
        enableHighAccuracy: true,
        timeout: 20000,
      });
  }
  function stopFollow() {
    setLocating(false);
    if (locationTimer.current) clearTimeout(locationTimer.current);
    locateRequested.current = false;
    followRef.current = false;
    setFollow(false);
    sendNative("stopLocationFollow");
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
  }
  function beginObservation(property?: Parcel) {
    if (draftRef.current) {
      setTab("observations"); setRightOpen(true); setSheet("expanded");
      return;
    }
    const p = map.current?.getCenter();
    const id = crypto.randomUUID();
    transientObservations.current.add(id);
    const nextDraft: FieldDraft = {
      id,
      userId,
      workspaceId,
      input: {
        id,
        workspace_id: workspaceId,
        title: "",
        notes: "",
        latitude: fix?.latitude ?? p?.lat ?? -37.56,
        longitude: fix?.longitude ?? p?.lng ?? 143.85,
        observed_at: new Date().toISOString(),
        observed_at_source: "device",
        linked_parcel_id: property?.id || null,
        metadata: fix
          ? {
              location_source: "gps",
              accuracy_metres: fix.accuracy,
              location_timestamp: fix.timestamp,
            }
          : { location_source: "map" },
      },
      photos: [],
      status: "draft",
      updatedAt: Date.now(),
    };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setRightOpen(true);
    setSelected(null);
    setSheet("expanded");
    setTab("observations");
    sendNative("hapticFeedback");
  }
  async function ingestPhotos(
    files: File[],
    nativeMetadata: Record<string, unknown> = {},
  ) {
    let current = draftRef.current;
    if (!current) return;
    for (const file of files) {
      if (
        !["image/jpeg", "image/png", "image/heic"].includes(file.type) ||
        file.size > 25 * 1024 * 1024
      ) {
        setNotice("Use JPEG, PNG or HEIC up to 25 MB.");
        continue;
      }
      let captured: string | null =
        typeof nativeMetadata.capturedAt === "string"
          ? nativeMetadata.capturedAt
          : null;
      let metadata: Record<string, unknown> = {};
      try {
        const exif = await exifr.parse(file, { gps: true });
        if (exif?.DateTimeOriginal instanceof Date)
          captured = exif.DateTimeOriginal.toISOString();
        if (
          typeof exif?.latitude === "number" &&
          typeof exif?.longitude === "number"
        )
          metadata = { latitude: exif.latitude, longitude: exif.longitude };
      } catch {
        /* EXIF is optional. */
      }
      if (typeof nativeMetadata.latitude === "number")
        metadata = {
          ...metadata,
          latitude: nativeMetadata.latitude,
          longitude: nativeMetadata.longitude,
        };
      // EXIF parsing yields; another photo selection or text edit may have occurred.
      const latest = draftRef.current;
      if (!latest || latest.id !== current.id || latest.status === "uploading")
        return;
      current = latest;
      const photo: QueuePhoto = {
        blob: file,
        status: "pending",
        input: {
          id: crypto.randomUUID(),
          workspace_id: workspaceId,
          observation_id: current.id,
          original_filename: file.name.slice(0, 160),
          mime_type: file.type as "image/jpeg" | "image/png" | "image/heic",
          size_bytes: file.size,
          captured_at: captured,
          metadata,
        },
      };
      const progress = current.photoSelection
        ? {
            ...current.photoSelection,
            received: current.photoSelection.received + 1,
          }
        : undefined;
      current = {
        ...current,
        photoSelection:
          progress?.finished &&
          progress.received === progress.expected &&
          progress.failed === 0
            ? undefined
            : progress,
        photos: [...current.photos, photo],
        updatedAt: Date.now(),
      };
      await saveDraft(current);
    }
  }
  async function addPhotos(
    files: File[],
    metadata: Record<string, unknown> = {},
  ) {
    if (!files.length) return;
    const observationId = draftRef.current?.id;
    photoProcessing.current += 1;
    setProcessingPhotos(photoProcessing.current);
    const task = photoTasks.current.then(async () => {
      const current = draftRef.current;
      if (!current || current.id !== observationId) return;
      const webBatch = !metadata.base64;
      if (webBatch)
        await saveDraft({
          ...current,
          photoSelection: {
            expected: files.length,
            received: 0,
            finished: false,
            failed: 0,
          },
        });
      try {
        await ingestPhotos(files, metadata);
      } finally {
        const latest = draftRef.current;
        if (webBatch && latest?.id === observationId && latest.photoSelection) {
          const progress = {
            ...latest.photoSelection,
            finished: true,
            failed: Math.max(0, files.length - latest.photoSelection.received),
          };
          await saveDraft({
            ...latest,
            photoSelection: progress.failed === 0 ? undefined : progress,
          });
        }
      }
    });
    photoTasks.current = task.catch(() => {});
    try {
      await task;
    } catch {
      setNotice(
        "Unable to import selected photos. Reselect them before saving.",
      );
    } finally {
      photoProcessing.current -= 1;
      setProcessingPhotos(photoProcessing.current);
    }
  }
  async function uploadDraft(item: FieldDraft) {
    if (uploading.current || photoProcessing.current || item.photoSelection)
      return;
    uploading.current = true;
    const next: FieldDraft = { ...item, status: "uploading", error: undefined };
    try {
      if (draftRef.current?.id === next.id) {
        draftRef.current = next;
        setDraft(next);
      }
      await storeDraft(next);
      await reloadQueue();
      await processDraft(next, async (photo) => {
        const prepared = await apiRequest("/api/media", photo.input);
        const { error } = await browserClient()
          .storage.from("field-media")
          .uploadToSignedUrl(prepared.path, prepared.token, photo.blob, {
            contentType: photo.input.mime_type,
          });
        if (error) throw error;
        await apiRequest("/api/media", photo.input, "PATCH");
      });
      if (draftRef.current?.id === item.id) {
        draftRef.current = null;
        setDraft(null);
      }
      setNotice("Saved to Workspace. Available on your other devices.");
      setSheet("medium");
      sendNative("hapticFeedback");
      await reload();
    } catch (e) {
      next.status = "failed";
      next.error = e instanceof Error ? e.message : "Upload failed";
      if (draftRef.current?.id === next.id) {
        draftRef.current = next;
        setDraft(next);
      }
      await storeDraft(next);
      setNotice("Saved on this device. Retry when reception improves.");
    } finally {
      uploading.current = false;
      await reloadQueue();
    }
  }
  async function submitDraft() {
    if (!draft || photoProcessing.current || draft.photoSelection) return;
    if (!draft.input.title.trim()) {
      setNotice("Give this observation a title.");
      return;
    }
    const next = { ...draft, status: "pending" as const };
    await saveDraft(next);
    if (online) await uploadDraft(next);
    else setNotice("Pending · preserved on this device until you retry.");
  }
  function exportFeatures(features: Feature[], format: SpatialExportFormat, name: string) {
    try { const content = spatialExport(features, format); const url = URL.createObjectURL(new Blob([content], { type: format === "kml" ? "application/vnd.google-earth.kml+xml" : format === "kmz" ? "application/vnd.google-earth.kmz" : format === "csv" ? "text/csv" : "application/geo+json" })); const link = document.createElement("a"); link.href = url; link.download = `${name.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80) || "landos"}.${format}`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Export failed"); }
  }
  async function exportProperty(property: Parcel, format: SpatialExportFormat) {
    try { const response = await timeoutFetch(`/api/properties/${encodeURIComponent(property.id)}/export`); const body = await response.json(); if (!response.ok || !Array.isArray(body.features)) throw new Error("Property geometry unavailable."); exportFeatures(body.features, format, property.title); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Export failed"); }
  }
  async function openResearchArea(layer: SpatialLayer) {
    try {
      const complete = await loadFullLayer(layer.id);
      const features = complete.geojson?.features || [];
      selectedAreasRef.current = []; setSelectedAreas([]); setSelectedResearch({ layer: complete, features }); setSelection(null); setSelectionDetails(false); setTab("layers"); setRightOpen(true); setLeftOpen(false); setSheet("medium");
      const bounds = geometryBounds(complete.geojson); if (!bounds.isEmpty()) map.current?.fitBounds(bounds, { padding: 60, maxZoom: 18 });
    } catch { setNotice("Research area geometry is unavailable."); }
  }
  async function exportResearch(layer: SpatialLayer, format: SpatialExportFormat) {
    try { const full = await loadFullLayer(layer.id); if (!full.geojson?.features.length) throw new Error("Research area geometry unavailable."); exportFeatures(full.geojson.features, format, layer.name); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Export failed"); }
  }
  async function importLayer(file: File) {
    try {
      if (importScope !== `${userId}:${workspaceId}`) throw new Error("Import drafts are still loading. Please try again shortly.");
      if (localLayer || session.active || session.found || spatialImport) throw new Error("Finish your current shape or import preview before importing another file.");
      const value = await parseSpatialFile(file);
      const features = value.features.map((feature) => ({ ...feature, id: crypto.randomUUID() }));
      setSelectedResearch(null);setSpatialImport({ id: crypto.randomUUID(), name: file.name.replace(/\.(?:kml|kmz|geojson|json)$/i, "").slice(0, 160), description: "", sourceFile: file.name.slice(0, 160), destination: importDestination, geojson: { type: "FeatureCollection", features } });
      setSelection(null); setSelectionDetails(false); setTab("layers"); setRightOpen(true); setLeftOpen(false); setSheet("expanded");
      const bounds = geometryBounds(value); if (!bounds.isEmpty()) map.current?.fitBounds(bounds, { padding: 60, maxZoom: 17 });
    } catch (e) { setNotice(e instanceof Error ? e.message : "Import failed"); }
  }
  async function saveSpatialImport() {
    if (!spatialImport || importSaving) return;
    setImportSaving(true);
    try {
      await apiRequest("/api/spatial-import", spatialImport);
      setSpatialImport(null); await reload();
      setTab(spatialImport.destination === "property" ? "parcels" : "layers");
      setNotice(`${spatialImport.destination === "property" ? "Property" : spatialImport.destination === "research" ? "Research Area" : "Custom layer"} saved to Workspace.`);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Import failed. The preview is still open."); }
    finally { setImportSaving(false); }
  }
  async function createRadius(at?: {lat:number;lng:number}) {
    const centre = at || map.current?.getCenter();
    const kilometres = Number(radiusKm);
    if (!centre || !Number.isFinite(kilometres) || kilometres <= 0 || kilometres > 500) {
      setNotice("Enter a radius between 0 and 500 kilometres.");
      return;
    }
    if (localLayer || session.active || session.found) {
      setNotice("Save or discard your existing draft before creating a radius.");
      return;
    }
    const id = crypto.randomUUID();
    const feature = circleFeature(centre.lat, centre.lng, kilometres * 1000, "#d8ff43");
    feature.id = id;
    feature.properties = { ...feature.properties, name: `${kilometres} km radius` };
    if (await updateLocalLayer({ id, name: `${kilometres} km radius`, geojson: { type: "FeatureCollection", features: [feature] } })) {
      clearAreas();setSelection(null);setSelectionDetails(false); setRightOpen(false); setLeftOpen(false); setPaletteOpen(false); setSheet("collapsed");
      setNotice("");
    }
  }
  async function startDrawing(
    nextKind: DrawingKind,
    feature?: Feature,
    layerId?: string,
  ) {
    if (!(await pauseObservation())) return;
    if (!session.ready || session.found || session.active) {
      setRightOpen(false); setLeftOpen(false); setPaletteOpen(false); setSheet("collapsed");
      setNotice("An unfinished drawing is available in the recovery card.");
      return;
    }
    if (spatialImport) { setRightOpen(true); setSheet("expanded"); setNotice("Finish or discard the open spatial import preview first."); return; }
    elevationMode.current = false; setElevationActive(false); profileMode.current = false; setProfileDrawing(false); radiusPlacementRef.current=false;setRadiusPlacement(false);sampleAbort.current?.abort();
    if (localLayer) {
      setSelection(null); setSelectionDetails(false); setRightOpen(false); setLeftOpen(false); setPaletteOpen(false); setSheet("collapsed");
      setNotice("");
      return;
    }
    let points = feature ? editablePoints(feature.geometry) : [];
    if (nextKind === "Rectangle" && points?.length === 4)
      points = [points[0], points[2]];
    if (!points || points.length > 200 || points.some((p) => p.length !== 2)) {
      setNotice(
        "Multipart shapes and shapes with holes can be viewed, but are not editable yet.",
      );
      return;
    }
    if (feature && !safeSimple(nextKind, points)) {
      setNotice("This imported geometry is view-only in the simple editor.");
      return;
    }
    setSelectedVertex(null);
    drawKind.current = nextKind;
    drawing.current = true;
    void session.start({
      version: 1,
      id: crypto.randomUUID(),
      userId,
      workspaceId,
      kind: nextKind,
      points: points.map((p) => [p[0], p[1]]),
      name: String(feature?.properties?.name || ""),
      layerName: "My analysis",
      targetLayerId: layerId,
      originalFeature: feature,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setPaletteOpen(false);
    setSelectionDetails(false);
    setSelection(null);
    setRightOpen(false); setLeftOpen(false);
    setSheet("collapsed");
    setNotice("");
  }
  async function finishDrawing() {
    const geometry = drawingGeometry(
      kind,
      drawPoints.map((p) => [p.lng, p.lat]),
    );
    if (!geometry) {
      setNotice("Add more points to complete this shape.");
      return;
    }
    const current = session.ref.current;
    if (!current) return;
    const existing = current.originalFeature;
    const preserved = await updateLocalLayer({
      id: current.id,
      name: current.name || (kind === "LineString" ? "Field line" : kind === "Point" ? "Field point" : "Field area"),
      targetLayerId: current.targetLayerId,
      geojson: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: existing?.id || crypto.randomUUID(),
            properties: {
              ...existing?.properties,
              name:
                current.name ||
                (kind === "Point"
                  ? "Field point"
                  : kind === "LineString"
                    ? "Field line"
                    : "Field area"),
              drawing_kind: kind,
            },
            geometry,
          },
        ],
      },
    });
    if (!preserved) return;
    drawing.current = false;
    await session.discard();
    setRightOpen(false); setLeftOpen(false);
    setSheet("collapsed");
    setNotice("");
  }
  async function saveDrawingDestination(destination:"property"|"research") {
    if(!localLayer)return;
    try {await apiRequest("/api/spatial-import",{id:localLayer.id,name:localLayer.name,description:String(localLayer.geojson.features[0]?.properties?.note||""),sourceFile:"Drawn in LandOS",destination,geojson:localLayer.geojson});if(!(await updateLocalLayer(null)))return;await reload();setNotice(`${destination === "property" ? "Property" : "Research Area"} saved to Workspace.`);}catch(error){setNotice(error instanceof Error?error.message:"Save failed; device draft preserved.");}
  }
  async function editLocalDraft() {
    if(!localLayer||session.active||session.found)return;
    const feature=localLayer.geojson.features[0]; if(!feature||localLayer.geojson.features.length!==1){setNotice("Multipart drawings remain view-only; all original geometry is preserved.");return;}
    const nextKind=(feature.properties?.drawing_kind || feature.geometry.type) as DrawingKind;
    let points=editablePoints(feature.geometry);if(nextKind==="Rectangle"&&points?.length===4)points=[points[0],points[2]];
    if(!points||!safeSimple(nextKind,points)){setNotice("This geometry is view-only in the simple editor.");return;}
    try {await session.start({version:1,id:localLayer.id,userId,workspaceId,kind:nextKind,points:points.map(p=>[p[0],p[1]]),name:localLayer.name,layerName:localLayer.name,targetLayerId:localLayer.targetLayerId,originalFeature:feature,createdAt:Date.now(),updatedAt:Date.now()});drawing.current=true;drawKind.current=nextKind;await updateLocalLayer(null);setRightOpen(false);setSheet("collapsed");}catch{setNotice("Unable to open the editor. Device draft preserved.");}
  }
  finishDrawingRef.current=finishDrawing;
  radiusClickRef.current=(lat,lng)=>{radiusPlacementRef.current=false;setRadiusPlacement(false);void createRadius({lat,lng});};
  useEffect(()=>{
    const m=map.current;if(!m||!drawMode||kind!=="Rectangle")return;
    const canvas=m.getCanvas();let first:maplibregl.LngLat|null=null;let moved=false;let last:maplibregl.LngLat|null=null;
    const pan=m.dragPan.isEnabled();m.dragPan.disable();
    const position=(e:PointerEvent)=>{const b=canvas.getBoundingClientRect();return m.unproject([e.clientX-b.left,e.clientY-b.top]);};
    const down=(e:PointerEvent)=>{if(e.button!==0)return;first=position(e);last=first;moved=false;canvas.setPointerCapture(e.pointerId);};
    const move=(e:PointerEvent)=>{if(!first)return;last=position(e);const a=m.project(first),b=m.project(last);if(a.dist(b)<5&&!moved)return;moved=true;rectangleDrag.current=true;setDrawPoints([first,last]);};
    const up=()=>{if(!first)return;first=null;if(moved){void finishDrawingRef.current().finally(()=>{window.setTimeout(()=>{rectangleDrag.current=false;},100);});}moved=false;};
    const cancel=()=>{first=null;moved=false;rectangleDrag.current=false;};
    canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",cancel);
    return()=>{canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",up);canvas.removeEventListener("pointercancel",cancel);if(pan)m.dragPan.enable();};
  },[drawMode,kind,setDrawPoints]);
  async function saveResearchDraft() {
    if (!localLayer || localLayer.targetLayerId) return;
    try {
      if (!safeStoredFeatureIds(localLayer.geojson.features)) throw new Error("This legacy draft has incompatible feature IDs. Your device draft is preserved.");
      const features = localLayer.geojson.features;
      await apiRequest("/api/spatial-import", { id: localLayer.id, name: localLayer.name, description: String(features[0]?.properties?.note || ""), sourceFile: "Drawn in LandOS", destination: "research", geojson: { type: "FeatureCollection", features } });
      if (!(await updateLocalLayer(null))) return; await reload(); setNotice("Research Area saved to Workspace.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Research Area save failed. Your device draft is preserved."); }
  }
  async function saveShape() {
    if (!localLayer) return;
    try {
      // Viewport collections are partial. Always load the complete authoritative
      // layer before merging, so saving an edit cannot delete off-screen features.
      const target = localLayer.targetLayerId
        ? await loadFullLayer(localLayer.targetLayerId)
        : null;
      if (localLayer.targetLayerId && !target?.geojson) throw new Error("The complete layer is unavailable. Your draft remains on this device.");
      if (target?.geojson && !safeStoredFeatureIds(target.geojson.features)) throw new Error("This layer contains legacy or duplicate feature IDs. Editing is unavailable to prevent rewriting existing identities; your draft is preserved.");
      const ids = new Set(localLayer.geojson.features.map((f) => f.id));
      const geojson = target?.geojson
        ? {
            type: "FeatureCollection" as const,
            features: [
              ...target.geojson.features.filter((f) => !ids.has(f.id)),
              ...localLayer.geojson.features,
            ],
          }
        : localLayer.geojson;
      await apiRequest("/api/layers", {
        id: target?.id || localLayer.id,
        name: target?.name || localLayer.name,
        geojson,
      });
      if (target) {
        const next = selectedAreasRef.current.map((item) => {
          if (item.detail.kind !== "drawing" || item.detail.record.id !== target.id) return item;
          const featureId = item.detail.featureId;
          const updated = geojson.features.find((feature) => String(feature.id) === featureId);
          return updated ? { ...item, geometry: propertyGeometry(updated.geometry), detail: { ...item.detail, record: { ...target, geojson } } } : item;
        });
        selectedAreasRef.current = next; setSelectedAreas(next);
      }
      await updateLocalLayer(null);
      await reload();
      setSelection(null);
      setVisibleUserLayerIds(null);
      setNotice("Shape saved to Workspace.");
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Save failed. Local draft preserved.",
      );
    }
  }
  async function loadFullLayer(id: string): Promise<SpatialLayer> {
    const response = await timeoutFetch(`/api/layers?id=${id}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Layer unavailable");
    setData((current) => ({
      ...current,
      layers: current.layers.map((l) => (l.id === id ? result.layer : l)),
    }));
    return result.layer;
  }
  async function findBoundaryCandidates(property: Parcel, additional = false) {
    setCandidateProperty(property.id);
    if (!additional) { setBoundaryCandidates([]); setPreviewCandidates([]); }
    const latitude = additional ? Number(candidateLatitude) : property.latitude;
    const longitude = additional ? Number(candidateLongitude) : property.longitude;
    if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude) || (additional && (!candidateLatitude.trim() || !candidateLongitude.trim()))) {
      setNotice("A VIC or NSW state and saved location are needed for boundary lookup. Search by address or parcel identifier instead.");
      return;
    }
    setIdentifyBusy(true);
    try {
      const query = new URLSearchParams({ state: property.state || parcelState, latitude: String(latitude), longitude: String(longitude), address: "" });
      const response = await timeoutFetch(`/api/parcels/lookup?${query}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Official boundary lookup failed");
      const candidates = (result.parcels || []) as OfficialParcel[];
      setBoundaryCandidates((current) => additional ? [...current, ...candidates.filter((p) => !current.some((existing) => existing.state === p.state && existing.sourceId === p.sourceId))] : candidates);
      setNotice(candidates.length ? "Review candidate boundaries. No property association has been saved." : "No official boundary was returned at the saved location. Coverage may be unavailable; search nearby parcels separately.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Official boundary lookup failed"); }
    finally { setIdentifyBusy(false); }
  }
  async function associateBoundaries(property: Parcel) {
    const chosen = boundaryCandidates.filter((p) => previewCandidates.includes(p.sourceId));
    if (!chosen.length || !window.confirm(`Associate ${chosen.length} reviewed official parcel ${chosen.length === 1 ? "boundary" : "boundaries"} with this property? The existing property and its notes will be retained${property.geometry ? ", and the original location geometry will be preserved in its metadata" : ""}.`)) return;
    setIdentifyBusy(true);
    try {
      await apiRequest(`/api/properties/${property.id}/boundary`, { confirmed: true, candidates: chosen.map((p) => ({ state: p.state, latitude: p.latitude, longitude: p.longitude, sourceId: p.sourceId, address: "" })) });
      const response = await timeoutFetch(`/api/properties/${property.id}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to reload property");
      setSelection((current) => current?.kind === "parcel" && current.record.id === property.id ? { kind: "parcel", record: result.property } : current);
      setBoundaryCandidates([]); setPreviewCandidates([]);
      const boundary = propertyGeometry(result.property.geometry);
      if (boundary && map.current) map.current.fitBounds(geometryBounds(boundary), { padding: 60, maxZoom: 18 });
      await reload();
      setNotice("Reviewed boundaries associated with the property.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to associate boundaries"); }
    finally { setIdentifyBusy(false); }
  }
  const drawnGeometry = drawingGeometry(
    kind,
    drawPoints.map((p) => [p.lng, p.lat]),
  );
  const drawnMeasurement = drawnGeometry
    ? geometryMeasurement(drawnGeometry)
    : null;
  function navigateHistory(delta: number) {
    const target = cameraIndex.current + delta;
    const m = map.current;
    if (!m || target < 0 || target >= cameraHistory.current.length) return;
    cameraIndex.current = target;
    setHistoryPosition({ index: target, length: cameraHistory.current.length });
    const view = cameraHistory.current[target];
    if (!sameCamera(cameraView(m), view)) {
      historyNavigation.current = true;
      m.jumpTo(view);
    }
  }
  function goHome() {
    const m = map.current;
    if (!m) return;
    let home: CameraView = { center: [143.8503, -37.5622], zoom: 11, bearing: 0, pitch: 0 };
    try {
      const saved = JSON.parse(localStorage.getItem(homeKey) || "null");
      if (Array.isArray(saved?.center) && saved.center.length === 2 && saved.center.every(Number.isFinite) && Math.abs(saved.center[0]) <= 180 && Math.abs(saved.center[1]) <= 85 && [saved.zoom, saved.bearing, saved.pitch].every(Number.isFinite) && saved.zoom >= 0 && saved.zoom <= 20 && saved.pitch >= 0 && saved.pitch <= 70) home = saved;
    } catch { /* Use the workspace default. */ }
    m.jumpTo(home);
  }
  async function saveSelectionProperty() {
    if(!selectedAreas.length||selectedAreas.some(item=>!item.geometry||!["Polygon","MultiPolygon"].includes(item.geometry.type))){setNotice("Select complete polygon boundaries before creating a Property.");return;}
    const name=window.prompt("Name for this Property")?.trim();if(!name)return;
    try{await apiRequest("/api/spatial-import",{id:crypto.randomUUID(),name,description:"Created from selected map boundaries; not a cadastral survey.",sourceFile:"Map selection",destination:"property",geojson:{type:"FeatureCollection",features:selectedAreas.map(item=>({type:"Feature",id:crypto.randomUUID(),geometry:item.geometry,properties:{name:item.label,source:item.source,source_record_id:item.id}}))}});await reload();setNotice("Multipart Property saved; original records are preserved.");}catch(e){setNotice(e instanceof Error?e.message:"Unable to save Property. Selection is preserved.");}
  }
  function fitSelectedAreas() {
    const bounds = new maplibregl.LngLatBounds();
    for (const item of selectedAreas) {
      if (item.geometry) {
        const featureBounds = geometryBounds(item.geometry);
        if (!featureBounds.isEmpty()) { bounds.extend(featureBounds.getSouthWest()); bounds.extend(featureBounds.getNorthEast()); }
      } else if (item.location) bounds.extend(item.location);
    }
    if (!bounds.isEmpty()) map.current?.fitBounds(bounds, { padding: 60, maxZoom: 18 });
  }
  async function activateElevation() {
    if(!(await pauseObservation()))return;
    radiusPlacementRef.current=false;setRadiusPlacement(false);
    if (!dem) { setNotice("Elevation is unavailable: no reviewed terrain source is configured."); return; }
    if (drawMode || spatialImport) { setNotice("Finish the current draft or drawing before using elevation."); return; }
    profileMode.current = false; setProfileDrawing(false); elevationMode.current = true; setElevationActive(true); setPaletteOpen(false); setPointStatus("unavailable");
    if (mapMode === "2d") { setMapMode("3d"); map.current?.easeTo({ pitch: 50, duration: 350 }); }
  }
  async function activateProfile() {
    if(!(await pauseObservation()))return;
    radiusPlacementRef.current=false;setRadiusPlacement(false);
    if (!dem) { setNotice("Elevation profile unavailable: no reviewed terrain provider is configured."); return; }
    if (drawMode || spatialImport) { setNotice("Finish the current draft or drawing before using the profile tool."); return; }
    elevationMode.current = false; setElevationActive(false); profileMode.current = true; setProfileDrawing(true); setProfilePoints([]); setProfile([]); setPaletteOpen(false);
    if (mapMode === "2d") { setMapMode("3d"); map.current?.easeTo({ pitch: 50, duration: 350 }); }
  }
  useEffect(()=>{setTerrainFailed(false);setTerrainWaited(false);if(mapMode!=="3d")return;const timer=window.setTimeout(()=>setTerrainWaited(true),15000);return()=>clearTimeout(timer);},[mapMode,providerId]);
  function toggleMapMode() {
    if (mapMode === "2d" && !dem) { setNotice("3D terrain is unavailable: no reviewed elevation source is configured."); return; }
    if (mapMode === "3d") { profileMode.current = false; setProfileDrawing(false); setProfile([]); elevationMode.current = false; setElevationActive(false); }
    sampleAbort.current?.abort(); setPointStatus("unavailable"); setPointElevation(null);
    const next = mapMode === "2d" ? "3d" : "2d";
    map.current?.easeTo({
      pitch: next === "3d" ? 50 : 0,
      bearing: 0,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 350,
    });
    setMapMode(next);
  }
  const savedViewsPanel = (<>
              <div className="section-label">SAVED VIEWS</div>
              {data.savedViews.map((v) => (
                <div key={v.id} className="saved-view">
                  <button
                    className="record-row"
                    onClick={async () => {
                      map.current?.jumpTo({
                        pitch: 0,
                        bearing: 0,
                        padding: { top: 0, bottom: 0, left: 0, right: 0 },
                      });
                      setMapMode("2d");
                      setView(
                        map.current,
                        [Number(v.view.latitude), Number(v.view.longitude)],
                        Number(v.view.zoom),
                      );
                      setVisibleParcelIds(
                        Array.isArray(v.view.parcel_ids)
                          ? new Set(v.view.parcel_ids as string[])
                          : null,
                      );
                      setVisibleUserLayerIds(
                        Array.isArray(v.view.layer_ids)
                          ? new Set(v.view.layer_ids as string[])
                          : null,
                      );
                      const viewLayers = v.view.official_layers as
                        ActiveLayer[] | undefined;
                      if (viewLayers) {
                        try {
                          for (const current of activeLayers)
                            if (
                              !viewLayers.some(
                                (l) => l.catalog_id === current.catalog_id,
                              )
                            )
                              await apiRequest("/api/layer-library", {
                                id: current.catalog_id,
                                action: "remove",
                              });
                          for (const item of viewLayers)
                            await apiRequest("/api/layer-library", {
                              id: item.catalog_id,
                              action: "save",
                              ...item,
                            });
                          await reloadLibrary();
                        } catch (e) {
                          setNotice(
                            e instanceof Error
                              ? e.message
                              : "View layers unavailable",
                          );
                        }
                      }
                    }}
                  >
                    {v.name}
                  </button>
                </div>
              ))}
              {["owner", "admin"].includes(role) ? (
                <ShareWorkspace
                  key={`${userId}:${workspaceId}`}
                  userId={userId}
                  workspaceId={workspaceId}
                  views={data.savedViews}
                />
              ) : null}
              {pendingView?.scope === `${userId}:${workspaceId}` ? (
                <SavedViewPreview
                  key={pendingView.id}
                  view={pendingView.view}
                  onCancel={() => setPendingView(null)}
                  onSave={async (name) => {
                    await apiRequest("/api/views", {
                      id: pendingView.id,
                      name,
                      view: pendingView.view,
                    });
                    await reload();
                    setPendingView(null);
                    setNotice("Map View saved to Workspace.");
                  }}
                />
              ) : null}
              {canWrite ? (
                <button
                  onClick={() => {
                    const m = map.current;
                    if (!m) return;
                    setPendingView({
                      scope: `${userId}:${workspaceId}`,
                      id: crypto.randomUUID(),
                      view: {
                        latitude: m.getCenter().lat,
                        longitude: m.getCenter().lng,
                        zoom: m.getZoom(),
                        parcel_ids: renderedData.parcels
                          .filter((p) => {
                            if (visibleParcelIds && !visibleParcelIds.has(p.id))
                              return false;
                            if (p.geometry) {
                              try {
                                return m
                                  .getBounds()
                                  .intersects(geometryBounds(p.geometry));
                              } catch {
                                return false;
                              }
                            }
                            return (
                              p.latitude != null &&
                              p.longitude != null &&
                              m.getBounds().contains([p.longitude, p.latitude])
                            );
                          })
                          .map((p) => p.id),
                        layer_ids: renderedData.layers
                          .filter((l) => {
                            if (
                              visibleUserLayerIds &&
                              !visibleUserLayerIds.has(l.id)
                            )
                              return false;
                            if (!l.geojson) return false;
                            try {
                              return m
                                .getBounds()
                                .intersects(geometryBounds(l.geojson));
                            } catch {
                              return false;
                            }
                          })
                          .map((l) => l.id),
                        official_layers: activeLayers,
                      },
                    });
                  }}
                >
                  Save current map view
                </button>
              ) : null}
  </>);
  return (
    <main
      className={`map-app sheet-${sheet} ${leftOpen ? "workspace-left-open" : ""} ${rightOpen ? "" : "workspace-right-closed"} ${drawMode ? "workspace-drawing" : ""} ${multiSelect ? "workspace-multiselect" : ""} inspector-${inspectorSize}`}
    >
      <div className="maplibre-attribution">{basemapAttribution(basemap)}</div>
      {viewport.error && dismissedMapError !== viewport.error ? (
        <div className="map-update-error" role="alert">
          <span>
            Map update failed: {viewport.error}. Your local drafts are
            preserved.
          </span>
          <button
            onClick={() => setDismissedMapError(viewport.error)}
            aria-label="Dismiss map update error"
          >
            ×
          </button>
          <button onClick={refreshViewport}>Retry</button>
        </div>
      ) : null}
      <div
        data-tool={activeTool}
        ref={mapNode}
        className="map-canvas"
        data-basemap={basemap}
        aria-label="Land workspace map"
      />
      {localLayer && !drawMode && !selection && !selectedResearch && <div className="drawing-result-card"><ShapeDraft key={localLayer.id} draft={localLayer} layers={data.layers} onChange={value=>void updateLocalLayer(value)} onSave={saveShape} onSaveResearch={saveResearchDraft} onSaveProperty={()=>saveDrawingDestination("property")} onEdit={()=>void editLocalDraft()} onDiscard={()=>{setDiscardedDraft(localLayer);void updateLocalLayer(null);}} /></div>}
      {discardedDraft && !localLayer && !drawMode && <div className="drawing-undo" role="status">Device drawing discarded <button onClick={()=>{void updateLocalLayer(discardedDraft);setDiscardedDraft(null);}}>Undo discard</button><button aria-label="Dismiss drawing undo" onClick={()=>setDiscardedDraft(null)}>×</button></div>}
      {radiusPlacement && <div className="map-drawing-bar" role="status">Tap the map to place the radius centre · {radiusKm} km<button onClick={()=>{radiusPlacementRef.current=false;setRadiusPlacement(false);}}>Cancel radius</button></div>}
      {session.found && !drawMode ? (
        <div className="drawing-recovery" role="status">
          <strong>Unfinished drawing found</strong>
          <span>Local Draft · Only on this device</span>
          <button
            onClick={() => {
              drawing.current = true;
              drawKind.current = session.found!.kind;
              session.resume();
              setSelectionDetails(false);
              setTab("layers");
              setSheet("collapsed");
            }}
          >
            Resume drawing
          </button>
          <button
            onClick={() => { if (!window.confirm("Discard this unfinished drawing from this device?")) return; void session.discard().catch(() => setNotice("Unable to discard local drawing.")); }}
          >
            Discard
          </button>
        </div>
      ) : null}
      {elevationActive && <div className="map-drawing-bar" role="status">Tap the map to sample elevation. {pointStatus === "loading" ? "Loading…" : pointElevation !== null ? `${pointElevation.toFixed(1)} m (approx.)` : "Elevation unavailable or awaiting a point."}<button onClick={() => { sampleAbort.current?.abort(); setPointElevation(null); setElevationPosition(null); setPointStatus("unavailable"); }}>Clear</button><button onClick={() => { elevationMode.current = false; setElevationActive(false); sampleAbort.current?.abort(); }}>Done</button></div>}
      {profileDrawing && <div className="map-drawing-bar" role="status">Profile: {profilePoints.length} points <button disabled={profilePoints.length < 2} onClick={() => { const m = map.current; if (m) setProfile(elevationProfile(profilePoints, (p) => dem?.datumVerified ? terrainElevation(m, p, terrainExaggeration) : null)); profileMode.current = false; setProfileDrawing(false); }}>Finish profile</button><button disabled={!profilePoints.length} onClick={() => setProfilePoints((points) => points.slice(0, -1))}>Undo</button><button onClick={() => { profileMode.current = false; setProfileDrawing(false); setProfilePoints([]); setProfile([]); }}>Cancel</button></div>}
      {profile.length > 0 && <div className="map-drawing-bar" role="region" aria-label="Elevation profile"><strong>Elevation profile · approximate, not survey grade</strong><span> {profileSummary(profile) ? `Rise slope ${profileSummary(profile)!.slopeDegrees.toFixed(1)}° / ${profileSummary(profile)!.slopePercent.toFixed(1)}%; range ${profileSummary(profile)!.min.toFixed(1)}–${profileSummary(profile)!.max.toFixed(1)} m` : (dem?.datumVerified ? "Incomplete: DEM data unavailable at one or more samples." : "Profile measurements unavailable: vertical datum consistency is unverified.")} Source: {dem?.attribution}. {terrainMetadata} Avoid comparing heights across different or unknown datums.</span><ElevationProfileChart samples={profile} /><details><summary>Profile samples (distance m, elevation m)</summary>{profile.map((p, i) => <div key={i}>{p.distance.toFixed(0)} m: {p.elevation === null ? "unavailable" : `${p.elevation.toFixed(1)} m`}</div>)}</details><button onClick={() => { setProfile([]); setProfilePoints([]); }}>Close profile</button></div>}
      {session.error ? (
        <div className="drawing-storage-error" role="alert">
          {session.error}
        </div>
      ) : null}
      {drawMode ? (
        <div className="map-drawing-bar" aria-label="Drawing controls">
          <strong>
            Active: {kind} · {kind === "Rectangle" ? "Drag between corners, or tap two corners" : "Tap to add points"} · {" "}
            {drawnMeasurement?.areaM2
              ? formatArea(drawnMeasurement.areaM2)
              : drawnMeasurement?.distanceM
                ? formatDistance(drawnMeasurement.distanceM)
                : `${drawPoints.length} points`}
          </strong>
          <button
            onClick={() =>
              void finishDrawing().catch(() =>
                setNotice(
                  "Unable to complete local drawing. Device draft is retained.",
                ),
              )
            }
          >
            {kind === "Polygon" ? "Finish polygon" : "Finish shape"}
          </button>
          <button
            disabled={selectedVertex === null}
            onClick={() => {
              const current = session.ref.current;
              if (!current || selectedVertex === null) return;
              const next = deleteVertex(
                current.kind,
                current.points,
                selectedVertex,
              );
              if (next) {
                changeSession({ points: next }, true);
                setSelectedVertex(null);
              } else
                setNotice(
                  "Keep at least 2 line points or 3 unique polygon vertices. This deletion is not safe.",
                );
            }}
          >
            Delete vertex
          </button>
          <button disabled={!drawPoints.length} onClick={()=>setDrawPoints(points=>points.slice(0,-1))}>Undo last point</button>
          <button disabled={!drawPoints.length} onClick={()=>setDrawPoints([])}>Clear drawing</button>
          <button
            onClick={() => {
              drawing.current = false;
              void session
                .discard()
                .catch(() => setNotice("Unable to discard local drawing."));
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <GlobalMapSearch open={searchOpen} onOpenChange={setSearchOpen} properties={data.parcels} researchAreas={data.layers.filter((layer) => layer.layer_kind === "research_area")} onAddress={(address) => setView(map.current, [address.latitude, address.longitude], 17)} onPlace={(place) => setView(map.current, [place.latitude, place.longitude], 12)} onParcel={selectOfficialParcel} onProperty={(property) => { selectSavedParcel(property); setTab("parcels"); setRightOpen(true); setSheet("medium"); void timeoutFetch(`/api/properties/${encodeURIComponent(property.id)}`).then((r) => r.json()).then((body) => { const geometry = propertyGeometry(body.property?.geometry); if (geometry && map.current) map.current.fitBounds(geometryBounds(geometry), { padding: 60, maxZoom: 18 }); }).catch(() => setNotice("Property geometry is unavailable.")); }} onResearchArea={(layer) => { void openResearchArea(layer); }} />
      <header className="map-header">
        <BrandLockup href="/app/map" compact />
        <div className="map-settings-controls">
        <BasemapSelector
          value={basemap}
          esriEnabled={Boolean(esriApiKey || adminTerrainPreview)}
          onChange={(next) => {
            if (!isMapLibreBasemap(next)) return;
            sampleAbort.current?.abort(); setPointStatus("unavailable"); setPointElevation(null);
            setBasemap(next);
            basemapRef.current = next;
            map.current?.setStyle(basemapStyle(next, esriApiKey, adminTerrainPreview));
            const current = map.current;
            if (current) {
              try {
                localStorage.setItem(
                  `landos:map-camera:v1:${userId}:${workspaceId}`,
                  JSON.stringify({
                    center: current.getCenter().toArray(),
                    zoom: current.getZoom(),
                    basemap: next,
                  }),
                );
              } catch {
                /* Optional camera storage. */
              }
            }
          }}
        />
        <button
          className={`map-mode-toggle${mapMode === "3d" ? " active" : ""}`}
          onClick={toggleMapMode}
          aria-pressed={mapMode === "3d"}
          disabled={mapMode === "2d" && Boolean(drawMode)}
          title={
            mapMode === "3d" ? "Return to 2D editing" : "View this map in 3D"
          }
        >
          {mapMode === "3d" ? "2D edit" : "3D view"}
        </button>
        </div>
        <div className="map-display-control"><button aria-label="Map Display" aria-expanded={displayOpen} onClick={()=>setDisplayOpen(v=>!v)} title="Display"><MapIcon name="display"/><span>Display</span></button>{displayOpen&&<section aria-label="Map Display visibility"><strong>Map Display</strong>{([["parcels","My Properties"],["observations","Observations"],["features","User Drawings"]] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={workspaceVisibility[key]} onChange={e=>setWorkspaceVisibility(v=>({...v,[key]:e.target.checked}))}/>{label}</label>)}<label><input type="checkbox" checked={researchVisible} onChange={e=>setResearchVisible(e.target.checked)}/>Research Areas</label><label><input type="checkbox" checked={highlightsVisible} onChange={e=>setHighlightsVisible(e.target.checked)}/>Selected Object Highlights</label><label><input type="checkbox" checked={labelsVisible} onChange={e=>setLabelsVisible(e.target.checked)}/>Measurement Labels</label></section>}</div>
        <details className="desktop-workspace-settings"><summary aria-label="Workspace settings" title="Settings"><MapIcon name="settings"/></summary><div className="desktop-settings-panel"><strong>Workspace</strong><WorkspaceSelector name={workspaceName} /><button onClick={() => { setDrawer("views"); setLeftOpen(true); }}>Saved Views</button><Link href="/app/settings">Account and settings</Link></div></details>
      </header>

      {mapMode === "3d" && terrainCoverage !== "loaded" && <div className="terrain-context-status" role="status">{terrainCoverage === "partial" ? "Partial terrain coverage" : terrainFailed || terrainWaited ? "Terrain unavailable" : "Loading terrain…"}{(terrainFailed||terrainWaited)&&<button onClick={toggleMapMode}>Return to 2D</button>}</div>}
      {!online || queue.some((q) => q.status !== "draft") ? (
        <div className="map-topline" role="status">
          {!online
            ? "Offline · "
            : queue.some((q) => q.status === "failed")
              ? "Upload failed · "
              : queue.some((q) => q.status === "uploading")
                ? "Syncing · "
                : ""}
          {queue.filter((q) => q.status !== "draft").length} items pending
        </div>
      ) : null}
      <nav className="mobile-map-nav" aria-label="Mobile map navigation">
        <button onClick={async()=>{if(await pauseObservation())setSearchOpen(v=>!v);}} aria-label="Search" title="Search" data-map-search-trigger="" aria-pressed={searchOpen}><MapIcon name="search"/><span>Search</span></button>
        <button onClick={async () => { if (!(await pauseObservation())) return; setRightOpen(false);setSheet("collapsed");setSearchOpen(false);setDrawer("layers"); setLeftOpen(true); setPaletteOpen(false); }}><MapIcon name="layers"/><span>Layers</span></button>
        <button onClick={async () => { if (!(await pauseObservation())) return; setRightOpen(false);setSheet("collapsed");setSearchOpen(false);setDrawer("properties"); setLeftOpen(true); setPaletteOpen(false); setMobileMore(false); }}><MapIcon name="properties"/><span>Properties</span></button>
        <button aria-expanded={mobileMore} onClick={async () => { if (!(await pauseObservation())) return; setRightOpen(false);setSheet("collapsed");setLeftOpen(false); setMobileMore((value) => !value); }}><MapIcon name="more"/><span>More</span></button>
      </nav>
      {mobileMore && <div className="mobile-more-menu"><button onClick={() => { setMobileMore(false); setPaletteOpen(true); }}>Tools</button><button onClick={() => { setMobileMore(false); setDrawer("research"); setLeftOpen(true); }}>Research Areas</button><button onClick={() => { setMobileMore(false); setDrawer("observations"); setLeftOpen(true); }}>Observations</button><button onClick={() => { setMobileMore(false); setDrawer("views"); setLeftOpen(true); }}>Saved Views</button><WorkspaceSelector name={workspaceName} /><Link href="/app/settings">Account and settings</Link></div>}
      <nav className="workspace-dock" aria-label="Map tools">
        {([
          ["search", "Search", "search"], ["spatial", "Tools", "tools"], ["layers", "Layers", "layers"], ["properties", "Properties", "properties"], ["research", "Research Areas", "research"], ["observations", "Observations", "observations"],
        ] as const).map(([id, label, icon]) => <button key={id} type="button" aria-label={label} title={label} data-map-search-trigger={id === "search" ? "" : undefined} aria-pressed={id === "search" ? searchOpen : id === "spatial" ? paletteOpen : leftOpen && drawer === id} onClick={async () => {
          if (!(await pauseObservation())) return;
          if(id === "search"){setSearchOpen(v=>!v);setPaletteOpen(false);setLeftOpen(false);return;}
          setSearchOpen(false);setRightOpen(false);setSheet("collapsed");
          if (id === "spatial") { setRightOpen(false);setSheet("collapsed"); setPaletteOpen((v) => !v); setLeftOpen(false); return; }
          setPaletteOpen(false);setRightOpen(false);setSheet("collapsed"); setLeftOpen((open) => drawer === id ? !open : true); setDrawer(id);
        }}><MapIcon name={icon}/></button>)}
        {canWrite && !draft && !drawMode && !(leftOpen && drawer === "observations") ? <button type="button" aria-label="Add observation" title="Add observation" onClick={() => { setLeftOpen(false); beginObservation(); }}><MapIcon name="plus"/></button> : null}
        <button className="dock-reset" type="button" aria-label="Reset Layout" title="Reset Layout" onClick={async () => { if (!(await pauseObservation())) return; setLeftOpen(false); setRightOpen(false); setPaletteOpen(false);  try { localStorage.removeItem(`${layoutKey}:spatial`); } catch {} window.dispatchEvent(new Event("landos:reset-layout")); }}><MapIcon name="reset"/></button>
      </nav>
      <aside className={`workspace-library ${leftOpen ? "open" : ""}`} aria-label="Workspace library" aria-hidden={!leftOpen} inert={!leftOpen}>
        <div className="workspace-library-head"><strong>{drawer === "search" ? "SEARCH" : drawer === "layers" ? "LAYERS" : drawer === "properties" ? "PROPERTIES" : drawer === "research" ? "RESEARCH AREAS" : drawer === "observations" ? "OBSERVATIONS" : "SAVED VIEWS"}</strong><button type="button" onClick={() => setLeftOpen(false)} aria-label="Close library">×</button></div>
        <div className="workspace-library-content">
          <div hidden={drawer !== "search"}><ParcelSearch key={`${userId}:${workspaceId}`} userId={userId} workspaceId={workspaceId} state={parcelState} identifyActive={Boolean(identifyState)} onStateChange={setParcelState} onIdentify={armParcelIdentify} onSelect={selectOfficialParcel} onAddress={(p) => setView(map.current, [p.latitude, p.longitude], 17)} /></div>
          <div hidden={drawer !== "layers"}><p className="drawer-intro">Official GIS datasets · added on demand</p><OfficialMapLayers controller={officialLayers} showSelection={false} /><LayerLibrary catalog={catalog} active={activeLayers} onChange={changeOfficialLayer} onReorder={reorderOfficialLayers} options={layerOptions} onOptionsChange={(id,value)=>setLayerOptions(current=>({...current,[id]:value}))} status={catalogueLayers.status} /><details><summary>Custom Data Layers</summary><p>Historical data is preserved. Open a feature to inspect or edit it; ambiguous records are not converted automatically.</p>{canWrite&&<button onClick={()=>{setImportDestination("layer");importInput.current?.click();}}>Import custom data</button>}{data.layers.filter(l=>l.layer_kind!=="research_area").map(layer=><div key={layer.id}><button onClick={async()=>{try{const full=await loadFullLayer(layer.id);setSelectedResearch({layer:full,features:full.geojson?.features||[]});setSelection(null);setRightOpen(true);setLeftOpen(false);setSheet("medium");}catch{setNotice("Custom data unavailable; saved geometry is preserved.");}}}>{layer.name}</button><button disabled={!canWrite} onClick={async()=>{if(!window.confirm("Classify this saved Custom Data Layer as a Research Area? Its original features will be preserved."))return;try{await apiRequest(`/api/research-areas/${layer.id}`,{classify:true},"PATCH");await reload();}catch(e){setNotice(e instanceof Error?e.message:"Classification failed");}}}>Classify as Research Area</button></div>)}</details></div>
          <div hidden={drawer !== "properties"}><p className="drawer-intro">Your saved properties and land assets.</p>{canWrite && <><button onClick={async () => { const title = window.prompt("Property name")?.trim(); const center = map.current?.getCenter(); if (!title || !center) return; try { await apiRequest("/api/properties", { title, latitude: center.lat, longitude: center.lng }); await reload(); setNotice("Property saved with a map location. Its boundary is not verified."); } catch (e) { setNotice(e instanceof Error ? e.message : "Property creation failed"); } }}>Create from map location</button><button onClick={()=>void startDrawing("Polygon")}>Draw property</button><button onClick={() => {setImportDestination("property");importInput.current?.click();}}>Import property</button></>}<label>Search Properties<input value={recordSearch} onChange={e=>setRecordSearch(e.target.value)} /></label>{data.parcels.filter(p=>`${p.title} ${p.address||""} ${p.source_parcel_id||""}`.toLowerCase().includes(recordSearch.toLowerCase())).map((property) => <div className="object-list-card" key={property.id}><button className="drawer-record" onClick={() => { selectSavedParcel(property); setTab("parcels"); setRightOpen(true); setLeftOpen(false); setSheet("medium"); void timeoutFetch(`/api/properties/${encodeURIComponent(property.id)}`).then((r) => r.json()).then((body) => { const geometry = propertyGeometry(body.property?.geometry); if (geometry && map.current) map.current.fitBounds(geometryBounds(geometry), { padding: 60, maxZoom: 18 }); }).catch(() => setNotice("Property geometry unavailable.")); }}><b>{property.title}</b><small>{property.address || "Saved property"} · {property.hectares != null ? formatArea(Number(property.hectares)*10000) : "Area unavailable"} · {property.status}</small></button><details className="object-overflow"><summary aria-label={`Actions for ${property.title}`}>Actions ⋯</summary><div className="actions"><ExportMenu onExport={format=>void exportProperty(property,format)} />{canWrite && <button onClick={async () => { const title = window.prompt("Property name", property.title)?.trim(); if (!title || title === property.title) return; try { await apiRequest(`/api/properties/${encodeURIComponent(property.id)}`, { title }, "PATCH"); await reload(); } catch (e) { setNotice(e instanceof Error ? e.message : "Rename failed"); } }}>Rename</button>}{canWrite && <button onClick={async () => { const notes = window.prompt("Property notes", property.notes || ""); if (notes === null) return; try { await apiRequest(`/api/properties/${encodeURIComponent(property.id)}`, { notes }, "PATCH"); await reload(); } catch (e) { setNotice(e instanceof Error ? e.message : "Notes update failed"); } }}>Notes</button>}{["owner", "admin"].includes(role) && <button onClick={async () => { if (!window.confirm(`Delete the saved property “${property.title}”? Official records will not be changed.`)) return; try { const response = await timeoutFetch(`/api/parcels?id=${encodeURIComponent(property.id)}`, { method: "DELETE" }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Delete failed"); clearAreas(); await reload(); setNotice("Saved property deleted."); } catch (e) { setNotice(e instanceof Error ? e.message : "Delete failed"); } }}>Delete</button>}<label><input type="checkbox" checked={!visibleParcelIds || visibleParcelIds.has(property.id)} onChange={(event) => setVisibleParcelIds((current) => { const next = new Set(current || data.parcels.map((item) => item.id)); if (event.target.checked) next.add(property.id); else next.delete(property.id); return next; })} /> Show on map</label></div></details></div>)}{!data.parcels.length && <p>No saved properties yet.</p>}</div>
          <div hidden={drawer !== "research"}><p className="drawer-intro">Your user-defined study areas; these are not official planning precincts.</p>{canWrite && <><button onClick={()=>void startDrawing("Polygon")}>Draw research area</button><button onClick={() => {setImportDestination("research");importInput.current?.click();}}>Import research area</button></>}<label>Search Research Areas<input value={researchSearch} onChange={e=>setResearchSearch(e.target.value)} /></label>{data.layers.filter((layer) => layer.layer_kind === "research_area" && layer.name.toLowerCase().includes(researchSearch.toLowerCase())).map((layer) => <div className="object-list-card" key={layer.id}><button className="drawer-record" onClick={() => { void openResearchArea(layer); }}><b>{layer.name}</b><small>Research Area · {String(layer.metadata?.research_subtype || "general")}</small></button><details className="object-overflow"><summary aria-label={`Actions for ${layer.name}`}>Actions ⋯</summary><div className="actions"><ExportMenu onExport={format=>void exportResearch(layer,format)} />{canWrite && <button onClick={async () => { const name = window.prompt("Research Area name", layer.name)?.trim(); if (!name || name === layer.name) return; try { await apiRequest(`/api/research-areas/${encodeURIComponent(layer.id)}`, { name }, "PATCH"); await reload(); } catch (e) { setNotice(e instanceof Error ? e.message : "Rename failed"); } }}>Rename</button>}{["owner", "admin"].includes(role) && <button onClick={async () => { if (!window.confirm(`Delete the Research Area “${layer.name}” and its saved geometry?`)) return; try { await apiRequest(`/api/research-areas/${encodeURIComponent(layer.id)}`, {}, "DELETE"); clearAreas(); await reload(); setNotice("Research Area deleted."); } catch (e) { setNotice(e instanceof Error ? e.message : "Delete failed"); } }}>Delete</button>}<label><input type="checkbox" checked={!visibleUserLayerIds || visibleUserLayerIds.has(layer.id)} onChange={(event) => setVisibleUserLayerIds((current) => { const next = new Set(current || data.layers.map((item) => item.id)); if (event.target.checked) next.add(layer.id); else next.delete(layer.id); return next; })} /> Show on map</label></div></details></div>)}{!data.layers.some((layer) => layer.layer_kind === "research_area") && <p>No Research Areas yet.</p>}</div>
          <div hidden={drawer !== "observations"}><p className="drawer-intro">Your field observations</p>{canWrite ? <button className="drawer-add" onClick={() => { setLeftOpen(false); beginObservation(); }}>＋ Add observation</button> : null}<label>Search Observations<input value={observationSearch} onChange={e=>setObservationSearch(e.target.value)} /></label>{data.observations.filter(o=>`${o.title} ${o.notes||""}`.toLowerCase().includes(observationSearch.toLowerCase())).map((observation) => <button className="drawer-record" key={observation.id} onClick={() => { setSelectedResearch(null);setSelection({kind:"observation", record:observation});setTab("observations");setRightOpen(true);setLeftOpen(false);setSheet("medium"); setView(map.current,[observation.latitude, observation.longitude],16); }}><b>{observation.title}</b><small>{new Date(observation.observed_at).toLocaleDateString()} · {observation.field_observation_media.length} photos</small><small>{(observation.notes || "").slice(0,100)}</small></button>)}{!data.observations.length ? <p>No observations yet. Add one from the map.</p> : null}{queue.length > 0 && <details aria-label="Observation drafts on this device"><summary>Drafts on this device ({queue.length})</summary>{queue.map((item) => <div className="drawer-record" key={item.id}><b>{item.input.title || "Untitled observation"}</b><small>{item.status} · Updated {new Date(item.updatedAt).toLocaleString()}</small><div className="actions"><button onClick={() => { draftRef.current = item; setDraft(item); setTab("observations"); setRightOpen(true); setLeftOpen(false); setSheet("expanded"); }}>Resume</button><button disabled={item.status === "uploading" || Boolean(item.photoSelection && nativePhotoActive.current)} onClick={async () => { if (!window.confirm(`Delete the device draft “${item.input.title || "Untitled observation"}”?`)) return; try { await removeDraft(item.id); if (draftRef.current?.id === item.id) { draftRef.current = null; setDraft(null); } await reloadQueue(); setNotice("Device observation draft deleted."); } catch { setNotice("Unable to delete this device draft. It has been preserved."); } }}>Delete</button></div></div>)}</details>}</div>
          <div hidden={drawer !== "views"}>{savedViewsPanel}</div>
        </div>
      </aside>
      <button className="workspace-right-toggle" onClick={async () => { if (rightOpen && !(await pauseObservation())) return; setRightOpen((v) => !v); }} aria-label={rightOpen ? "Collapse Inspector" : "Open Inspector"} aria-expanded={rightOpen}>{rightOpen ? "›" : "‹"}</button>
      {paletteOpen ? (
      <FloatingMapWidget
        title="Spatial Tools"
        storageKey={`${layoutKey}:spatial`}
        initialPosition={{ x: 80, y: 100 }}
        initiallyExpanded
      >
        <div className="spatial-widget-tools">
          <button onClick={async()=>{if(!(await pauseObservation()))return;setSearchOpen(false);setPaletteOpen(false);setRightOpen(false);setSheet("collapsed");setDrawer("search");setLeftOpen(true);}}>Parcel search and identify</button>
          {(
            [
              ["LineString", "Line / distance", "line"],
              ["Polygon", "Polygon / area", "polygon"],
              ["Rectangle", "Rectangle", "rectangle"],
              ["Point", "Point", "point"],
            ] as [DrawingKind, string, "line"|"polygon"|"rectangle"|"point"][]
          ).map(([type, label, icon]) => (
            <button
              key={type}
              aria-label={label}
              aria-pressed={drawMode && kind === type}
              disabled={!canWrite}
              onClick={() => startDrawing(type)}
            >
              <span className="tool-icon"><MapIcon name={icon}/></span><span>{label}</span>
            </button>
          ))}
          <button type="button" onClick={activateElevation}>Elevation</button><button type="button" onClick={activateProfile}>Elevation profile</button><button type="button" onClick={() => setHillshade((value) => !value)} aria-pressed={hillshade}>Hillshade</button>{dem && <label>Relief<select aria-label="Tool terrain exaggeration" value={terrainExaggeration} onChange={(event) => setTerrainExaggeration(Number(event.target.value))}><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></label>}
          <button type="button" aria-label="Measure distance" disabled={!canWrite || drawMode} onClick={() => startDrawing("LineString")}><span className="tool-icon"><MapIcon name="measure"/></span><span>Measure distance</span></button>
          <button className="mobile-multiselect-tool" aria-label="Previous map view" disabled={historyPosition.index === 0} onClick={() => navigateHistory(-1)}>← Previous</button>
          <button className="mobile-multiselect-tool" aria-label="Next map view" disabled={historyPosition.index >= historyPosition.length - 1} onClick={() => navigateHistory(1)}>→ Next</button>
          <button className="mobile-multiselect-tool" aria-label="Go to home view" onClick={goHome}>⌂ Home</button>
          <button className="mobile-multiselect-tool" aria-label="Save home view" onClick={() => { if (!map.current) return; try { localStorage.setItem(homeKey, JSON.stringify(cameraView(map.current))); setNotice("Current map view saved as Home on this device."); } catch { setNotice("Unable to save Home on this device."); } }}>⌂＋ Set home</button>
          <button className="mobile-multiselect-tool" type="button" aria-label="Toggle multi-select" aria-pressed={multiSelect} onClick={() => { multiSelectRef.current = !multiSelectRef.current; setMultiSelect(multiSelectRef.current); setPaletteOpen(false); }}><span className="tool-icon" aria-hidden="true">▧</span><span>Multi-select</span></button>
          <button type="button" aria-label="Radius" aria-expanded={radiusOpen} onClick={() => setRadiusOpen((v) => !v)}><span className="tool-icon"><MapIcon name="radius"/></span><span>Radius</span></button>
          {radiusOpen ? <div className="radius-settings"><label>Radius (km) <input aria-label="Radius kilometres" type="number" min="0.01" max="500" step="0.1" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} /></label><button disabled={!canWrite} onClick={async()=>{if(!(await pauseObservation()))return;if(localLayer||session.active||session.found){setRightOpen(false);setPaletteOpen(false);return;}elevationMode.current=false;setElevationActive(false);profileMode.current=false;setProfileDrawing(false);radiusPlacementRef.current=true;setRadiusPlacement(true);setPaletteOpen(false);setLeftOpen(false);setRightOpen(false);setSheet("collapsed");}}>Place centre on map</button><button disabled={!canWrite} onClick={() => void createRadius()}>Use map centre</button></div> : null}
          <button disabled={!canWrite} aria-label="Import spatial file" onClick={() => importInput.current?.click()}><span className="tool-icon" aria-hidden="true">⇧</span><span>Import</span></button>
          <button aria-label="Inspect centre coordinates" onClick={() => { const c = map.current?.getCenter(); if (c) setNotice(`Map centre: ${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`); }}><span className="tool-icon" aria-hidden="true">⌖</span><span>Coordinates</span></button>
          <details><summary>Drawing drafts ({localLayer || session.found || session.active ? 1 : 0})</summary>{localLayer?<button onClick={()=>{clearAreas();setSelection(null);setRightOpen(false);setPaletteOpen(false);setSheet("collapsed");}}>Resume {localLayer.name}</button>:session.found?<button onClick={()=>{drawing.current=true;drawKind.current=session.found!.kind;session.resume();setPaletteOpen(false);setRightOpen(false);setSheet("collapsed");}}>Resume unfinished drawing</button>:<p>{drawMode?"Your drawing is active on the map.":"No unfinished drawing on this device."}</p>}</details>
          <small>{drawMode ? `Active: ${kind}` : "Select a tool to begin"}</small>
        </div>
      </FloatingMapWidget>
      ) : null}
      <input ref={importInput} type="file" hidden accept=".geojson,.json,.kml,.kmz" onChange={(e) => { if (e.target.files?.[0]) { panelRevision.current += 1; setSelectionDetails(false); setTab("layers"); setRightOpen(true); setPaletteOpen(false); setSheet("medium"); void importLayer(e.target.files[0]); } e.target.value = ""; }} />
      <div className="parcel-multi-control">
        <button type="button" aria-pressed={multiSelect} disabled={drawMode || Boolean(draft)} onClick={() => { multiSelectRef.current = !multiSelectRef.current; setMultiSelect(multiSelectRef.current); if (window.matchMedia("(max-width: 767px)").matches) { if (multiSelectRef.current) setRightOpen(false); else if (selection || selectedAreas.length) setRightOpen(true); } }}>{multiSelect ? "Done selecting" : "Multi-select"}</button>
        {multiSelect ? <span aria-live="polite">{selectedAreas.length} selected</span> : null}
        {multiSelect && selectedAreas.length ? <button onClick={clearAreas}>Clear</button> : null}
      </div>
      {hitChoices.length ? <section className="parcel-hit-chooser" aria-label="Choose a map feature"><strong>Choose a map feature</strong>{hitChoices.map((choice) => <button key={`${choice.kind}:${choice.id}`} onClick={() => { window.dispatchEvent(new CustomEvent("landos:select-rendered", { detail: { scope: `${userId}:${workspaceId}`, ...choice } })); setHitChoices([]); }}>{choice.title} · {choice.kind === "workspace-feature" ? "Layer feature" : choice.kind}</button>)}<button onClick={() => setHitChoices([])}>Cancel</button></section> : null}
      {selectedAreas.length ? <section className="parcel-selection-summary" aria-label="Parcel Selection Summary">
        <button className="selection-chip-open" onClick={async () => { if (!(await pauseObservation())) return; setSelection(null); setSelectionDetails(true); setRightOpen(true); setLeftOpen(false); setSheet("expanded"); window.setTimeout(() => document.querySelector<HTMLElement>(".selection-inspector")?.focus(), 0); }} aria-label="Open selection details">
          {selectedAreas.length} {selectedAreas.every((item) => item.kind === "parcel") ? (selectedAreas.length === 1 ? "parcel" : "parcels") : (selectedAreas.length === 1 ? "feature" : "items")} selected · {formatArea(areaSummary.areaM2)}{areaSummary.incomplete ? " · Incomplete" : ""}{areaSummary.overlaps ? " · Overlap" : ""}
        </button>
        <button className="selection-chip-clear" onClick={clearAreas} aria-label="Clear all selected items">×</button>
      </section> : null}
      <div className="compact-location" aria-label="Location controls">
        <button type="button" aria-label="Back to previous map view" title="Back to previous map view" disabled={historyPosition.index === 0} onClick={() => navigateHistory(-1)}>←</button>
        <button type="button" aria-label="Forward to next map view" title="Forward to next map view" disabled={historyPosition.index >= historyPosition.length - 1} onClick={() => navigateHistory(1)}>→</button>
        <button type="button" aria-label="Home" title="Home" onClick={goHome}>⌂</button>
        <button type="button" aria-label="Set current view as Home" title="Set current view as Home" onClick={() => { if (!map.current) return; try { localStorage.setItem(homeKey, JSON.stringify(cameraView(map.current))); setNotice("Current map view saved as Home on this device."); } catch { setNotice("Unable to save Home on this device."); } }}>⌂＋</button>
        <button className="mobile-measure" type="button" aria-label="Open measurement tools" onClick={() => setPaletteOpen((value) => !value)}>✎</button>
        <button type="button" onClick={() => locate()} aria-label="Locate Me" title={locating ? "Locating…" : "Locate me"} disabled={locating}>{locating ? "…" : "⌖"}</button>
        <button type="button" className={follow ? "active" : ""} onClick={() => (follow ? stopFollow() : locate(true))} aria-label={follow ? "Stop following" : "Follow Me"} title={follow ? "Stop following" : "Follow me"}>➤</button>
        <button type="button" onClick={() => map.current?.resetNorth()} aria-label="Reset bearing" title="Reset north">N</button>
      </div>
      {fix ? (
        <div className="accuracy">
          Accuracy ±{Math.round(fix.accuracy)} m{follow ? " · Following" : ""}
        </div>
      ) : null}
      <div className="field-action">
        {canWrite ? (
          !drawMode ? (
            <button className="primary" onClick={() => beginObservation()}>
              ＋ Add observation
            </button>
          ) : null
        ) : (
          <span>Read-only workspace</span>
        )}
      </div>
      {deletedFeature && <div className="drawing-undo" role="status">Shape deleted <button onClick={async () => { try { const complete = await loadFullLayer(deletedFeature.layerId); if (!complete.geojson || !safeStoredFeatureIds(complete.geojson.features) || complete.geojson.features.some((feature) => String(feature.id) === String(deletedFeature.feature.id))) throw new Error("Cannot safely restore this shape."); await apiRequest("/api/layers", { id: complete.id, name: complete.name, geojson: { type: "FeatureCollection", features: [...complete.geojson.features, deletedFeature.feature] } }); setDeletedFeature(null); await reload(); setNotice("Shape restored."); } catch (e) { setNotice(e instanceof Error ? e.message : "Restore failed"); } }}>Undo</button><button aria-label="Dismiss undo" onClick={() => setDeletedFeature(null)}>×</button></div>}
      {notice ? (
        <div className="map-notice" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      ) : null}
      <aside
        inert={(!rightOpen && !isMobile) || (isMobile && leftOpen)}
        className={`inspector ${sheet} ${officialParcel && !selectionDetails ? "has-mobile-parcel" : ""}`}
        style={isMobile && sheetDrag ? { transform: `translateY(${sheetDrag}px)` } : undefined}
        aria-hidden={(!rightOpen && !isMobile) || (isMobile && leftOpen)}
      >
        <div className="sheet-handle" onPointerDown={(event) => { if (!isMobile) return; dragStart.current = event.clientY; dragged.current = false; }} onPointerMove={(event) => { if (dragStart.current === null) return; const delta = event.clientY - dragStart.current; if (Math.abs(delta) > 8 && !dragged.current) { dragged.current = true; event.currentTarget.setPointerCapture(event.pointerId); } setSheetDrag(Math.max(-180, Math.min(180, delta))); }} onPointerUp={(event) => { if (dragStart.current === null) return; const delta = event.clientY - dragStart.current; dragStart.current = null; setSheetDrag(0); if (Math.abs(delta) > 45) { setRightOpen(true); setSheet((current) => delta < 0 ? (current === "collapsed" ? "medium" : "expanded") : (current === "expanded" ? "medium" : "collapsed")); } }} onPointerCancel={() => { dragStart.current = null; setSheetDrag(0); }}>
          <span className="mobile-sheet-label">Workspace</span>
          <button
            onClick={() => { if (dragged.current) { dragged.current = false; return; } setRightOpen(true);
              setSheet(
                sheet === "collapsed"
                  ? "medium"
                  : sheet === "medium"
                    ? "expanded"
                    : "collapsed",
              );
            }}
            aria-label="Resize inspector"
            title={`Sheet: ${sheet === "collapsed" ? "peek" : sheet === "medium" ? "half" : "full"}`}
          >
            <span />
          </button>
        </div>
        <div className="inspector-heading"><button className="detail-back" aria-label="Back to object list" onClick={async()=>{if(!(await pauseObservation()))return;setRightOpen(false);setSheet("collapsed");setDrawer(selectedResearch?"research":selectedParcel?"properties":selected?"observations":"research");setLeftOpen(true);}}><MapIcon name="back"/></button>
          <div>
            <h2>
              {drawMode
                ? "Edit shape"
                : draft
                  ? "New observation"
                  : selectionDetails && selectedAreas.length
                    ? "Selection"
                  : selected
                    ? selected.title
                    : selectedParcel || officialParcel
                      ? selectedParcel?.title || officialParcel?.address || "Parcel details"
                      : selectedResearch ? selectedResearch.layer.name : selectedDrawing ? String(selectedDrawing.properties?.name || "Drawing") : tab === "layers"
                        ? "Details"
                        : "Workspace"}
            </h2>
          </div>

          <button
            onClick={() => { const revision = panelRevision.current; void pauseObservation().then((saved) => { if (saved && panelRevision.current === revision) { setRightOpen(false); if (isMobile) setSheet("collapsed"); } }); }}
            disabled={
              processingPhotos > 0 ||
              Boolean(draft?.photoSelection && nativePhotoActive.current)
            }
            aria-label="Close inspector"
          >
            <MapIcon name="close"/>
          </button>
        </div>
        <div className="inspector-content">
          {selectedResearch && !draft && <section aria-label="Selected Research Area"><h3>{selectedResearch.layer.name}</h3>{canWrite && selectedResearch.layer.layer_kind === "research_area" && <details><summary>Edit Research Area</summary><form onSubmit={async event=>{event.preventDefault();const values=new FormData(event.currentTarget);const name=String(values.get("name")||"").trim(),description=String(values.get("description")||""),subtype=String(values.get("subtype")||"general");try{await apiRequest(`/api/research-areas/${selectedResearch.layer.id}`,{name,description,subtype},"PATCH");setSelectedResearch(current=>current?{...current,layer:{...current.layer,name,metadata:{...current.layer.metadata,description,research_subtype:subtype}}}:current);await reload();setNotice("Research Area updated.");}catch(e){setNotice(e instanceof Error?e.message:"Update failed");}}}><label>Name<input name="name" defaultValue={selectedResearch.layer.name} required maxLength={160}/></label><label>Type<select name="subtype" defaultValue={String(selectedResearch.layer.metadata?.research_subtype||"general")}><option value="general">General Study Area</option><option value="investigation">Investigation Area</option><option value="precinct">Precinct</option><option value="growth">Growth Area</option><option value="other">Other</option></select></label><label>Notes<textarea name="description" maxLength={2000} defaultValue={String(selectedResearch.layer.metadata?.description||"")}/></label><button>Save details</button></form></details>}{selectedResearch.layer.layer_kind === "research_area" && <ResearchRelations key={selectedResearch.layer.id} id={selectedResearch.layer.id} properties={data.parcels} editable={canWrite} />}<p>Type: {String(selectedResearch.layer.metadata?.research_subtype || selectedResearch.layer.layer_kind)} · Source: {String(selectedResearch.layer.metadata?.source_file || "Workspace geometry")}</p><p>{String(selectedResearch.layer.metadata?.description || "")}</p><LayerFeatureBrowser scope={`${userId}:${workspaceId}`} layer={selectedResearch.layer} opacity={layerOpacity[selectedResearch.layer.id] ?? 1} onOpacityChange={value=>setLayerOpacity(v=>({...v,[selectedResearch.layer.id]:value}))} onSelect={feature=>{const record=selectedResearch.layer;setSelectedResearch(null);setSelection({kind:"drawing",record,featureId:String(feature.id)});setTab("layers");setRightOpen(true);setSheet("medium");}} /><p>{selectedResearch.features.length} features · Approximate area {formatArea(selectedResearch.features.reduce((sum, feature) => sum + geometryMeasurement(feature.geometry).areaM2, 0))}</p><small>User-defined geometry, not an official planning precinct. Overlapping features may be counted more than once.</small><div className="actions"><ExportMenu onExport={format=>exportFeatures(selectedResearch.features,format,selectedResearch.layer.name)} /><button onClick={clearAreas}>Clear selection</button></div></section>}
          {spatialImport && <section className="local-layer" aria-label="Spatial import preview"><h3>Import spatial data</h3><p>Preview only · not saved yet</p><p>{spatialImport.geojson.features.length} features · {[...new Set(spatialImport.geojson.features.map((feature) => feature.geometry.type))].join(", ")}</p><p>Estimated bounds: {geometryBounds(spatialImport.geojson).getSouthWest().lat.toFixed(4)}, {geometryBounds(spatialImport.geojson).getSouthWest().lng.toFixed(4)} to {geometryBounds(spatialImport.geojson).getNorthEast().lat.toFixed(4)}, {geometryBounds(spatialImport.geojson).getNorthEast().lng.toFixed(4)}</p><p>Approximate area: {formatArea(spatialImport.geojson.features.reduce((sum, feature) => sum + geometryMeasurement(feature.geometry).areaM2, 0))}. Imported geometry is user supplied, not official cadastre.</p><details><summary>Feature names</summary>{spatialImport.geojson.features.slice(0, 50).map((feature, index) => <p key={String(feature.id)}>{String(feature.properties?.name || `Feature ${index + 1}`)}</p>)}</details><label>Destination<select aria-label="Import destination" value={spatialImport.destination} onChange={(event) => setSpatialImport({ ...spatialImport, destination: event.target.value as typeof spatialImport.destination })}><option value="property">Property</option><option value="research">Research Area</option><option value="layer">Custom Layer</option></select></label>{spatialImport.destination === "research" && <label>Research Area type<select value={spatialImport.subtype || "general"} onChange={(event) => setSpatialImport({ ...spatialImport, subtype: event.target.value as NonNullable<SpatialImportDraft["subtype"]> })}><option value="general">General Study Area</option><option value="investigation">Investigation Area</option><option value="precinct">Precinct</option><option value="growth">Growth Area</option><option value="other">Other</option></select></label>}<label>Name<input aria-label="Import name" value={spatialImport.name} maxLength={160} onChange={(event) => setSpatialImport({ ...spatialImport, name: event.target.value })} /></label><label>Description<textarea value={spatialImport.description} maxLength={2000} onChange={(event) => setSpatialImport({ ...spatialImport, description: event.target.value })} /></label><div className="actions"><button disabled={importSaving || !spatialImport.name.trim()} onClick={() => void saveSpatialImport()}>{importSaving ? "Saving…" : "Save import"}</button><button disabled={importSaving} onClick={() => { if (window.confirm("Discard this unsaved import preview?")) setSpatialImport(null); }}>Discard preview</button></div></section>}
          {isMobile && !draft && officialParcel && !selectionDetails && <section className="mobile-parcel-summary" aria-label="Selected parcel summary">
            <strong>{[officialParcel.lot, officialParcel.plan].filter(Boolean).join(" / ") || officialParcel.sourceId}</strong>
            <span>{formatArea(officialParcel.areaM2)} · {officialParcel.state}</span>
            <div className="mobile-parcel-actions">
              {canWrite && <button onClick={async () => { try { const result = await apiRequest("/api/parcels", officialParcel); setSelection({ kind: "parcel", record: result.parcel }); await reload(); setNotice("Property saved to Workspace."); } catch (e) { setNotice(e instanceof Error ? e.message : "Property save failed"); } }}>Save</button>}
              <button onClick={() => { setSheet("collapsed"); setPaletteOpen(true); }}>Measure</button>
              <button onClick={() => setSheet("expanded")}>Details</button>
            </div>
          </section>}
          {dem && mapMode === "3d" && <details><summary>Terrain source and accuracy</summary>{providers.length > 1 && <label>Terrain provider<select aria-label="Terrain provider" value={dem.id} onChange={(e) => { profileMode.current = false; setProfileDrawing(false); sampleAbort.current?.abort(); setPointStatus("unavailable"); setProviderId(e.target.value); setPointElevation(null); setProfile([]); setProfilePoints([]); setParcelHeights(null); setParcelHeightMessage(""); setTerrainCoverage("unknown"); }} >{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}</select></label>}{dem.testingOnly && <p>Testing only. Provider permissions and vertical datum are not approved for production.</p>}<p>{dem.attribution}. {terrainMetadata} Elevations are approximate and not survey grade; do not compare heights across different or unknown datums. {!dem.datumVerified && "Profile and parcel calculations are withheld until datum consistency is verified."}</p></details>}
          {!draft && selectionDetails && selectedAreas.length ? <section className="selection-inspector" aria-label="Selected parcels and features" tabIndex={-1}><h3>Selection · {selectedAreas.length}</h3><p>{formatArea(areaSummary.areaM2)} calculated · {Math.round(areaSummary.areaM2).toLocaleString("en-AU")} m²</p><small>Geodesic geometry area, not surveyed title area.{areaSummary.incomplete ? " Incomplete: some boundaries or areas are unavailable." : ""}{areaSummary.overlaps ? " Boundaries overlap; the total may double-count land." : ""}</small><ul>{selectedAreas.map((item, index) => <li key={item.id}><button onClick={() => { setSelection(item.detail); setSelectionDetails(false); setTab(item.detail.kind === "drawing" ? "layers" : "parcels"); }}>{index + 1}. {item.label}</button><small>{item.kind === "feature" ? "Layer feature" : "Parcel"} · {item.source}{item.detail.kind === "official-parcel" || item.detail.kind === "parcel" ? ` · ${[item.detail.record.lot, item.detail.record.plan].filter(Boolean).join(" / ") || (item.detail.kind === "official-parcel" ? item.detail.record.sourceId : item.detail.record.source_parcel_id) || "ID unavailable"}` : ""} · {item.geometry ? formatArea(geometryMeasurement(item.geometry).areaM2) : "Area unavailable"}</small><button aria-label={`Remove ${item.label} from selection`} onClick={() => removeArea(item.id)}>×</button></li>)}</ul><div className="actions"><button onClick={fitSelectedAreas}>Fit to All</button>{canWrite&&<button onClick={()=>void saveSelectionProperty()}>Save as one Property</button>}<button onClick={clearAreas}>Clear All</button></div></section> : null}
          {!draft && !selectionDetails && selectedAreas.length > 1 ? <button onClick={() => { setSelection(null); setSelectionDetails(true); }}>Back to Selection</button> : null}
          {draft ? (
            <section className="observation-form">
              <fieldset disabled={draft.status === "uploading"}>
                <p className="draft-label">LOCAL DRAFT · ONLY ON THIS DEVICE</p>
                <label>Linked Property<select value={draft.input.linked_parcel_id || ""} onChange={(event) => void saveDraft({ ...draft, input: { ...draft.input, linked_parcel_id: event.target.value || null } })}><option value="">Independent location</option>{data.parcels.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
                <label>Linked Research Area<select value={draft.input.linked_research_area_id || ""} onChange={(event) => void saveDraft({ ...draft, input: { ...draft.input, linked_research_area_id: event.target.value || null } })}><option value="">None</option>{data.layers.filter((layer) => layer.layer_kind === "research_area").map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label>
                {draft.input.linked_parcel_id ? (
                  <p>
                    Linked property:{" "}
                    {data.parcels.find(
                      (p) => p.id === draft.input.linked_parcel_id,
                    )?.title || "Saved property"}
                  </p>
                ) : null}
                <label>
                  Title
                  <input
                    value={draft.input.title}
                    maxLength={160}
                    placeholder="What did you find?"
                    onChange={(e) =>
                      void saveDraft({
                        ...draft,
                        input: { ...draft.input, title: e.target.value },
                        updatedAt: Date.now(),
                      })
                    }
                  />
                </label>
                <label>
                  Field notes
                  <textarea
                    value={draft.input.notes}
                    placeholder="Access, terrain, opportunities…"
                    rows={4}
                    onChange={(e) =>
                      void saveDraft({
                        ...draft,
                        input: { ...draft.input, notes: e.target.value },
                        updatedAt: Date.now(),
                      })
                    }
                  />
                </label>
                <p className="coordinates">
                  {draft.input.latitude.toFixed(6)},{" "}
                  {draft.input.longitude.toFixed(6)} · Tap map to adjust
                </p>
                <div className="actions">
                  <button
                    onClick={() => {
                      if (
                        !sendNative("openCamera", { observationId: draft.id })
                      )
                        cameraInput.current?.click();
                    }}
                  >
                    ◉ Take photo
                  </button>
                  <button
                    onClick={() => {
                      if (
                        !sendNative("openPhotoLibrary", {
                          observationId: draft.id,
                        })
                      )
                        libraryInput.current?.click();
                    }}
                  >
                    ▧ Photo library
                  </button>
                </div>
                <input
                  hidden
                  ref={cameraInput}
                  type="file"
                  accept="image/jpeg,image/png,image/heic"
                  capture="environment"
                  onChange={(e) => {
                    void addPhotos(Array.from(e.target.files || []));
                    e.target.value = "";
                  }}
                />
                <input
                  hidden
                  ref={libraryInput}
                  type="file"
                  accept="image/jpeg,image/png,image/heic"
                  multiple
                  onChange={(e) => {
                    void addPhotos(Array.from(e.target.files || []));
                    e.target.value = "";
                  }}
                />
                {processingPhotos > 0 ? (
                  <p role="status">Importing photos… Keep this screen open.</p>
                ) : null}
                {draft.photoSelection ? (
                  <div role="status">
                    <p>
                      {draft.photoSelection.received} of{" "}
                      {draft.photoSelection.expected} selected photos imported.{" "}
                      {draft.photoSelection.finished
                        ? "Review missing photos before saving."
                        : "Photo selection is incomplete."}
                    </p>
                    {!processingPhotos && !nativePhotoActive.current ? (
                      <button
                        onClick={() =>
                          void saveDraft({
                            ...draft,
                            photoSelection: undefined,
                          })
                        }
                      >
                        Continue with imported photos
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <div className="photo-grid">
                  {draft.photos.map((p) => (
                    <DraftPhoto key={p.input.id} photo={p} />
                  ))}
                </div>
                <button
                  className="primary full"
                  disabled={
                    draft.status === "uploading" ||
                    processingPhotos > 0 ||
                    Boolean(draft.photoSelection)
                  }
                  onClick={() => void submitDraft()}
                >
                  {draft.status === "uploading"
                    ? "Uploading…"
                    : "Save to Workspace ↗"}
                </button>
                <button type="button" className="full" disabled={processingPhotos > 0 || Boolean(draft.photoSelection && nativePhotoActive.current)} onClick={() => void pauseObservation().then((saved) => { if (saved) setNotice("Observation closed. Any entered draft is available under On this device."); })}>
                  Save draft and close
                </button>
              </fieldset>
            </section>
          ) : null}
          {!draft && !selectionDetails && selected ? (
            <section>
              <p>{selected.notes || "No field notes."}</p>
              <p className="coordinates">
                {new Date(selected.observed_at).toLocaleString()}
              </p>
              {canWrite && <div className="actions"><button onClick={() => {
                const next: FieldDraft = { id: selected.id, userId, workspaceId, input: { id: selected.id, workspace_id: workspaceId, title: selected.title, notes: selected.notes || "", latitude: selected.latitude, longitude: selected.longitude, observed_at: selected.observed_at, linked_parcel_id: selected.linked_parcel_id, linked_research_area_id: selected.linked_research_area_id, metadata: selected.metadata }, photos: [], status: "draft", updatedAt: Date.now() };
                draftRef.current = next; setDraft(next); void saveDraft(next);
              }}>Edit observation</button>{canManage && <button className="destructive" onClick={async () => { if (!window.confirm("Delete this saved observation and its photo records?")) return; try { await apiRequest("/api/observations", { id: selected.id }, "DELETE"); setSelected(null); await reload(); } catch (e) { setNotice(e instanceof Error ? e.message : "Delete failed"); } }}>Delete observation</button>}</div>}
              <div className="photo-grid">
                {selected.field_observation_media.map((m) => (
                  <figure key={m.id}>
                    {m.url ? (
                      <PhotoPreview
                        key={m.url}
                        url={m.url}
                        filename={m.original_filename}
                        mime={m.mime_type}
                      />
                    ) : (
                      <div className="photo-pending">
                        {m.upload_status === "legacy_pending"
                          ? "Legacy file awaiting safe copy"
                          : m.upload_status}
                      </div>
                    )}
                    <figcaption>{m.original_filename}</figcaption>
                  </figure>
                ))}
              </div>
              <button
                onClick={() =>
                  sendNative("openExternalNavigation", {
                    latitude: selected.latitude,
                    longitude: selected.longitude,
                  })
                }
              >
                Open navigation
              </button>
            </section>
          ) : null}
          {!draft && !selectionDetails && tab === "parcels" ? (
            <>
              {identifyBusy ? <p role="status">Identifying parcel…</p> : null}
              {identifiedParcels.length > 1 ? (
                <section aria-label="Map parcel matches">
                  <h3>Choose the parcel at this point</h3>
                  {identifiedParcels.map((parcel) => (
                    <button
                      className="record-row"
                      key={parcel.sourceId}
                      onClick={() => {
                        setIdentifiedParcels([]);
                        selectOfficialParcel(parcel);
                      }}
                    >
                      <span>
                        <strong>{parcel.address}</strong>
                        <small>
                          {parcel.state} · Parcel {parcel.sourceId} ·{" "}
                          {formatArea(parcel.areaM2)} · {parcel.source}
                        </small>
                      </span>
                    </button>
                  ))}
                </section>
              ) : null}
              {officialParcel || selectedParcel ? (
                <section className="property-details">
                  <h3>Parcel details</h3>
                  {officialParcel && <><label><input type="checkbox" checked={showParcelEdges} onChange={(event) => setShowParcelEdges(event.target.checked)} /> Show boundary lengths</label><small>Approximate GIS measurement — not a cadastral survey. {officialParcel.geometry.type === "Polygon" && officialParcel.geometry.coordinates.flat().length > 40 ? "Some segment labels are omitted for clarity." : ""}</small></>}
                  {selectedParcel && !selectedBoundary ? (
                    <><p role="status">Location only — boundary not linked. A nearby parcel is not automatically linked to this property.</p>
                    {!selectedParcel.state ? <label>Lookup state <select value={parcelState} onChange={(e) => setParcelState(e.target.value as SupportedState)}><option value="VIC">Victoria</option><option value="NSW">New South Wales</option></select></label> : null}
                    <button disabled={identifyBusy} onClick={() => void findBoundaryCandidates(selectedParcel)}>Find official parcel boundary</button>
                    {candidateProperty === selectedParcel.id ? <div><p>Preview candidates; no association is saved until confirmed. To add another parcel, enter a point inside it.</p><label>Latitude <input type="number" value={candidateLatitude} onChange={(e) => setCandidateLatitude(e.target.value)} /></label><label>Longitude <input type="number" value={candidateLongitude} onChange={(e) => setCandidateLongitude(e.target.value)} /></label><button disabled={identifyBusy} onClick={() => void findBoundaryCandidates(selectedParcel, true)}>Find another parcel</button>{boundaryCandidates.map((p) => <label key={`${p.state}:${p.sourceId}`}><input type="checkbox" checked={previewCandidates.includes(p.sourceId)} onChange={(e) => setPreviewCandidates((current) => e.target.checked ? [...current, p.sourceId] : current.filter((id) => id !== p.sourceId))} /> {p.address || p.sourceId} · {p.lot || ""} {p.plan || ""}</label>)}{canWrite && boundaryCandidates.length ? <button disabled={identifyBusy || !previewCandidates.length || (selectedParcel.geometry !== null && !isLocationGeometry(selectedParcel.geometry))} onClick={() => void associateBoundaries(selectedParcel)}>Associate selected boundaries</button> : null}{selectedParcel.geometry !== null && !isLocationGeometry(selectedParcel.geometry) ? <p>Existing stored geometry cannot be replaced by this action.</p> : null}</div> : null}</>
                  ) : null}
                  <div className="actions">
                    <button
                      onClick={() => {
                        const geometry =
                          officialParcel?.geometry || selectedBoundary;
                        if (map.current && geometry)
                          map.current.fitBounds(geometryBounds(geometry), {
                            padding: 60,
                            maxZoom: 18,
                          });
                      }}
                    >
                      Fit to Parcel
                    </button>
                    <button onClick={clearAreas}>
                      Clear Selection
                    </button>
                  </div>
                  <h3>
                    {officialParcel?.address ||
                      selectedParcel?.address ||
                      selectedParcel?.title ||
                      "Official parcel"}
                  </h3>
                  {selectedParcel && <div className="object-detail-actions"><ExportMenu onExport={format=>void exportProperty(selectedParcel,format)} /><button onClick={async()=>{const title=window.prompt("Property name",selectedParcel.title)?.trim();if(!title)return;try{await apiRequest(`/api/properties/${selectedParcel.id}`,{title},"PATCH");await reload();setSelection(current=>current?.kind==="parcel"?{...current,record:{...current.record,title}}:current);}catch(e){setNotice(e instanceof Error?e.message:"Edit failed");}}}>Edit name</button><button onClick={async()=>{const notes=window.prompt("Property notes",selectedParcel.notes||"");if(notes===null)return;try{await apiRequest(`/api/properties/${selectedParcel.id}`,{notes},"PATCH");await reload();setSelection(current=>current?.kind==="parcel"?{...current,record:{...current.record,notes}}:current);}catch(e){setNotice(e instanceof Error?e.message:"Notes update failed");}}}>Edit notes</button></div>}
                  <dl>
                    <dt>State</dt>
                    <dd>
                      {officialParcel?.state ||
                        selectedParcel?.state ||
                        "Legacy record"}
                    </dd>
                    <dt>Parcel / Lot / Plan</dt>
                    <dd>
                      {officialParcel
                        ? [
                            officialParcel.sourceId,
                            officialParcel.lot,
                            officialParcel.plan,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : selectedParcel?.source_parcel_id ||
                          "Legacy identifier"}
                    </dd>
                    <dt>Calculated area</dt>
                    <dd>
                      {officialParcel ? formatArea(officialParcel.areaM2) : selectedBoundary ? formatArea(geometryMeasurement(selectedBoundary).areaM2) : selectedParcel?.hectares != null ? `${formatArea(Number(selectedParcel.hectares) * 10000)} (recorded area)` : "Area unavailable"}
                    </dd>
                    <dt>Source</dt>
                    <dd>
                      {officialParcel?.source ||
                        selectedParcel?.source ||
                        "Imported workspace data"}
                    </dd>
                    <dt>Location</dt>
                    <dd>
                      {(
                        officialParcel?.latitude ?? selectedParcel?.latitude
                      )?.toFixed(6)}
                      ,{" "}
                      {(
                        officialParcel?.longitude ?? selectedParcel?.longitude
                      )?.toFixed(6)}
                    </dd>
                  </dl>
                  {officialParcel ? (
                    <>
                      <p>
                        <a
                          href={officialParcel.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Official source
                        </a>{" "}
                        ·{" "}
                        {officialParcel.sourceUpdatedAt
                          ? `Source date ${new Date(officialParcel.sourceUpdatedAt).toLocaleDateString()}`
                          : "Source update date not supplied"}
                      </p>
                      <p>
                        Boundary-derived area; not a title search or surveyed
                        legal area.
                      </p>
                      {canWrite ? (
                        <button
                          className="primary full"
                          onClick={async () => {
                            try {
                              const result = await apiRequest(
                                "/api/parcels",
                                officialParcel,
                              );
                              setSelection({
                                kind: "parcel",
                                record: result.parcel,
                              });
                              await reload();
                              setNotice("Property saved to Workspace.");
                            } catch (e) {
                              setNotice(
                                e instanceof Error
                                  ? e.message
                                  : "Property save failed",
                              );
                            }
                          }}
                        >
                          Save to Workspace
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p>Saved to Workspace</p>
                      {selectedParcel ? (
                        <PropertyWorkspace
                          key={selectedParcel.id}
                          parcel={selectedParcel}
                          catalog={catalog}
                          active={activeLayers}
                          onObservation={(observation) => {
                            setSelected(observation);
                            setTab("observations");
                            setSheet("expanded");
                          }}
                          onAddField={
                            canWrite
                              ? () => beginObservation(selectedParcel)
                              : undefined
                          }
                        />
                      ) : null}
                      <p>
                        {selectedParcel?.source_url?.startsWith("https://") ? (
                          <a
                            href={selectedParcel.source_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Official source
                          </a>
                        ) : null}{" "}
                        ·{" "}
                        {selectedParcel?.source_updated_at
                          ? `Source date ${new Date(selectedParcel.source_updated_at).toLocaleDateString()}`
                          : "Source update date not supplied"}
                      </p>
                      {selectedParcel?.retrieved_at ? (
                        <small>
                          Retrieved{" "}
                          {new Date(
                            selectedParcel.retrieved_at,
                          ).toLocaleString()}
                        </small>
                      ) : null}
                      {selectedParcel && ["owner", "admin"].includes(role) ? (
                        <button
                          onClick={async () => {
                            if (
                              !window.confirm(
                                "Remove this saved property from this Workspace? Linked records will block removal.",
                              )
                            )
                              return;
                            try {
                              const response = await timeoutFetch(
                                `/api/parcels?id=${selectedParcel.id}`,
                                { method: "DELETE" },
                              );
                              const result = await response.json();
                              if (!response.ok)
                                throw new Error(
                                  result.error || "Removal failed",
                                );
                              setSelection(null);
                              await reload();
                              setNotice("Property removed from Workspace.");
                            } catch (e) {
                              setNotice(
                                e instanceof Error
                                  ? e.message
                                  : "Removal failed",
                              );
                            }
                          }}
                        >
                          Remove from Workspace
                        </button>
                      ) : null}
                    </>
                  )}
                </section>
              ) : null}
            </>
          ) : null}
          {!draft && !selectionDetails && tab === "layers" ? (
            <>
              {selectedDrawing && selection?.kind === "drawing" ? (
                <div className="property-details">
                  <strong>
                    {String(selectedDrawing.properties?.name || "Shape")}
                  </strong>
                  <p>{String(selectedDrawing.properties?.note || "")}</p>
                  <p>{selectedDrawing.geometry.type} · Layer: {selection.record.name} · Workspace feature</p>
                  <label><input type="checkbox" checked={showDrawingArea} onChange={(event) => setShowDrawingArea(event.target.checked)} /> Show area / total length</label>
                  <label><input type="checkbox" checked={showDrawingEdges} onChange={(event) => setShowDrawingEdges(event.target.checked)} /> Show edge lengths</label>
                  <small>Horizontal GIS measurements are approximate.</small>
                  {selectedDrawing.properties && Object.entries(selectedDrawing.properties).filter(([key]) => key !== "name" && key !== "note").length ? <details><summary>Attributes</summary><dl>{Object.entries(selectedDrawing.properties).filter(([key]) => key !== "name" && key !== "note").slice(0, 20).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</dd></div>)}</dl></details> : null}
                  <div className="actions">
                    <button onClick={() => map.current?.fitBounds(geometryBounds(selectedDrawing.geometry), { padding: 60, maxZoom: 18 })}>Fit to Shape</button>
                    <button onClick={clearAreas}>Clear Selection</button>
                    <ExportMenu onExport={format=>exportFeatures([selectedDrawing],format,String(selectedDrawing.properties?.name||"landos-shape"))} />
                  </div>
                  <p>
                    {geometryMeasurement(selectedDrawing.geometry).areaM2
                      ? formatArea(
                          geometryMeasurement(selectedDrawing.geometry).areaM2,
                        )
                      : formatDistance(
                          geometryMeasurement(selectedDrawing.geometry)
                            .distanceM,
                        )}
                  </p>
                  {canWrite && stableFeatureId(selectedDrawing.id) && selection.record.layer_kind !== "radius" ? (
                    <div className="actions">
                      <button
                        onClick={async () => {
                          try {
                            const complete = await loadFullLayer(selection.record.id);
                            if (!complete.geojson || !safeStoredFeatureIds(complete.geojson.features)) throw new Error("This layer contains legacy or duplicate feature IDs and cannot be safely edited.");
                            const feature = complete.geojson?.features.find((f) => String(f.id) === selection.featureId);
                            if (!feature) throw new Error("The full shape is unavailable. Refresh and try again.");
                            startDrawing(
                            feature.properties?.drawing_kind ===
                              "Rectangle"
                              ? "Rectangle"
                              : feature.geometry.type === "Point"
                                ? "Point"
                                : feature.geometry.type === "LineString"
                                  ? "LineString"
                                  : "Polygon",
                            feature,
                            selection.record.id,
                          );
                          } catch (e) { setNotice(e instanceof Error ? e.message : "Unable to load the full shape."); }
                        }}
                      >
                        Edit shape
                      </button>
                      <button onClick={async () => {
                        try {
                          const complete = await loadFullLayer(selection.record.id);
                          if (!complete.geojson || !safeStoredFeatureIds(complete.geojson.features)) throw new Error("This layer cannot be safely copied.");
                          const original = complete.geojson.features.find((f) => String(f.id) === selection.featureId);
                          if (!original) throw new Error("Shape unavailable.");
                          const copy = { ...original, id: crypto.randomUUID() };
                          await apiRequest("/api/layers", { id: complete.id, name: complete.name, geojson: { type: "FeatureCollection", features: [...complete.geojson.features, copy] } });
                          await reload(); setNotice("Shape copied.");
                        } catch (e) { setNotice(e instanceof Error ? e.message : "Copy failed"); }
                      }}>Copy shape</button>
                      <button
                        onClick={async () => {
                          if (!window.confirm("Delete this shape from the workspace?")) return;
                          try {
                            const complete = await loadFullLayer(
                              selection.record.id,
                            );
                            if (!complete.geojson || !safeStoredFeatureIds(complete.geojson.features)) throw new Error("This layer contains legacy or duplicate feature IDs and cannot be safely edited.");
                            const removed = complete.geojson.features.find((f) => String(f.id) === String(selectedDrawing.id));
                            if (!removed) throw new Error("Shape unavailable.");
                            await apiRequest("/api/layers", {
                              id: selection.record.id,
                              name: selection.record.name,
                              geojson: {
                                type: "FeatureCollection",
                                features: complete.geojson.features.filter((f) => String(f.id) !== String(selectedDrawing.id)),
                              },
                            });
                            setDeletedFeature({ layerId: selection.record.id, feature: removed });
                            removeArea(`feature:${selection.record.id}:${String(selectedDrawing.id)}`);
                            await reload();
                          } catch (e) {
                            setNotice(
                              e instanceof Error ? e.message : "Delete failed",
                            );
                          }
                        }}
                        className="destructive"
                      >
                        Delete shape
                      </button>
                    </div>
                  ) : null}
                  {selection.record.layer_kind !== "radius" && !stableFeatureId(selectedDrawing.id) ? <p>This legacy feature does not have a supported stable ID and is view-only to protect its existing identity.</p> : null}
                  {selection.record.layer_kind === "radius" ? <p>Radius rings are view-only here; their source layer is preserved.</p> : null}
                </div>
              ) : null}
            </>
          ) : null}
          {!draft && !selectionDetails && catalogueLayers.selected ? <CatalogueFeatureInspector selection={catalogueLayers.selected} onClose={()=>catalogueLayers.setSelected(null)} /> : !draft && !selectionDetails && officialLayers.selected ? <OfficialMapLayers controller={officialLayers} showControls={false} /> : null}
          {!selectionDetails && hasMore ? (
            <button
              disabled={loadingMore || loadedPages.current >= 10}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "Loading…" : "Load more Workspace data"}
            </button>
          ) : null}
          {!draft && selectedAreas.length === 1 && <details className="secondary-terrain"><summary>Terrain estimates</summary><section aria-label="Parcel elevation"><h3>Parcel elevation</h3><button onClick={() => { const item = selectedAreas[0], m = map.current; const result = m && item.geometry && mapMode === "3d" && dem?.datumVerified ? parcelElevation(item.geometry, (p) => terrainElevation(m, p, terrainExaggeration)) : null; setParcelHeights(result); setParcelHeightMessage(result ? "" : !dem?.datumVerified ? "Parcel measurements unavailable: vertical datum consistency is unverified." : "Unavailable: enable 3D, fit the full parcel in view and wait for DEM tiles."); }}>Estimate parcel elevation</button>{parcelHeightMessage && <p>{parcelHeightMessage}</p>}{parcelHeights && <p>Sampled minimum {parcelHeights.min.toFixed(1)} m · maximum {parcelHeights.max.toFixed(1)} m · difference {parcelHeights.difference.toFixed(1)} m · average {parcelHeights.average.toFixed(1)} m ({parcelHeights.samples} samples). Approximate; not survey grade. Source: {dem?.attribution}. {terrainMetadata}</p>}</section></details>}
        </div>
        <footer className="inspector-footer">
          <span>PRIVATE WORKSPACE</span>
          <button onClick={() => void reload()}>Refresh ↻</button>
        </footer>
      </aside>
    </main>
  );
}
function DraftPhoto({ photo }: { photo: QueuePhoto }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(photo.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo.blob]);
  return (
    <figure>
      {url ? (
        <PhotoPreview
          key={url}
          url={url}
          filename={photo.input.original_filename}
          mime={photo.input.mime_type}
        />
      ) : null}
      <figcaption>
        {photo.status} · {photo.input.original_filename}
      </figcaption>
    </figure>
  );
}
function LayerFeatureBrowser({ scope, layer, onSelect, opacity, onOpacityChange }: { scope: string; layer: SpatialLayer; onSelect: (feature: Feature) => void; opacity: number; onOpacityChange: (value: number) => void }) {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, unknown>>(layer.metadata || {});
  useEffect(() => {
    if (!loaded) return;
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{scope: string; changes: MapChange[]}>).detail;
      if (detail?.scope !== scope) return;
      setFeatures(current => {
        const rows = new Map(current.map(feature => [String(feature.id), feature]));
        for (const change of detail.changes) {
          if (change.kind !== "features" || change.viewport_only) continue;
          if (change.operation === "delete") rows.delete(change.id);
          else {
            const row = change.row as {layer_id: string; feature: Feature} | undefined;
            if (row?.layer_id === layer.id && (rows.has(change.id) || !hasMore)) rows.set(change.id, row.feature);
          }
        }
        return [...rows.values()];
      });
    };
    window.addEventListener("landos:map-data-changed", changed);
    return () => window.removeEventListener("landos:map-data-changed", changed);
  }, [scope, layer.id, loaded, hasMore]);
  async function load() {
    if (busy) return;
    if (layer.layer_kind === "radius") {
      setFeatures([...mapLibreCollections({ ...emptyData, layers: [layer] }).workspace.index.values()].map((item) => item.feature));
      setHasMore(false); setLoaded(true); return;
    }
    setBusy(true); setError("");
    try {
      const offset = features.length;
      const response = await timeoutFetch(`/api/layers?id=${encodeURIComponent(layer.id)}&list=1&offset=${offset}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Layer features unavailable");
      setFeatures((current) => [...current, ...body.features]);
      if (body.layer?.metadata && typeof body.layer.metadata === "object") setMetadata(body.layer.metadata);
      setHasMore(Boolean(body.hasMore)); setLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Layer features unavailable"); }
    finally { setBusy(false); }
  }
  return <details className="drawer-layer-features" onToggle={(event) => { if (event.currentTarget.open && !loaded && !busy) void load(); }}><summary>{layer.name}</summary><label>Opacity <input aria-label={`${layer.name} opacity`} type="range" min="0" max="1" step="0.05" value={opacity} onChange={(event) => onOpacityChange(Number(event.target.value))} /></label><details><summary>Layer details</summary><p>Type: {layer.layer_kind}</p><dl>{Object.entries(metadata).slice(0, 10).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{(typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")).slice(0, 500)}</dd></div>)}</dl></details>{features.map((feature, index) => <button type="button" className="drawer-record" key={`${String(feature.id ?? "legacy")}:${index}`} onClick={() => onSelect(feature)}>{String(feature.properties?.name || feature.properties?.title || `Feature ${index + 1}`)}</button>)}{loaded && !features.length ? <p>No features in this layer.</p> : null}{error ? <p role="alert">{error}</p> : null}{!loaded || hasMore ? <button disabled={busy} onClick={() => void load()}>{busy ? "Loading…" : loaded ? "Load more features" : "Load features"}</button> : null}</details>;
}

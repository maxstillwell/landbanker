"use client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as exifr from "exifr";
import { browserClient } from "@/lib/supabase/browser";
import type { MapData, LocationFix, Observation } from "@/lib/types";
import {
  sendNative,
  subscribeNative,
  locationFromPayload,
} from "@/lib/native-bridge";
import {
  apiRequest,
  listDrafts,
  storeDraft,
  processDraft,
  type FieldDraft,
  type QueuePhoto,
} from "@/lib/field-queue";
import {
  readLayerDraft,
  writeLayerDraft,
  type LocalLayerDraft,
} from "@/lib/layer-draft";
import { geojsonFeatures } from "@/lib/map/geometry";
import { ParcelSearch } from "./parcel-search";
import type { MapSelection } from "@/lib/map/selection";
import type { OfficialParcel } from "@/lib/map/parcel-types";
import { WorkspaceSelector } from "./workspace-selector";
import { LayerLibrary } from "./layer-library";
import { createArcGisExportLayer } from "@/lib/map/arcgis-export-layer";
import type { CatalogLayer, ActiveLayer } from "@/lib/map/catalog-types";
import { ShapeDraft } from "./shape-draft";
import {
  drawingGeometry,
  editablePoints,
  type DrawingKind,
} from "@/lib/map/drawing";
import type { Feature } from "geojson";
import {
  formatArea,
  formatDistance,
  geometryMeasurement,
} from "@/lib/map/measurement";
const emptyData: MapData = {
  parcels: [],
  observations: [],
  layers: [],
  savedViews: [],
};
function centerFieldPoint(
  map: L.Map | null,
  latitude: number,
  longitude: number,
  zoom: number,
) {
  if (!map) return;
  const center = map.project([latitude, longitude], zoom);
  // Put the fix in the visible map above the iPhone sheet and action button.
  if (window.matchMedia("(max-width: 767px)").matches) {
    const sheet = map.getContainer().parentElement?.querySelector(".inspector");
    center.y += (sheet?.getBoundingClientRect().height || 0) / 2;
  }
  map.setView(map.unproject(center, zoom), zoom);
}
type Props = {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  role: string;
};
export default function MapWorkspace({
  userId,
  workspaceId,
  workspaceName,
  role,
}: Props) {
  const mapNode = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const features = useRef<L.FeatureGroup | null>(null);
  const gps = useRef<L.LayerGroup | null>(null);
  const watch = useRef<number | null>(null);
  const followRef = useRef(false);
  const locateRequested = useRef(false);
  const uploading = useRef(false);
  const importInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [catalog, setCatalog] = useState<CatalogLayer[]>([]);
  const [activeLayers, setActiveLayers] = useState<ActiveLayer[]>([]);
  const [data, setData] = useState<MapData>(emptyData);
  const [fix, setFix] = useState<LocationFix | null>(null);
  const [follow, setFollow] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<FieldDraft | null>(null);
  const draftRef = useRef<FieldDraft | null>(null);
  const [queue, setQueue] = useState<FieldDraft[]>([]);
  const [online, setOnline] = useState(true);
  const [sheet, setSheet] = useState<"collapsed" | "medium" | "expanded">(
    "medium",
  );
  const [tab, setTab] = useState<"observations" | "layers" | "parcels">(
    "observations",
  );
  const [selection, setSelection] = useState<MapSelection>(null);
  const selected = selection?.kind === "observation" ? selection.record : null;
  const selectedParcel = selection?.kind === "parcel" ? selection.record : null;
  const officialParcel =
    selection?.kind === "official-parcel" ? selection.record : null;
  function setSelected(record: Observation | null) {
    setSelection(record ? { kind: "observation", record } : null);
  }
  function selectOfficialParcel(record: OfficialParcel) {
    setSelection({ kind: "official-parcel", record });
    setTab("parcels");
    setSheet("medium");
    if (map.current) {
      const boundary = L.geoJSON(record.geometry);
      map.current.fitBounds(boundary.getBounds(), {
        padding: [30, 30],
        maxZoom: 18,
      });
    }
  }
  const [localLayer, setLocalLayer] = useState<LocalLayerDraft | null>(null);
  const updateLocalLayer = useCallback(
    async (value: LocalLayerDraft | null) => {
      setLocalLayer(value);
      try {
        await writeLayerDraft(userId, workspaceId, value);
      } catch {
        setNotice(
          "Unable to preserve layer draft. Keep this screen open until saved to Workspace.",
        );
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
  const [drawMode, setDrawMode] = useState(false);
  const [drawPoints, setDrawPoints] = useState<L.LatLng[]>([]);
  const drawing = useRef(false);
  const drawKind = useRef<DrawingKind>("Polygon");
  const [kind, setKind] = useState<DrawingKind>("Polygon");
  const [toolsOpen, setToolsOpen] = useState(false);
  const editFeature = useRef<Feature | null>(null);
  const editingLayerId = useRef<string | undefined>(undefined);
  const drawingVertices = useRef<L.LayerGroup | null>(null);
  const polygonDraft = useRef<L.Polyline | null>(null);
  const canWrite = ["owner", "admin", "editor"].includes(role);
  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/map", { cache: "no-store" });
      if (!r.ok)
        throw new Error(
          "Session or connection unavailable. Your device drafts are safe.",
        );
      setData(await r.json());
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to refresh");
    }
  }, []);
  const reloadLibrary = useCallback(async () => {
    try {
      const response = await fetch("/api/layer-library", { cache: "no-store" });
      if (!response.ok) throw new Error("Layer Library unavailable");
      const result = await response.json();
      setCatalog(result.catalog);
      setActiveLayers(result.active);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Layer Library unavailable");
    }
  }, []);
  useEffect(() => {
    void reloadLibrary();
  }, [reloadLibrary]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const layers: L.TileLayer[] = [];
    for (const item of activeLayers) {
      const source = catalog.find((l) => l.id === item.catalog_id && l.enabled);
      if (!source || !item.visible) continue;
      const layer =
        source.renderer === "arcgis_export"
          ? createArcGisExportLayer(
              source.service_url,
              source.layer_ids || "0",
              {
                minZoom: source.min_zoom,
                opacity: Number(item.opacity),
                attribution: source.attribution,
                zIndex: 200 + item.position,
                referrerPolicy: "strict-origin-when-cross-origin",
              },
            )
          : L.tileLayer(source.service_url, {
              attribution: source.attribution,
              opacity: Number(item.opacity),
              zIndex: 200 + item.position,
            });
      layer.on("tileerror", () =>
        setNotice(
          `${source.name}: source unavailable or outside coverage. Try again later.`,
        ),
      );
      layer.addTo(m);
      layers.push(layer);
    }
    return () => layers.forEach((l) => l.remove());
  }, [catalog, activeLayers]);
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
  const updateLocation = useCallback((location: LocationFix) => {
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
  useEffect(() => {
    if (!mapNode.current) return;
    const m = L.map(mapNode.current, { zoomControl: false }).setView(
      [-37.5622, 143.8503],
      11,
    );
    map.current = m;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      referrerPolicy: "strict-origin-when-cross-origin",
    }).addTo(m);
    L.control.zoom({ position: "bottomleft" }).addTo(m);
    features.current = L.featureGroup().addTo(m);
    gps.current = L.layerGroup().addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => {
      if (drawing.current) {
        setDrawPoints((points) =>
          drawKind.current === "Point"
            ? [e.latlng]
            : drawKind.current === "Rectangle" && points.length >= 2
              ? [e.latlng]
              : [...points, e.latlng],
        );
        return;
      }
      const current = draftRef.current;
      if (current)
        void saveDraft({
          ...current,
          input: {
            ...current.input,
            latitude: e.latlng.lat,
            longitude: e.latlng.lng,
          },
          updatedAt: Date.now(),
        });
    });
    return () => {
      m.remove();
      map.current = null;
    };
  }, [saveDraft]);
  useEffect(() => {
    void reload();
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
      if (e.type === "nativeError")
        setNotice(String(e.payload.message || "Native action failed"));
      if (
        e.type === "locationPermissionChanged" &&
        e.payload.status === "denied"
      )
        setNotice(
          "Location access denied. Enable it in Settings or choose a map point.",
        );
      if (e.type === "networkStatusChanged")
        setOnline(e.payload.online === true);
      if (e.type === "appBecameActive") {
        void reload();
        void reloadQueue();
      }
      if (e.type === "photoSelected") {
        const base64 = e.payload.base64;
        const current = draftRef.current;
        if (current && typeof base64 === "string" && base64.length < 36e6) {
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
    const group = features.current;
    if (!group) return;
    group.clearLayers();
    for (const parcel of data.parcels) {
      if (parcel.geometry) {
        L.geoJSON(parcel.geometry, {
          style: { color: "#bed86a", weight: 2, fillOpacity: 0.12 },
        })
          .on("click", () => {
            setSelection({ kind: "parcel", record: parcel });
            setTab("parcels");
            setSheet("medium");
          })
          .addTo(group);
      }
      if (parcel.latitude !== null && parcel.longitude !== null) {
        const node = document.createElement("div");
        node.textContent = parcel.title;
        L.circleMarker([parcel.latitude, parcel.longitude], {
          radius: 5,
          color: "#b9d66a",
        })
          .bindTooltip(node)
          .addTo(group);
      }
    }
    for (const observation of data.observations) {
      const node = document.createElement("div");
      node.textContent = observation.title;
      L.circleMarker([observation.latitude, observation.longitude], {
        radius: 8,
        color: "#f5f1db",
        fillColor: "#e58e64",
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip(node)
        .on("click", () => {
          setSelected(observation);
          setSheet("expanded");
          setTab("observations");
        })
        .addTo(group);
    }
    for (const layer of data.layers) {
      try {
        if (layer.geojson)
          L.geoJSON(layer.geojson, {
            style: { color: "#86bccc", weight: 2, fillOpacity: 0.13 },
            pointToLayer: (_f, latlng) =>
              L.circleMarker(latlng, { radius: 7, color: "#86bccc" }),
            onEachFeature: (feature, shape) =>
              shape.on("click", (event) => {
                if (drawing.current) return;
                L.DomEvent.stopPropagation(event);
                setSelection({
                  kind: "drawing",
                  record: layer,
                  featureId: String(feature.id),
                });
                setTab("layers");
                setSheet("medium");
              }),
          }).addTo(group);
        else if (layer.layer_kind === "radius") {
          const centre = layer.layer_data.centre as number[];
          const rings = layer.layer_data.rings as {
            kilometres: number;
            colour: string;
          }[];
          if (centre && rings)
            rings.forEach((r) =>
              L.circle([centre[0], centre[1]], {
                radius: r.kilometres * 1000,
                color: r.colour,
                fillOpacity: 0.03,
              }).addTo(group),
            );
        }
      } catch {
        /* One invalid imported geometry must not hide other data. */
      }
    }
    if (localLayer)
      L.geoJSON(localLayer.geojson, {
        style: { color: "#ffa65a", dashArray: "6 4" },
      }).addTo(group);
    if (draft)
      L.circleMarker([draft.input.latitude, draft.input.longitude], {
        radius: 9,
        color: "#eab268",
        dashArray: "3",
      }).addTo(group);
  }, [data, draft, localLayer]);
  useEffect(() => {
    if (!map.current || !officialParcel) return;
    const layer = L.geoJSON(officialParcel.geometry, {
      style: { color: "#e3a049", weight: 3, fillOpacity: 0.15 },
    }).addTo(map.current);
    return () => {
      layer.remove();
    };
  }, [officialParcel]);
  useEffect(() => {
    const group = gps.current;
    if (!group || !fix) return;
    group.clearLayers();
    L.circle([fix.latitude, fix.longitude], {
      radius: fix.accuracy,
      color: "#4b91f1",
      fillOpacity: 0.14,
      weight: 1,
    }).addTo(group);
    L.circleMarker([fix.latitude, fix.longitude], {
      radius: 7,
      color: "white",
      weight: 3,
      fillColor: "#4b91f1",
      fillOpacity: 1,
    }).addTo(group);
  }, [fix]);
  useEffect(() => {
    polygonDraft.current?.remove();
    drawingVertices.current?.remove();
    const m = map.current;
    if (!m || !drawMode) return;
    const geometry = drawingGeometry(
      kind,
      drawPoints.map((p) => [p.lng, p.lat]),
    );
    if (geometry) {
      const group = L.geoJSON(geometry, {
        style: { color: "#ffa65a", dashArray: "5 4" },
        pointToLayer: (_f, p) =>
          L.circleMarker(p, { radius: 7, color: "#ffa65a" }),
      }).addTo(m);
      drawingVertices.current = group;
    }
    const vertices = L.layerGroup().addTo(m);
    drawPoints.forEach((point, index) =>
      L.marker(point, {
        draggable: true,
        icon: L.divIcon({
          className: "drawing-vertex",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      })
        .on("dragend", (event) => {
          const p = event.target.getLatLng();
          setDrawPoints((points) =>
            points.map((v, i) => (i === index ? p : v)),
          );
        })
        .addTo(vertices),
    );
    return () => {
      vertices.remove();
      drawingVertices.current?.remove();
    };
  }, [drawPoints, drawMode, kind]);
  useEffect(() => {
    const node = mapNode.current;
    if (!node) return;
    const observer = new ResizeObserver(() =>
      map.current?.invalidateSize({ pan: false }),
    );
    observer.observe(node);
    const timer = window.setTimeout(
      () => map.current?.invalidateSize({ pan: false }),
      250,
    );
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [sheet]);
  function locate(keepFollowing = false) {
    locateRequested.current = true;
    setFollow(keepFollowing);
    followRef.current = keepFollowing;
    if (
      sendNative(
        keepFollowing ? "startLocationFollow" : "requestCurrentLocation",
      )
    )
      return;
    if (!navigator.geolocation) {
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
    const failed = (e: GeolocationPositionError) => setNotice(e.message);
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
    followRef.current = false;
    setFollow(false);
    sendNative("stopLocationFollow");
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
  }
  function beginObservation() {
    if (draftRef.current) {
      setSheet("expanded");
      return;
    }
    const p = map.current?.getCenter();
    const id = crypto.randomUUID();
    void saveDraft({
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
    });
    setSelected(null);
    setSheet("expanded");
    setTab("observations");
    sendNative("hapticFeedback");
  }
  async function addPhotos(
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
      current = {
        ...current,
        photos: [...current.photos, photo],
        updatedAt: Date.now(),
      };
      await saveDraft(current);
    }
  }
  async function uploadDraft(item: FieldDraft) {
    if (uploading.current) return;
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
    if (!draft) return;
    if (!draft.input.title.trim()) {
      setNotice("Give this observation a title.");
      return;
    }
    const next = { ...draft, status: "pending" as const };
    await saveDraft(next);
    if (online) await uploadDraft(next);
    else setNotice("Pending · preserved on this device until you retry.");
  }
  async function importLayer(file: File) {
    try {
      if (file.size > 3e6) throw new Error("Import GeoJSON up to 3 MB.");
      const value = JSON.parse(await file.text());
      if (!geojsonFeatures(value))
        throw new Error("Use a GeoJSON FeatureCollection.");
      await updateLocalLayer({
        id: crypto.randomUUID(),
        name: file.name,
        geojson: value,
      });
      setNotice(
        "Local Draft · Only on this device. Save to Workspace to sync.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Import failed");
    }
  }
  function startDrawing(
    nextKind: DrawingKind,
    feature?: Feature,
    layerId?: string,
  ) {
    if (localLayer) {
      setNotice("Save or discard your existing local draft first.");
      return;
    }
    const points = feature ? editablePoints(feature.geometry) : [];
    if (!points) {
      setNotice(
        "Multipart shapes and shapes with holes can be viewed, but are not editable yet.",
      );
      return;
    }
    editFeature.current = feature || null;
    editingLayerId.current = layerId;
    drawKind.current = nextKind;
    setKind(nextKind);
    drawing.current = true;
    setDrawMode(true);
    setDrawPoints(points.map((p) => L.latLng(p[1], p[0])));
    setToolsOpen(false);
    setSelection(null);
    setTab("layers");
    setSheet("collapsed");
    setNotice("");
  }
  function finishDrawing() {
    const geometry = drawingGeometry(
      kind,
      drawPoints.map((p) => [p.lng, p.lat]),
    );
    if (!geometry) {
      setNotice("Add more points to complete this shape.");
      return;
    }
    const existing = editFeature.current;
    void updateLocalLayer({
      id: crypto.randomUUID(),
      name: "My analysis",
      targetLayerId: editingLayerId.current,
      geojson: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: existing?.id || crypto.randomUUID(),
            properties: existing?.properties || {
              name:
                kind === "Point"
                  ? "Field point"
                  : kind === "LineString"
                    ? "Field line"
                    : "Field area",
            },
            geometry,
          },
        ],
      },
    });
    drawing.current = false;
    setDrawMode(false);
    setDrawPoints([]);
    setSheet("expanded");
    setNotice("Local Draft · Only on this device. Save to Workspace to sync.");
  }
  async function saveShape() {
    if (!localLayer) return;
    try {
      const target = data.layers.find((l) => l.id === localLayer.targetLayerId);
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
      await updateLocalLayer(null);
      await reload();
      setSelection(null);
      setNotice("Shape saved to Workspace.");
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Save failed. Local draft preserved.",
      );
    }
  }
  const drawnGeometry = drawingGeometry(
    kind,
    drawPoints.map((p) => [p.lng, p.lat]),
  );
  const drawnMeasurement = drawnGeometry
    ? geometryMeasurement(drawnGeometry)
    : null;
  const selectedDrawing =
    selection?.kind === "drawing"
      ? selection.record.geojson?.features.find(
          (f) => String(f.id) === selection.featureId,
        )
      : null;
  return (
    <main className={`map-app sheet-${sheet}`}>
      <div
        ref={mapNode}
        className="map-canvas"
        aria-label="Land workspace map"
      />
      {drawMode ? (
        <div className="map-drawing-bar" aria-label="Drawing controls">
          <strong>
            {drawnMeasurement?.areaM2
              ? formatArea(drawnMeasurement.areaM2)
              : drawnMeasurement?.distanceM
                ? formatDistance(drawnMeasurement.distanceM)
                : `${drawPoints.length} points`}
          </strong>
          <button onClick={finishDrawing}>
            {kind === "Polygon" ? "Finish polygon" : "Finish shape"}
          </button>
          <button onClick={() => setDrawPoints((p) => p.slice(0, -1))}>
            Undo
          </button>
          <button
            onClick={() => {
              drawing.current = false;
              setDrawMode(false);
              setDrawPoints([]);
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}
      <header className="map-header">
        <Link href="/app/map" className="wordmark">
          LandOS
        </Link>
        <WorkspaceSelector name={workspaceName} />
        <Link
          className="icon-button"
          href="/app/settings"
          aria-label="Workspace settings"
        >
          ⚙
        </Link>
      </header>
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
      <div className="map-controls">
        <button onClick={() => locate()} aria-label="Locate Me">
          Locate
        </button>
        <button
          className={follow ? "active" : ""}
          onClick={() => (follow ? stopFollow() : locate(true))}
          aria-label={follow ? "Stop following" : "Follow Me"}
        >
          {follow ? "Following" : "Follow"}
        </button>
      </div>
      {fix ? (
        <div className="accuracy">
          Accuracy ±{Math.round(fix.accuracy)} m{follow ? " · Following" : ""}
        </div>
      ) : null}
      <div className="field-action">
        {canWrite ? (
          !drawMode ? (
            <button className="primary" onClick={beginObservation}>
              ＋ Add observation
            </button>
          ) : null
        ) : (
          <span>Read-only workspace</span>
        )}
      </div>
      {notice ? (
        <div className="map-notice" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      ) : null}
      <aside className={`inspector ${sheet}`}>
        <div className="sheet-handle">
          <button
            onClick={() =>
              setSheet(
                sheet === "collapsed"
                  ? "medium"
                  : sheet === "medium"
                    ? "expanded"
                    : "collapsed",
              )
            }
            aria-label="Resize inspector"
            title={`Sheet: ${sheet === "collapsed" ? "peek" : sheet === "medium" ? "half" : "full"}`}
          >
            <span />
          </button>
        </div>
        <div className="inspector-heading">
          <div>
            <h2>
              {drawMode
                ? "Edit shape"
                : draft
                  ? "New observation"
                  : selected
                    ? selected.title
                    : selectedParcel || officialParcel
                      ? "Property"
                      : tab === "layers"
                        ? "Layers"
                        : "Workspace"}
            </h2>
          </div>
          <button
            onClick={() => {
              setSelected(null);
              if (draft) {
                draftRef.current = null;
                setDraft(null);
              }
              setSheet("collapsed");
            }}
            aria-label="Close inspector"
          >
            ×
          </button>
        </div>
        <nav className="tabs">
          {(["observations", "parcels", "layers"] as const).map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => {
                setTab(t);
                setSelection(null);
                setSheet("medium");
              }}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="inspector-content">
          {draft ? (
            <section className="observation-form">
              <fieldset disabled={draft.status === "uploading"}>
                <p className="draft-label">LOCAL DRAFT · ONLY ON THIS DEVICE</p>
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
                      if (!sendNative("openCamera"))
                        cameraInput.current?.click();
                    }}
                  >
                    ◉ Take photo
                  </button>
                  <button
                    onClick={() => {
                      if (!sendNative("openPhotoLibrary"))
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
                <div className="photo-grid">
                  {draft.photos.map((p) => (
                    <DraftPhoto key={p.input.id} photo={p} />
                  ))}
                </div>
                <button
                  className="primary full"
                  disabled={draft.status === "uploading"}
                  onClick={() => void submitDraft()}
                >
                  {draft.status === "uploading"
                    ? "Uploading…"
                    : "Save to Workspace ↗"}
                </button>
              </fieldset>
            </section>
          ) : null}
          {!draft && selected ? (
            <section>
              <p>{selected.notes || "No field notes."}</p>
              <p className="coordinates">
                {new Date(selected.observed_at).toLocaleString()}
              </p>
              <div className="photo-grid">
                {selected.field_observation_media.map((m) => (
                  <figure key={m.id}>
                    {m.url ? (
                      <img src={m.url} alt={m.original_filename} />
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
          {!draft && !selected && tab === "observations" ? (
            <>
              <div className="section-label">
                FIELD OBSERVATIONS <span>{data.observations.length}</span>
              </div>
              {!data.observations.length ? (
                <div className="empty-state">
                  <span>⌁</span>
                  <h3>Start in the field.</h3>
                  <p>
                    Locate yourself, add a note and take a photo. Your
                    observations will appear here.
                  </p>
                </div>
              ) : (
                data.observations.map((o) => (
                  <button
                    className="record-row"
                    key={o.id}
                    onClick={() => {
                      setSelected(o);
                      setSheet("expanded");
                      map.current?.setView([o.latitude, o.longitude], 16);
                    }}
                  >
                    <span className="record-icon">⌁</span>
                    <span>
                      <strong>{o.title}</strong>
                      <small>
                        {new Date(o.observed_at).toLocaleDateString()} ·{" "}
                        {o.field_observation_media.length} photos
                      </small>
                    </span>
                    <em>↗</em>
                  </button>
                ))
              )}
            </>
          ) : null}
          {!draft && tab === "parcels" ? (
            <>
              <ParcelSearch
                onSelect={selectOfficialParcel}
                onAddress={(p) =>
                  map.current?.setView([p.latitude, p.longitude], 17)
                }
              />
              {officialParcel || selectedParcel ? (
                <section className="property-details">
                  <h3>
                    {officialParcel?.address ||
                      selectedParcel?.address ||
                      selectedParcel?.title ||
                      "Official parcel"}
                  </h3>
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
                      {formatArea(
                        officialParcel?.areaM2 ??
                          Number(selectedParcel?.hectares || 0) * 10000,
                      )}
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
                    <p>Saved to Workspace</p>
                  )}
                </section>
              ) : null}
              <div className="section-label">
                PARCEL REGISTER <span>{data.parcels.length}</span>
              </div>
              {data.parcels.length ? (
                data.parcels.map((p) => (
                  <button
                    className="record-row"
                    key={p.id}
                    onClick={() => {
                      setSelection({ kind: "parcel", record: p });
                      if (p.latitude !== null && p.longitude !== null)
                        map.current?.setView([p.latitude, p.longitude], 15);
                      setNotice(
                        `${p.title} · ${p.status}${p.notes ? " · " + p.notes : ""}`,
                      );
                    }}
                  >
                    <span className="record-icon">◇</span>
                    <span>
                      <strong>{p.title}</strong>
                      <small>{p.status}</small>
                    </span>
                  </button>
                ))
              ) : (
                <p className="empty-state">
                  Your imported or saved parcels will appear here.
                </p>
              )}
            </>
          ) : null}
          {!draft && tab === "layers" ? (
            <>
              <LayerLibrary
                catalog={catalog}
                active={activeLayers}
                onChange={changeOfficialLayer}
              />
              <div className="section-label">
                MY LAYERS <span>{data.layers.length}</span>
              </div>
              {data.layers.map((l) => (
                <details
                  className="saved-layer"
                  key={l.id}
                  open={
                    selection?.kind === "drawing" &&
                    selection.record.id === l.id
                  }
                >
                  <summary>
                    {l.name}
                    <small>Saved to Workspace</small>
                  </summary>
                  {l.geojson?.features.slice(0, 50).map((f, index) => (
                    <button
                      className="record-row"
                      key={String(f.id || index)}
                      onClick={() => {
                        setSelection({
                          kind: "drawing",
                          record: l,
                          featureId: String(f.id),
                        });
                        const bounds = L.geoJSON(f).getBounds();
                        if (bounds.isValid())
                          map.current?.fitBounds(bounds, {
                            maxZoom: 17,
                            padding: [30, 30],
                          });
                      }}
                    >
                      {String(
                        f.properties?.name ||
                          f.properties?.label ||
                          `Shape ${index + 1}`,
                      )}
                    </button>
                  ))}
                  {(l.geojson?.features.length || 0) > 50 ? (
                    <small>First 50 shapes shown.</small>
                  ) : null}
                </details>
              ))}
              {canWrite ? (
                <>
                  <div className="actions">
                    <button onClick={() => importInput.current?.click()}>
                      Import GeoJSON
                    </button>
                    <button onClick={() => setToolsOpen((v) => !v)}>
                      Draw
                    </button>
                  </div>
                  {toolsOpen ? (
                    <div className="drawing-tools">
                      {(
                        [
                          ["Point", "Add point"],
                          ["LineString", "Draw line"],
                          ["Polygon", "Draw polygon"],
                          ["Rectangle", "Draw rectangle"],
                        ] as [DrawingKind, string][]
                      ).map(([k, label]) => (
                        <button key={k} onClick={() => startDrawing(k)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {drawMode ? (
                    <div className="drawing-actions">
                      <strong>
                        {drawnMeasurement?.areaM2
                          ? formatArea(drawnMeasurement.areaM2)
                          : drawnMeasurement?.distanceM
                            ? formatDistance(drawnMeasurement.distanceM)
                            : `${drawPoints.length} points`}
                      </strong>
                      <button onClick={finishDrawing}>
                        {kind === "Polygon" ? "Finish polygon" : "Finish shape"}
                      </button>
                      <button
                        onClick={() => setDrawPoints((p) => p.slice(0, -1))}
                      >
                        Undo point
                      </button>
                      <button
                        onClick={() => {
                          drawing.current = false;
                          setDrawMode(false);
                          setDrawPoints([]);
                        }}
                      >
                        Cancel drawing
                      </button>
                    </div>
                  ) : null}
                  <input
                    ref={importInput}
                    type="file"
                    hidden
                    accept=".geojson,.json"
                    onChange={(e) => {
                      if (e.target.files?.[0])
                        void importLayer(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                  {localLayer ? (
                    <ShapeDraft
                      key={localLayer.id}
                      draft={localLayer}
                      layers={data.layers}
                      onChange={(value) => void updateLocalLayer(value)}
                      onSave={saveShape}
                      onDiscard={() => void updateLocalLayer(null)}
                    />
                  ) : null}
                </>
              ) : null}
              {selectedDrawing && selection?.kind === "drawing" ? (
                <div className="property-details">
                  <strong>
                    {String(selectedDrawing.properties?.name || "Shape")}
                  </strong>
                  <p>{String(selectedDrawing.properties?.note || "")}</p>
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
                  {canWrite ? (
                    <div className="actions">
                      <button
                        onClick={() =>
                          startDrawing(
                            selectedDrawing.geometry.type === "Point"
                              ? "Point"
                              : selectedDrawing.geometry.type === "LineString"
                                ? "LineString"
                                : "Polygon",
                            selectedDrawing,
                            selection.record.id,
                          )
                        }
                      >
                        Edit shape
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await apiRequest("/api/layers", {
                              id: selection.record.id,
                              name: selection.record.name,
                              geojson: {
                                type: "FeatureCollection",
                                features:
                                  selection.record.geojson?.features.filter(
                                    (f) => f.id !== selectedDrawing.id,
                                  ),
                              },
                            });
                            setSelection(null);
                            await reload();
                          } catch (e) {
                            setNotice(
                              e instanceof Error ? e.message : "Delete failed",
                            );
                          }
                        }}
                      >
                        Delete shape
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="section-label">SAVED VIEWS</div>
              {data.savedViews.map((v) => (
                <button
                  className="record-row"
                  key={v.id}
                  onClick={() =>
                    map.current?.setView(
                      [Number(v.view.latitude), Number(v.view.longitude)],
                      Number(v.view.zoom),
                    )
                  }
                >
                  {v.name}
                </button>
              ))}
              {canWrite ? (
                <button
                  onClick={async () => {
                    const m = map.current;
                    if (!m) return;
                    const name = prompt("Name this map view");
                    if (!name) return;
                    try {
                      await apiRequest("/api/views", {
                        id: crypto.randomUUID(),
                        name,
                        view: {
                          latitude: m.getCenter().lat,
                          longitude: m.getCenter().lng,
                          zoom: m.getZoom(),
                        },
                      });
                      await reload();
                    } catch (e) {
                      setNotice(
                        e instanceof Error ? e.message : "Unable to save view",
                      );
                    }
                  }}
                >
                  Save current map view
                </button>
              ) : null}
            </>
          ) : null}
          {queue.length ? (
            <section className="queue">
              <div className="section-label">
                ON THIS DEVICE <span>{queue.length}</span>
              </div>
              {queue.map((d) => (
                <div key={d.id} className="queue-row">
                  <div>
                    <strong>{d.input.title || "Untitled observation"}</strong>
                    <small>
                      {d.status} · {d.photos.length} photos
                    </small>
                    {d.error ? <p>{d.error}</p> : null}
                  </div>
                  {d.status === "draft" ? (
                    <button
                      onClick={() => {
                        draftRef.current = d;
                        setDraft(d);
                        setSheet("expanded");
                      }}
                    >
                      Resume
                    </button>
                  ) : (
                    <button
                      disabled={!online || uploading.current}
                      onClick={() => void uploadDraft(d)}
                    >
                      Retry
                    </button>
                  )}
                </div>
              ))}
            </section>
          ) : null}
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
      {url ? <img src={url} alt={photo.input.original_filename} /> : null}
      <figcaption>
        {photo.status} · {photo.input.original_filename}
      </figcaption>
    </figure>
  );
}

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
  const [selected, setSelected] = useState<Observation | null>(null);
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
        setDrawPoints((points) => [...points, e.latlng]);
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
        }).addTo(group);
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
    if (map.current && drawPoints.length)
      polygonDraft.current = L.polyline(drawPoints, {
        color: "#ffa65a",
        dashArray: "5 4",
      }).addTo(map.current);
    return () => {
      polygonDraft.current?.remove();
    };
  }, [drawPoints]);
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
  function finishDrawing() {
    if (drawPoints.length < 3) {
      setNotice("Choose at least three points.");
      return;
    }
    void updateLocalLayer({
      id: crypto.randomUUID(),
      name: "Field polygon",
      geojson: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Field polygon" },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  ...drawPoints.map((p) => [p.lng, p.lat]),
                  [drawPoints[0].lng, drawPoints[0].lat],
                ],
              ],
            },
          },
        ],
      },
    });
    drawing.current = false;
    setDrawMode(false);
    setDrawPoints([]);
    setNotice("Local Draft · Only on this device. Save to Workspace to sync.");
  }
  return (
    <main className={`map-app sheet-${sheet}`}>
      <div
        ref={mapNode}
        className="map-canvas"
        aria-label="Land workspace map"
      />
      <header className="map-header">
        <Link href="/app/map" className="wordmark">
          LAND BANKER <span>FIELD INTELLIGENCE</span>
        </Link>
        <div className="workspace-pill">● {workspaceName}</div>
        <Link
          className="icon-button"
          href="/app/settings"
          aria-label="Workspace settings"
        >
          ⚙
        </Link>
      </header>
      <div className="map-topline">
        <span className={online ? "status-online" : "status-offline"}>
          {online ? "CONNECTED" : "WEAK / NO CONNECTION"}
        </span>
        <span>
          {data.parcels.length} parcels · {data.observations.length}{" "}
          observations
        </span>
      </div>
      <div className="map-controls">
        <button onClick={() => locate()} aria-label="Locate Me">
          ◎
        </button>
        <button
          className={follow ? "active" : ""}
          onClick={() => (follow ? stopFollow() : locate(true))}
          aria-label={follow ? "Stop following" : "Follow Me"}
        >
          ↟
        </button>
      </div>
      {fix ? (
        <div className="accuracy">
          Accuracy ±{Math.round(fix.accuracy)} m{follow ? " · Following" : ""}
        </div>
      ) : null}
      <div className="field-action">
        {canWrite ? (
          <button className="primary" onClick={beginObservation}>
            ＋ Add observation
          </button>
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
          >
            <span />
          </button>
        </div>
        <div className="inspector-heading">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h2>
              {draft
                ? "Field observation"
                : selected
                  ? selected.title
                  : "Land intelligence"}
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
              <div className="section-label">
                PARCEL REGISTER <span>{data.parcels.length}</span>
              </div>
              {data.parcels.length ? (
                data.parcels.map((p) => (
                  <button
                    className="record-row"
                    key={p.id}
                    onClick={() => {
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
              <div className="section-label">
                SPATIAL LAYERS <span>{data.layers.length}</span>
              </div>
              {data.layers.map((l) => (
                <div className="record-row" key={l.id}>
                  <span className="record-icon">▱</span>
                  <span>
                    <strong>{l.name}</strong>
                    <small>Saved to Workspace</small>
                  </span>
                </div>
              ))}
              {canWrite ? (
                <>
                  <div className="actions">
                    <button onClick={() => importInput.current?.click()}>
                      Import GeoJSON
                    </button>
                    <button
                      onClick={() => {
                        drawing.current = !drawing.current;
                        setDrawMode(drawing.current);
                        setDrawPoints([]);
                        setNotice(
                          drawing.current
                            ? "Tap the map to draw your boundary."
                            : "",
                        );
                      }}
                    >
                      {drawMode ? "Cancel drawing" : "Draw polygon"}
                    </button>
                  </div>
                  {drawMode ? (
                    <button onClick={finishDrawing}>Finish polygon</button>
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
                    <div className="local-layer">
                      <strong>{localLayer.name}</strong>
                      <p>Local Draft · Only on this device</p>
                      <button
                        className="primary"
                        onClick={async () => {
                          try {
                            await apiRequest("/api/layers", localLayer);
                            await updateLocalLayer(null);
                            await reload();
                          } catch (e) {
                            setNotice(
                              e instanceof Error ? e.message : "Save failed",
                            );
                          }
                        }}
                      >
                        Save to Workspace
                      </button>
                    </div>
                  ) : null}
                </>
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

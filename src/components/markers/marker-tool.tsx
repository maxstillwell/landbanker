"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { Map, MapMouseEvent } from "maplibre-gl";
import {
  MapPinPlus,
  X,
  Search,
  LocateFixed,
  Pencil,
  Trash2,
  Copy,
  Move,
  Undo2,
} from "lucide-react";
import {
  MARKER_ICONS,
  MARKER_COLORS,
  type MarkerIconKey,
} from "@/lib/markers/catalog";
import {
  markerFields,
  markerInput,
  type MarkerInput,
  type WorkspaceMarker,
} from "@/lib/markers/model";
import { apiRequest } from "@/lib/field-queue";
import { timeoutFetch } from "@/lib/network";
import type { Parcel, SpatialLayer } from "@/lib/types";
import { markerIcons } from "./icons";
import { MARKER_LAYER, renderMarkers, removeMarkerLayers } from "./render";
import "./markers.css";
type Draft = { value: MarkerInput; original?: WorkspaceMarker };
type Phase = "library" | "placing" | "editor" | "move";
export type MarkerMapHandler = (event: MapMouseEvent) => boolean;
type Props = {
  map: RefObject<Map | null>;
  revision: number;
  userId: string;
  workspaceId: string;
  role: string;
  open: boolean;
  visible: boolean;
  mobile: boolean;
  host: HTMLElement | null;
  properties: Parcel[];
  research: SpatialLayer[];
  blocked: boolean;
  onRegister: (
    click: MarkerMapHandler | null,
    pause: (() => void) | null,
  ) => void;
  onClose: () => void;
  onMode: (mode: Phase | "closed") => void;
  onInteraction: (active: boolean) => void;
};
export function MarkerTool({
  map,
  revision,
  userId,
  workspaceId,
  role,
  open,
  visible,
  mobile,
  host,
  properties,
  research,
  blocked,
  onRegister,
  onClose,
  onMode,
  onInteraction,
}: Props) {
  const [phase, setPhase] = useState<Phase>("library"),
    [tab, setTab] = useState<"icons" | "saved">("icons"),
    [rows, setRows] = useState<WorkspaceMarker[]>([]),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [icon, setIcon] = useState<MarkerIconKey>("school"),
    [draft, setDraft] = useState<Draft | null>(null),
    [multiple, setMultiple] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [next, setNext] = useState<string | null>(null),
    [undo, setUndo] = useState<WorkspaceMarker | null>(null),
    [cancelled, setCancelled] = useState<Draft | null>(null),
    [hidden, setHidden] = useState<Set<string>>(new Set()),
    [loadedScope, setLoadedScope] = useState("");
  const phaseRef = useRef(phase),
    draftRef = useRef(draft),
    openRef = useRef(open),
    rowsRef = useRef(rows),
    blockedRef = useRef(blocked),
    visibleRef = useRef(visible),
    hiddenRef = useRef(hidden);
  phaseRef.current = phase;
  draftRef.current = draft;
  openRef.current = open;
  rowsRef.current = rows;
  blockedRef.current = blocked;
  visibleRef.current = visible;
  hiddenRef.current = hidden;
  const writable = ["owner", "admin", "editor"].includes(role),
    key = `landos:marker-draft:v1:${userId}:${workspaceId}`,
    viewKey = `landos:marker-hidden:v1:${userId}:${workspaceId}`;
  const clickAfter = useRef(0),
    moveOrigin = useRef<Draft | null>(null),
    pages = useRef(1),
    request = useRef<AbortController | null>(null);
  const transition = (value: Phase) => {
    phaseRef.current = value;
    setPhase(value);
    onMode(value);
  };
  const update = (value: Draft | null) => {
    draftRef.current = value;
    setDraft(value);
  };
  const load = useCallback(async (more = false) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      let cursor: string | null = null;
      const all: WorkspaceMarker[] = [];
      const count = Math.min(25, pages.current + (more ? 1 : 0));
      for (let i = 0; i < count; i++) {
        const response = await timeoutFetch(
          `/api/markers${cursor ? `?after=${cursor}` : ""}`,
          { signal: controller.signal },
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Markers unavailable.");
        all.push(...body.markers);
        cursor = body.next_cursor;
        if (!cursor) break;
      }
      if (controller.signal.aborted) return;
      pages.current = count;
      setRows(all);
      setNext(cursor);
    } catch (e) {
      if (!controller.signal.aborted)
        setMessage(
          e instanceof Error ? e.message : "Unable to load saved markers.",
        );
    }
  }, []);
  useEffect(() => {
    void load();
    const focus = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(focus, 20000);
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    return () => {
      clearInterval(timer);
      request.current?.abort();
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
    };
  }, [load, workspaceId]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved) {
        const value = markerInput.parse(saved.value);
        if (saved.original && saved.original.workspace_id !== workspaceId)
          throw new Error("Draft scope mismatch");
        setDraft({
          value,
          ...(saved.original ? { original: saved.original } : {}),
        });
      }
      const ids = JSON.parse(localStorage.getItem(viewKey) || "[]");
      if (Array.isArray(ids))
        setHidden(new Set(ids.filter((x) => typeof x === "string")));
      setLoadedScope(key);
    } catch {
      setMessage(
        "An older device marker draft needs recovery. It has not been deleted.",
      );
    }
  }, [key, viewKey, workspaceId]);
  useEffect(() => {
    if (loadedScope !== key) return;
    try {
      if (draft) localStorage.setItem(key, JSON.stringify(draft));
      else localStorage.removeItem(key);
      localStorage.setItem(viewKey, JSON.stringify([...hidden]));
    } catch {
      setMessage(
        "Device storage unavailable. Keep this screen open until the marker is saved.",
      );
    }
  }, [draft, hidden, key, viewKey, loadedScope]);
  useEffect(() => {
    onInteraction(open && (phase === "placing" || phase === "move"));
    const m = map.current;
    if (m && open && (phase === "placing" || phase === "move"))
      m.getCanvas().style.cursor = "crosshair";
    return () => {
      if (m && open && (phase === "placing" || phase === "move"))
        m.getCanvas().style.cursor = "";
    };
  }, [open, phase, onInteraction, map]);
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (phaseRef.current === "placing" || phaseRef.current === "move") {
        if (phaseRef.current === "move" && moveOrigin.current)
          setDraft(moveOrigin.current);
        phaseRef.current = draftRef.current ? "editor" : "library";
        setPhase(phaseRef.current);
        onMode(phaseRef.current);
      } else onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open, onClose, onMode]);
  useEffect(() => {
    const m = map.current;
    if (!m || !revision) return;
    let current = true;
    const displayed = (
      visible
        ? rows.filter((r) => !hidden.has(r.id) && r.id !== draft?.value.id)
        : []
    ).map(markerFields);
    if (draft) displayed.push(draft.value);
    void renderMarkers(
      m,
      displayed,
      draft?.value.id || null,
      () => current && !!m.getStyle(),
    ).catch(() => {
      if (current)
        setMessage(
          "Some marker graphics are unavailable. Your saved data is preserved.",
        );
    });
    return () => {
      current = false;
    };
  }, [rows, draft, hidden, visible, revision, map]);
  useEffect(() => {
    const m = map.current;
    return () => {
      if (m?.getStyle()) removeMarkerLayers(m);
    };
  }, [map]);
  useEffect(() => {
    const pause = () => {
      phaseRef.current = "library";
      setPhase("library");
      onInteraction(false);
      onClose();
    };
    const handler: MarkerMapHandler = (event) => {
      if (blockedRef.current) return false;
      if (
        openRef.current &&
        (phaseRef.current === "placing" || phaseRef.current === "move")
      ) {
        if (performance.now() < clickAfter.current) return true;
        if (phaseRef.current === "move" && draftRef.current) {
          update({
            ...draftRef.current,
            value: {
              ...draftRef.current.value,
              latitude: event.lngLat.lat,
              longitude: event.lngLat.lng,
            },
          });
          transition("editor");
          return true;
        }
        if (draftRef.current) return true;
        const title = MARKER_ICONS.find((i) => i[0] === icon)![1];
        update({
          value: {
            id: crypto.randomUUID(),
            latitude: event.lngLat.lat,
            longitude: event.lngLat.lng,
            icon,
            name: title,
            description: "",
            color: "lime",
            size: "medium",
            show_label: false,
            status: "research_note",
            linked_property_id: null,
            linked_research_area_id: null,
          },
        });
        transition("editor");
        return true;
      }
      const m = map.current;
      if (!m?.getLayer(MARKER_LAYER) || !visibleRef.current) return false;
      const hits = m.queryRenderedFeatures(
        [
          [event.point.x - 10, event.point.y - 10],
          [event.point.x + 10, event.point.y + 10],
        ],
        { layers: [MARKER_LAYER] },
      );
      const hit = hits[0];
      if (!hit) return false;
      const row = rowsRef.current.find(
        (r) => r.id === hit.properties?.id && !hiddenRef.current.has(r.id),
      );
      if (!row) return false;
      if (draftRef.current) {
        setMessage(
          "Your unfinished marker is open. Save, cancel or pause it before editing another.",
        );
        transition("editor");
        return true;
      }
      update({ value: markerFields(row), original: row });
      transition("editor");
      return true;
    };
    onRegister(handler, pause);
    return () => onRegister(null, null);
  });
  function edit(row: WorkspaceMarker) {
    if (draft) {
      setMessage(
        "Resume or cancel the unfinished marker before editing another.",
      );
      transition("editor");
      return;
    }
    update({ value: markerFields(row), original: row });
    transition("editor");
  }
  function choose(key: MarkerIconKey, at: number) {
    if (draft) {
      setMessage(
        "Resume or cancel your unfinished marker before placing another.",
      );
      transition("editor");
      return;
    }
    setIcon(key);
    clickAfter.current = at + 200;
    transition("placing");
  }
  async function save() {
    if (!draft || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const body = await apiRequest(
        "/api/markers",
        {
          ...draft.value,
          ...(draft.original
            ? { expected_updated_at: draft.original.updated_at }
            : {}),
        },
        draft.original ? "PATCH" : "POST",
      );
      setRows((current) => [
        ...current.filter((r) => r.id !== body.marker.id),
        body.marker,
      ]);
      update(null);
      setCancelled(null);
      setMessage("Marker saved to Workspace.");
      if (!openRef.current) {
        phaseRef.current = "library";
        setPhase("library");
        return;
      }
      if (multiple) {
        setIcon(draft.value.icon);
        transition("placing");
      } else {
        setTab("saved");
        setQuery("");
        transition("library");
      }
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Save failed. Your device draft is preserved.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove(row: WorkspaceMarker) {
    if (
      busy ||
      !window.confirm(
        `Delete the marker “${row.name}”? It can be restored using Undo.`,
      )
    )
      return;
    setBusy(true);
    try {
      const body = await apiRequest(
        "/api/markers",
        { id: row.id, expected_updated_at: row.updated_at },
        "DELETE",
      );
      setUndo(body.marker);
      setRows((current) => current.filter((r) => r.id !== row.id));
      if (draft?.value.id === row.id) update(null);
      setTab("saved");
      setQuery("");
      if (openRef.current) transition("library");
      else {
        phaseRef.current = "library";
        setPhase("library");
      }
      setMessage("Marker deleted.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }
  function cancel() {
    if (!draft) return;
    if (
      !window.confirm(
        "Cancel these marker changes? The saved version will remain unchanged.",
      )
    )
      return;
    setCancelled(draft);
    update(null);
    transition("library");
  }
  function locate(row: MarkerInput) {
    map.current?.easeTo({
      center: [row.longitude, row.latitude],
      zoom: Math.max(map.current.getZoom(), 15),
      duration: 400,
    });
  }
  const categories = ["All", ...new Set(MARKER_ICONS.map((i) => i[2]))],
    currentIcon = draft ? markerIcons[draft.value.icon] : MapPinPlus;
  const Icon = currentIcon;
  const panel = (
    <section className="marker-panel" role="dialog" aria-label="Map Markers">
      <header>
        <div>
          <MapPinPlus size={20} />
          <strong>Map Markers</strong>
        </div>
        <button
          aria-label="Close markers"
          onClick={() => {
            phaseRef.current = "library";
            setPhase("library");
            onClose();
          }}
        >
          <X size={18} />
        </button>
      </header>
      <p className="marker-disclaimer">
        Manual research annotations · locations and status are user entered, not
        verified POIs.
      </p>
      {message && <p role="status">{message}</p>}
      {undo && (
        <div className="marker-recovery">
          Marker deleted
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const body = await apiRequest(
                  "/api/markers",
                  {
                    id: undo.id,
                    expected_updated_at: undo.updated_at,
                    restore: true,
                  },
                  "PATCH",
                );
                setRows((current) => [
                  ...current.filter((r) => r.id !== body.marker.id),
                  body.marker,
                ]);
                setUndo(null);
                setMessage("Marker restored.");
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Restore failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Undo2 size={14} />
            Undo delete
          </button>
        </div>
      )}
      {cancelled && !draft && (
        <div className="marker-recovery">
          Changes cancelled
          <button
            onClick={() => {
              update(cancelled);
              setCancelled(null);
              transition("editor");
            }}
          >
            Undo cancel
          </button>
        </div>
      )}
      {draft && phase === "editor" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset className="marker-editor-fields" disabled={busy}>
          <div
            className="marker-preview"
            style={{ background: MARKER_COLORS[draft.value.color] }}
          >
            <Icon size={24} />
          </div>
          <small>
            {draft.original
              ? "Editing saved marker · changes stay local until Save"
              : "Device draft · not cloud saved"}
          </small>
          <label>
            Marker Name
            <input
              required
              maxLength={160}
              value={draft.value.name}
              onChange={(e) =>
                update({
                  ...draft,
                  value: { ...draft.value, name: e.target.value },
                })
              }
            />
          </label>
          <div className="marker-fields">
            <label>
              Icon
              <select
                aria-label="Icon"
                value={draft.value.icon}
                onChange={(e) =>
                  update({
                    ...draft,
                    value: {
                      ...draft.value,
                      icon: e.target.value as MarkerIconKey,
                    },
                  })
                }
              >
                {MARKER_ICONS.map(([key, title]) => (
                  <option key={key} value={key}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Colour
              <select
                aria-label="Colour"
                value={draft.value.color}
                onChange={(e) =>
                  update({
                    ...draft,
                    value: {
                      ...draft.value,
                      color: e.target.value as MarkerInput["color"],
                    },
                  })
                }
              >
                {Object.keys(MARKER_COLORS).map((c) => (
                  <option key={c} value={c}>
                    {c === "lime"
                      ? "LandOS Lime"
                      : c === "neutral"
                        ? "White / Neutral"
                        : c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Size
              <select
                aria-label="Size"
                value={draft.value.size}
                onChange={(e) =>
                  update({
                    ...draft,
                    value: {
                      ...draft.value,
                      size: e.target.value as MarkerInput["size"],
                    },
                  })
                }
              >
                {["small", "medium", "large"].map((size) => (
                  <option key={size}>{size}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                aria-label="Status"
                value={draft.value.status}
                onChange={(e) =>
                  update({
                    ...draft,
                    value: {
                      ...draft.value,
                      status: e.target.value as MarkerInput["status"],
                    },
                  })
                }
              >
                <option value="existing">Existing</option>
                <option value="proposed">Proposed</option>
                <option value="planned">Planned</option>
                <option value="research_note">Research Note</option>
              </select>
            </label>
          </div>
          <label className="marker-check">
            <input
              type="checkbox"
              checked={draft.value.show_label}
              onChange={(e) =>
                update({
                  ...draft,
                  value: { ...draft.value, show_label: e.target.checked },
                })
              }
            />
            Show Label
          </label>
          <label>
            Description / Notes
            <textarea
              maxLength={2000}
              value={draft.value.description}
              onChange={(e) =>
                update({
                  ...draft,
                  value: { ...draft.value, description: e.target.value },
                })
              }
            />
          </label>
          <details>
            <summary>Optional relationships</summary>
            <label>
              Linked Property
              <select
                aria-label="Linked Property"
                value={draft.value.linked_property_id || ""}
                onChange={(e) =>
                  update({
                    ...draft,
                    value: {
                      ...draft.value,
                      linked_property_id: e.target.value || null,
                    },
                  })
                }
              >
                <option value="">Independent</option>
                {properties.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Linked Research Area
              <select
                aria-label="Linked Research Area"
                value={draft.value.linked_research_area_id || ""}
                onChange={(e) =>
                  update({
                    ...draft,
                    value: {
                      ...draft.value,
                      linked_research_area_id: e.target.value || null,
                    },
                  })
                }
              >
                <option value="">None</option>
                {research.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          </details>
          <small>
            Ground coordinate: {draft.value.latitude.toFixed(6)},{" "}
            {draft.value.longitude.toFixed(6)}. Marker size does not represent
            height.
          </small>
          <div className="marker-actions">
            <button
              className="primary"
              type="submit"
              disabled={!writable || busy || !draft.value.name.trim()}
            >
              {busy ? "Saving…" : "Save marker"}
            </button>
            <button type="button" disabled={busy} onClick={cancel}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!writable || busy}
              onClick={() => {
                moveOrigin.current = draft;
                clickAfter.current = performance.now() + 200;
                transition("move");
              }}
            >
              <Move size={15} />
              Move
            </button>
            <button
              type="button"
              disabled={!writable || busy}
              onClick={() => {
                update({
                  value: {
                    ...draft.value,
                    id: crypto.randomUUID(),
                    name: `${draft.value.name} copy`.slice(0, 160),
                  },
                });
                setMessage("Duplicate is a new device draft. Save to keep it.");
              }}
            >
              <Copy size={15} />
              Duplicate
            </button>
          </div>
          {draft.original && writable && (
            <button
              className="destructive"
              type="button"
              disabled={busy}
              onClick={() => void remove(draft.original!)}
            >
              <Trash2 size={15} />
              Delete marker
            </button>
          )}
          </fieldset>
        </form>
      ) : (
        <>
          <nav aria-label="Marker views">
            <button
              aria-pressed={tab === "icons"}
              onClick={() => {
                setQuery("");
                setTab("icons");
              }}
            >
              Icon Library
            </button>
            <button
              aria-pressed={tab === "saved"}
              onClick={() => {
                setQuery("");
                setTab("saved");
              }}
            >
              My Markers ({rows.length})
            </button>
          </nav>
          {draft && (
            <button onClick={() => transition("editor")}>
              Resume unfinished marker: {draft.value.name}
            </button>
          )}
          <label className="marker-search">
            <Search size={16} />
            <input
              aria-label={
                tab === "icons" ? "Search icons" : "Search saved markers"
              }
              placeholder={
                tab === "icons" ? "Search icons" : "Search saved markers"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {tab === "icons" ? (
            <>
              <label>
                Category
                <select
                  aria-label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="marker-check">
                <input
                  type="checkbox"
                  checked={multiple}
                  onChange={(e) => setMultiple(e.target.checked)}
                />
                Place Multiple
              </label>
              <div className="marker-icon-grid">
                {MARKER_ICONS.filter(
                  ([, title, group]) =>
                    (category === "All" || category === group) &&
                    title.toLowerCase().includes(query.toLowerCase()),
                ).map(([key, title]) => {
                  const Glyph = markerIcons[key];
                  return (
                    <button
                      key={key}
                      aria-label={title}
                      aria-pressed={icon === key}
                      disabled={
                        !writable ||
                        blocked ||
                        busy ||
                        loadedScope !==
                          `landos:marker-draft:v1:${userId}:${workspaceId}`
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        choose(key, e.timeStamp);
                      }}
                    >
                      <Glyph size={22} />
                      <span>{title}</span>
                    </button>
                  );
                })}
              </div>
              {!writable && (
                <p>Read-only Workspace. Saved markers can be viewed.</p>
              )}
            </>
          ) : (
            <div className="marker-list">
              {rows
                .filter((row) =>
                  `${row.name} ${MARKER_ICONS.find((i) => i[0] === row.icon)?.[1]}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((row) => {
                  const Glyph = markerIcons[row.icon];
                  return (
                    <article key={row.id}>
                      <span
                        className="marker-row-icon"
                        style={{ background: MARKER_COLORS[row.color] }}
                      >
                        <Glyph size={20} />
                      </span>
                      <div>
                        <strong>{row.name}</strong>
                        <small>
                          {MARKER_ICONS.find((i) => i[0] === row.icon)?.[2]}
                          {row.linked_property_id ? " · Linked Property" : ""}
                          {row.linked_research_area_id
                            ? " · Linked Research Area"
                            : ""}
                        </small>
                        <div className="marker-actions">
                          <button
                            aria-label={`Locate ${row.name}`}
                            onClick={() => locate(row)}
                          >
                            <LocateFixed size={15} />
                          </button>
                          <button
                            aria-label={`Edit ${row.name}`}
                            onClick={() => edit(row)}
                          >
                            <Pencil size={15} />
                          </button>
                          {writable && (
                            <button
                              aria-label={`Delete ${row.name}`}
                              onClick={() => void remove(row)}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                          <label className="marker-check">
                            <input
                              type="checkbox"
                              checked={!hidden.has(row.id)}
                              onChange={(e) =>
                                setHidden((current) => {
                                  const next = new Set(current);
                                  if (e.target.checked) next.delete(row.id);
                                  else next.add(row.id);
                                  return next;
                                })
                              }
                            />
                            Show
                          </label>
                        </div>
                      </div>
                    </article>
                  );
                })}
              {!rows.length && <p>No saved markers yet.</p>}
              {next && (
                <button onClick={() => void load(true)}>
                  Load more markers
                </button>
              )}
              <button onClick={() => void load()}>Refresh markers</button>
            </div>
          )}
        </>
      )}
    </section>
  );
  if (!open) return null;
  if (phase === "placing" || phase === "move")
    return (
      <div className="map-drawing-bar marker-placement" role="status">
        {phase === "move"
          ? "Tap the new marker location, then Save to confirm."
          : `Tap the map to place ${MARKER_ICONS.find((i) => i[0] === icon)![1]}. Pan normally; dragging does not place a marker.`}
        <button
          onClick={() => {
            if (phase === "move" && moveOrigin.current)
              update(moveOrigin.current);
            transition(draft ? "editor" : "library");
          }}
        >
          Cancel {phase === "move" ? "move" : "placement"}
        </button>
      </div>
    );
  return mobile ? (host ? createPortal(panel, host) : null) : panel;
}

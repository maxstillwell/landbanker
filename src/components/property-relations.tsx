"use client";
import { useEffect, useState } from "react";
import type { Observation } from "@/lib/types";
type Result = {
  observations?: Observation[];
  linked?: { id: string; name: string }[];
  intersects?: { id: string; name: string }[];
  views?: { id: string; name: string }[];
  next_cursor?: string | null;
  has_more: boolean;
  spatial_supported: boolean;
};
export function PropertyRelations({
  propertyId,
  section,
  onObservation,
  onAddField,
}: {
  propertyId: string;
  section: "Field" | "My Analysis";
  onObservation: (o: Observation) => void;
  onAddField?: () => void;
}) {
  const [mode, setMode] = useState<"linked" | "nearby" | "analysis">(
    section === "Field" ? "linked" : "analysis",
  );
  const [page, setPage] = useState(0),
    [cursor, setCursor] = useState<string | null>(null),
    [data, setData] = useState<Result | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ mode, page: String(page) });
    if (cursor) query.set("cursor", cursor);
    fetch(`/api/properties/${propertyId}/relations?${query}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error();
        return body as Result;
      })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Property relationships temporarily unavailable.");
      });
    return () => controller.abort();
  }, [propertyId, mode, page, cursor]);
  return (
    <section aria-label="Property relationships">
      {section === "Field" ? (
        <nav aria-label="Property Field filter">
          {(["linked", "nearby"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setPage(0);
                setCursor(null);
                setData(null);
                setError("");
              }}
            >
              {value === "linked" ? "Only this Property" : "Nearby"}
            </button>
          ))}
        </nav>
      ) : null}
      {mode === "nearby" ? (
        <p>
          Workspace observations within approximately 500 m of the boundary.
          Proximity is not a saved relationship.
        </p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {!data && !error ? (
        <p role="status">Loading property relationships…</p>
      ) : null}
      {data?.observations?.map((o) => (
        <button
          key={o.id}
          className="record-row"
          onClick={() => onObservation(o)}
        >
          {o.title} · {o.field_observation_media.length} photos
        </button>
      ))}
      {data?.observations?.length === 0 ? (
        <p>No observations returned on this page.</p>
      ) : null}
      {mode === "analysis" && data ? (
        <>
          <h3>Linked</h3>
          {data.linked?.map((f) => (
            <p key={f.id}>{f.name}</p>
          ))}
          {!data.linked?.length ? (
            <p>No explicitly linked features on this page.</p>
          ) : null}
          <h3>Spatially intersects</h3>
          {data.intersects?.map((f) => (
            <p key={f.id}>{f.name}</p>
          ))}
          {!data.intersects?.length ? (
            <p>No intersecting features returned on this page.</p>
          ) : null}
          <h3>Saved Views containing this Property</h3>
          {data.views?.map((v) => (
            <p key={v.id}>{v.name}</p>
          ))}
          {!data.views?.length ? (
            <p>No matching Saved Views on this page.</p>
          ) : null}
        </>
      ) : null}
      {data && !data.spatial_supported ? (
        <p>
          A valid property boundary is required for nearby/intersecting
          analysis.
        </p>
      ) : null}
      {data?.has_more ? (
        <button
          onClick={() => {
            setPage((p) => p + 1);
            setCursor(data.next_cursor || null);
            setData(null);
            setError("");
          }}
        >
          Next relationship page
        </button>
      ) : null}
      {section === "Field" && onAddField ? (
        <button onClick={onAddField}>Add property observation</button>
      ) : null}
    </section>
  );
}

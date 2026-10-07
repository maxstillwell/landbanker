"use client";
import { useEffect, useState } from "react";
import type { PropertyPlanning } from "@/lib/planning/types";
import { formatArea } from "@/lib/map/measurement";
export function PropertyPlanningInspector({
  propertyId,
}: {
  propertyId: string;
}) {
  const [data, setData] = useState<PropertyPlanning | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/properties/${propertyId}/planning`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const value = await r.json();
        if (!r.ok) throw new Error(value.error || "Planning query failed");
        return value as PropertyPlanning;
      })
      .then((value) => {
        if (!controller.signal.aborted) {
          setData(value);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(
            "Planning query failed. Your saved LandOS data is unaffected.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [propertyId, retry]);
  return (
    <section aria-label="Property planning results">
      <p>
        Controls queried against this property’s boundary, including all parts
        and holes. No returned result does not mean no restriction.
      </p>
      {loading ? (
        <p role="status">Querying official planning sources…</p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {data?.status === "unsupported_location" ? (
        <p>Planning intersection is not supported for this location.</p>
      ) : null}
      {data?.status === "geometry_unavailable" ? (
        <p>
          A valid saved polygon boundary is required for planning intersection.
        </p>
      ) : null}
      {data?.layers.map((layer) => (
        <article key={layer.catalog_layer_id} className="planning-source">
          <h3>{layer.name}</h3>
          <p>{layer.message}</p>
          {layer.controls.map((control) => (
            <div key={control.source_feature_id} className="planning-control">
              <strong>
                {control.control_type}: {control.control_name}
                {control.control_code ? ` (${control.control_code})` : ""}
              </strong>
              {control.value ? <p>{control.value}</p> : null}
              <p>
                {control.intersection_percent === null
                  ? "Intersects property"
                  : `${control.intersection_percent.toFixed(1)}% of property · ${formatArea(control.intersection_area_m2 || 0)}`}
              </p>
              <details>
                <summary>Control provenance</summary>
                <p>Source feature: {control.source_feature_id}</p>
                {Object.entries(control.source_metadata)
                  .filter(([, value]) => value !== null)
                  .map(([key, value]) => (
                    <p key={key}>
                      {key}: {String(value)}
                    </p>
                  ))}
              </details>
            </div>
          ))}
          <details>
            <summary>Official source and limitations</summary>
            <p>{layer.provider}</p>
            <p>{layer.attribution}</p>
            <a href={layer.source_url} target="_blank" rel="noreferrer">
              Official source
            </a>{" "}
            ·{" "}
            <a href={layer.endpoint} target="_blank" rel="noreferrer">
              Source layer service
            </a>
            <p>Retrieved {new Date(layer.queried_at).toLocaleString()}</p>
            <p>
              {layer.update_info ||
                "Update frequency not supplied by provider."}
            </p>
            <p>{layer.limitation}</p>
          </details>
        </article>
      ))}
      {!loading ? (
        <button
          onClick={() => {
            setLoading(true);
            setError("");
            setData(null);
            setRetry((value) => value + 1);
          }}
        >
          Refresh official controls
        </button>
      ) : null}
    </section>
  );
}

"use client";
import { useEffect, useState } from "react";
import type { SavedViewInput } from "@/lib/map/view-input";
import { timeoutFetch } from "@/lib/network";
type Scope = {
  parcels: number;
  user_layers: number;
  official_layers: number;
  features: number;
  feature_scope: string;
};
export function SavedViewPreview({
  view,
  onSave,
  onCancel,
}: {
  view: SavedViewInput["view"];
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [scope, setScope] = useState<Scope | null>(null),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    timeoutFetch("/api/views/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ view }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "View preview unavailable");
        return body as Scope;
      })
      .then((value) => {
        if (!controller.signal.aborted) setScope(value);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "View preview unavailable. Cancel and try again; no View has been saved.",
          );
      });
    return () => controller.abort();
  }, [view]);
  return (
    <section aria-label="Saved View preview" className="property-details">
      <h3>Review map view</h3>
      <p>
        Viewport centre {view.latitude.toFixed(5)}, {view.longitude.toFixed(5)}{" "}
        · Zoom {view.zoom.toFixed(1)}. Screen bounds may vary by device.
      </p>
      {!scope && !error ? (
        <p role="status">Checking selected Workspace resources…</p>
      ) : null}
      {scope ? (
        <>
          <dl>
            <dt>Saved properties</dt>
            <dd>{scope.parcels}</dd>
            <dt>User layers</dt>
            <dd>{scope.user_layers}</dd>
            <dt>Spatial features</dt>
            <dd>{scope.features}</dd>
            <dt>Official layer settings</dt>
            <dd>{scope.official_layers}</dd>
          </dl>
          <p>{scope.feature_scope}</p>
          <p>
            Private observations, notes and photos are not copied into this
            View. Your authenticated Workspace may still show them separately;
            public sharing excludes them.
          </p>
        </>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!scope || saving) return;
          setSaving(true);
          setError("");
          try {
            await onSave(name.trim());
          } catch {
            setError(
              "Could not save this View. Your preview is retained; retry when connected.",
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <label>
          View name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={1}
            maxLength={100}
            disabled={saving}
          />
        </label>
        <div className="actions">
          <button type="submit" disabled={!scope || saving}>
            {saving ? "Saving view…" : "Save reviewed view"}
          </button>
          <button type="button" disabled={saving} onClick={onCancel}>
            Cancel view preview
          </button>
        </div>
      </form>
    </section>
  );
}

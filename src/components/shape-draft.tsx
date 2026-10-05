"use client";
import type { LocalLayerDraft } from "@/lib/layer-draft";
import type { SpatialLayer } from "@/lib/types";
import {
  geometryMeasurement,
  formatArea,
  formatDistance,
} from "@/lib/map/measurement";
import { useState } from "react";
export function ShapeDraft({
  draft,
  layers,
  onChange,
  onSave,
  onDiscard,
}: {
  draft: LocalLayerDraft;
  layers: SpatialLayer[];
  onChange: (draft: LocalLayerDraft) => void;
  onSave: () => Promise<void>;
  onDiscard: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const first = draft.geojson.features[0];
  const measurement = first ? geometryMeasurement(first.geometry) : null;
  function changeProperty(key: string, value: string) {
    onChange({
      ...draft,
      geojson: {
        ...draft.geojson,
        features: draft.geojson.features.map((f, i) =>
          i === 0 ? { ...f, properties: { ...f.properties, [key]: value } } : f,
        ),
      },
    });
  }
  return (
    <div className="local-layer">
      <p className="draft-label">Local Draft · Only on this device</p>
      {measurement?.areaM2 ? (
        <strong>{formatArea(measurement.areaM2)}</strong>
      ) : measurement?.distanceM ? (
        <strong>{formatDistance(measurement.distanceM)}</strong>
      ) : null}
      <label>
        Shape name
        <input
          value={String(first?.properties?.name || "")}
          onChange={(e) => changeProperty("name", e.target.value)}
          maxLength={160}
        />
      </label>
      <label>
        Note
        <textarea
          value={String(first?.properties?.note || "")}
          onChange={(e) => changeProperty("note", e.target.value)}
          maxLength={10000}
        />
      </label>
      <label>
        Layer
        <select
          value={draft.targetLayerId || ""}
          onChange={(e) =>
            onChange({ ...draft, targetLayerId: e.target.value || undefined })
          }
        >
          <option value="">New layer</option>
          {layers
            .filter((l) => l.geojson)
            .map((l) => (
              <option value={l.id} key={l.id}>
                {l.name}
              </option>
            ))}
        </select>
      </label>
      {!draft.targetLayerId ? (
        <label>
          New layer name
          <input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            maxLength={160}
          />
        </label>
      ) : null}
      <div className="actions">
        <button
          className="primary"
          disabled={
            saving ||
            !String(first?.properties?.name || "").trim() ||
            (!draft.targetLayerId && !draft.name.trim())
          }
          onClick={async () => {
            setSaving(true);
            try {
              await onSave();
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save to Workspace"}
        </button>
        <button disabled={saving} onClick={onDiscard}>
          Discard draft
        </button>
      </div>
    </div>
  );
}

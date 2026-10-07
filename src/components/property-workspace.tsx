"use client";
import { useState } from "react";
import type { Parcel, Observation, SpatialLayer } from "@/lib/types";
import type { CatalogLayer, ActiveLayer } from "@/lib/map/catalog-types";
export function PropertyWorkspace({
  parcel,
  observations,
  layers,
  catalog,
  active,
  onObservation,
  onAddField,
}: {
  parcel: Parcel;
  observations: Observation[];
  layers: SpatialLayer[];
  catalog: CatalogLayer[];
  active: ActiveLayer[];
  onObservation: (observation: Observation) => void;
  onAddField?: () => void;
}) {
  const [section, setSection] = useState("Overview");
  const references = active
    .filter((a) => a.visible)
    .map((a) => catalog.find((l) => l.id === a.catalog_id))
    .filter((l): l is CatalogLayer => Boolean(l && l.state === parcel.state));
  const field = observations.filter((o) => o.linked_parcel_id === parcel.id);
  const analysis = layers.flatMap((l) =>
    (l.geojson?.features || [])
      .filter((f) => f.properties?.parcel_id === parcel.id)
      .map((f) => ({ layer: l.name, feature: f })),
  );
  return (
    <div className="property-workspace">
      <nav className="property-sections" aria-label="Property sections">
        {["Overview", "Planning", "Layers", "Field", "My Analysis"].map(
          (name) => (
            <button
              key={name}
              aria-pressed={section === name}
              onClick={() => setSection(name)}
            >
              {name}
            </button>
          ),
        )}
      </nav>
      {section === "Overview" ? (
        <p>
          {parcel.notes ||
            "Property overview and official provenance are shown above."}
        </p>
      ) : null}
      {section === "Planning" ? (
        <div>
          <p>Property-specific planning controls have not been queried yet.</p>
          <ul>
            {references
              .filter((l) => l.category.toLowerCase() === "planning")
              .map((l) => (
                <li key={l.id}>
                  {l.name} · {l.provider}
                </li>
              ))}
          </ul>
          <small>
            Active planning reference layers for {parcel.state || "this state"};
            coverage is described in the Layer Library.
          </small>
        </div>
      ) : null}
      {section === "Layers" ? (
        <div>
          <strong>
            Active reference layers for {parcel.state || "this state"}
          </strong>
          <ul>
            {references.map((l) => (
              <li key={l.id}>{l.name}</li>
            ))}
          </ul>
          {!references.length ? (
            <p>No active reference layers for this state.</p>
          ) : null}
        </div>
      ) : null}
      {section === "Field" ? (
        <div>
          <small>Linked observations in loaded Workspace records</small>
          {field.map((o) => (
            <button
              key={o.id}
              className="record-row"
              onClick={() => onObservation(o)}
            >
              {o.title} · {o.field_observation_media.length} photos
            </button>
          ))}
          {!field.length ? (
            <p>No linked observations in the loaded records.</p>
          ) : null}
          {onAddField ? (
            <button onClick={onAddField}>Add property observation</button>
          ) : null}
        </div>
      ) : null}
      {section === "My Analysis" ? (
        <div>
          {analysis.map(({ layer, feature }) => (
            <p key={String(feature.id)}>
              {String(feature.properties?.name || "Shape")} · {layer}
            </p>
          ))}
          {!analysis.length ? (
            <p>
              No property-linked analysis in the loaded records. Workspace
              drawings and Saved Views remain available in Layers.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

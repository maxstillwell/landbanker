"use client";
import { useState } from "react";
import type { Parcel, Observation } from "@/lib/types";
import type { CatalogLayer, ActiveLayer } from "@/lib/map/catalog-types";
import { PropertyPlanningInspector } from "./property-planning";
import { PropertyRelations } from "./property-relations";
export function PropertyWorkspace({
  parcel,
  catalog,
  active,
  onObservation,
  onAddField,
}: {
  parcel: Parcel;
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
        <div>
          <dl>
            <dt>Address</dt>
            <dd>{parcel.address || parcel.title}</dd>
            <dt>State</dt>
            <dd>{parcel.state || "Not supplied"}</dd>
            <dt>Official parcel ID</dt>
            <dd>{parcel.source_parcel_id || "Not supplied"}</dd>
            <dt>Lot / Plan</dt>
            <dd>
              {[parcel.lot, parcel.plan].filter(Boolean).join(" / ") ||
                "Not supplied"}
            </dd>
            <dt>Centroid (longitude, latitude)</dt>
            <dd>
              {parcel.centroid?.map((v) => v.toFixed(6)).join(", ") ||
                "Boundary centroid unavailable"}
            </dd>
            <dt>Saved</dt>
            <dd>
              {parcel.saved_at
                ? new Date(parcel.saved_at).toLocaleDateString()
                : "Not supplied"}
            </dd>
            <dt>Source</dt>
            <dd>{parcel.source || "Not supplied"}</dd>
          </dl>
          <small>
            Geometric centroid may lie outside a concave property; it is
            separate from GPS/Field position. Geometry parts are not assumed to
            be separate cadastral lots.
          </small>
          {parcel.notes ? <p>{parcel.notes}</p> : null}
        </div>
      ) : null}
      {section === "Planning" ? (
        <PropertyPlanningInspector propertyId={parcel.id} />
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
      {section === "Field" || section === "My Analysis" ? (
        <PropertyRelations
          key={section}
          propertyId={parcel.id}
          section={section}
          onObservation={onObservation}
          onAddField={onAddField}
        />
      ) : null}
    </div>
  );
}

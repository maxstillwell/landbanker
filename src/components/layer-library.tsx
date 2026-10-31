"use client";
import { useState } from "react";
import type { CatalogLayer, ActiveLayer } from "@/lib/map/catalog-types";
import { LayerLegend } from "./layer-legend";
import { CATALOGUE_CATEGORIES, catalogueCategory } from "@/lib/layers/types";
import { StatisticalLegend, type LayerOptions } from "./catalogue-map-layers";
export function LayerLibrary({
  catalog,
  active,
  onChange,
  onReorder,
  options = {},
  onOptionsChange,
  status = {},
}: {
  catalog: CatalogLayer[];
  active: ActiveLayer[];
  onChange: (item: ActiveLayer, remove?: boolean) => Promise<void>;
  onReorder: (ids: string[]) => Promise<void>;
  options?: LayerOptions;
  onOptionsChange?: (
    id: string,
    value: { period: string; indicator: string },
  ) => void;
  status?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [state, setState] = useState("All"),
    [busy, setBusy] = useState<string | null>(null);
  async function change(item: ActiveLayer, remove = false) {
    setBusy(item.catalog_id);
    try {
      await onChange(item, remove);
    } finally {
      setBusy(null);
    }
  }
  const activeIds = new Set(active.map((l) => l.catalog_id));
  const matches = catalog.filter(
    (l) =>
      !activeIds.has(l.id) &&
      (state === "All" || l.state === state || l.state === "AU") &&
      `${l.name} ${l.state} ${l.category} ${l.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="layer-library">
      <div role="tablist" aria-label="Layer library views">
        <button role="tab" aria-selected={!open} onClick={() => setOpen(false)}>
          Added to Map ({active.length})
        </button>
        <button role="tab" aria-selected={open} onClick={() => setOpen(true)}>
          Catalogue
        </button>
      </div>
      <div className="section-label">{open ? "CATALOGUE" : "ADDED TO MAP"}</div>
      {!open &&
        active.map((item, index) => {
          const layer = catalog.find((l) => l.id === item.catalog_id);
          if (!layer) return null;
          return (
            <div className="active-layer" key={item.catalog_id}>
              <label>
                <input
                  type="checkbox"
                  checked={item.visible}
                  disabled={busy === item.catalog_id}
                  onChange={(e) =>
                    void change({ ...item, visible: e.target.checked })
                  }
                />
                {layer.name}
              </label>
              <label>
                Opacity
                <input
                  aria-label={`${layer.name} opacity`}
                  key={`${item.catalog_id}:${item.opacity}`}
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  defaultValue={item.opacity}
                  onPointerUp={(e) =>
                    void change({
                      ...item,
                      opacity: Number(e.currentTarget.value),
                    })
                  }
                  onKeyUp={(e) =>
                    void change({
                      ...item,
                      opacity: Number(e.currentTarget.value),
                    })
                  }
                />
              </label>
              <small>
                {layer.provider} · {layer.state} · {layer.category} ·{" "}
                {layer.update_frequency || "Update frequency not supplied"}
              </small>
              {status[layer.id] ? (
                <p role="status">{status[layer.id]}</p>
              ) : null}
              {layer.dataset_metadata?.indicators ? (
                <>
                  <label>
                    Indicator
                    <select
                      aria-label={`${layer.name} indicator`}
                      value={
                        options[layer.id]?.indicator ||
                        layer.dataset_metadata.default_indicator
                      }
                      onChange={(e) =>
                        onOptionsChange?.(layer.id, {
                          period:
                            options[layer.id]?.period ||
                            layer.dataset_metadata!.default_period!,
                          indicator: e.target.value,
                        })
                      }
                    >
                      {layer.dataset_metadata.indicators.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Reference period
                    <select
                      aria-label={`${layer.name} ${layer.dataset_metadata.period_labels ? "period" : "year"}`}
                      value={
                        options[layer.id]?.period ||
                        layer.dataset_metadata.default_period
                      }
                      onChange={(e) =>
                        onOptionsChange?.(layer.id, {
                          period: e.target.value,
                          indicator:
                            options[layer.id]?.indicator ||
                            layer.dataset_metadata!.default_indicator!,
                        })
                      }
                    >
                      {layer.dataset_metadata.periods?.map((p) => (
                        <option key={p} value={p}>
                          {layer.dataset_metadata?.period_labels?.[p] || p}
                        </option>
                      ))}
                    </select>
                  </label>
                  <small>
                    {layer.dataset_metadata.geography} ·{" "}
                    {layer.dataset_metadata.reference_period}
                  </small>
                  <StatisticalLegend
                    layer={layer}
                    indicatorId={options[layer.id]?.indicator}
                  />
                </>
              ) : null}
              <details>
                <summary>Source & scope</summary>
                <p>{layer.description}</p>
                <small>Release status: {layer.release_status || "beta"}</small>
                {!layer.enabled && layer.release_checklist?.release_blocker ? (
                  <p>{String(layer.release_checklist.release_blocker)}</p>
                ) : null}
                <p>{layer.usage_notes}</p>
                {layer.dataset_metadata?.version ? (
                  <>
                    <p>{layer.dataset_metadata.coverage}</p>
                    <p>
                      {layer.dataset_metadata.geography} ·{" "}
                      {layer.dataset_metadata.boundary_version}
                    </p>
                    <p>
                      {layer.dataset_metadata.reference_period} · Version:{" "}
                      {layer.dataset_metadata.version}
                    </p>
                    <p>
                      Last verified: {layer.dataset_metadata.verified_on} · Data
                      updated: {layer.dataset_metadata.updated}
                    </p>
                    <p>{layer.dataset_metadata.methodology}</p>
                    <p>{layer.attribution}</p>
                    <a
                      href={layer.dataset_metadata.licence_evidence}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {layer.dataset_metadata.licence}
                    </a>
                  </>
                ) : null}
                <a href={layer.source_url} target="_blank" rel="noreferrer">
                  Official source
                </a>
                {!layer.dataset_metadata?.indicators &&
                layer.renderer !== "geojson" ? (
                  <LayerLegend id={layer.id} />
                ) : null}
              </details>
              <div className="actions">
                <button
                  disabled={busy !== null || index === 0}
                  aria-label={`${layer.name} move up`}
                  onClick={async () => {
                    const ids = active.map((l) => l.catalog_id);
                    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                    setBusy(item.catalog_id);
                    try {
                      await onReorder(ids);
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  Move up
                </button>
                <button
                  disabled={busy !== null || index === active.length - 1}
                  aria-label={`${layer.name} move down`}
                  onClick={async () => {
                    const ids = active.map((l) => l.catalog_id);
                    [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
                    setBusy(item.catalog_id);
                    try {
                      await onReorder(ids);
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  Move down
                </button>
                <button
                  disabled={busy !== null}
                  onClick={() => void change(item, true)}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      {open ? (
        <div className="catalog-search">
          <p>Official government datasets · add only what you need.</p>
          <label>
            Search layers
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="flood, zoning, heritage…"
            />
          </label>
          <label>
            Coverage
            <select value={state} onChange={(e) => setState(e.target.value)}>
              <option>All</option>
              <option>VIC</option>
              <option>NSW</option>
              <option>AU</option>
            </select>
          </label>
          {CATALOGUE_CATEGORIES.map((group) => {
            const items = matches.filter((layer) => {
              return catalogueCategory(layer.category, layer.name) === group;
            });
            return items.length ? (
              <section key={group} aria-label={group}>
                <strong>{group}</strong>
                {items.map((layer) => (
                  <div className="catalog-result" key={layer.id}>
                    <strong>{layer.name}</strong>
                    <small>
                      {layer.state} · {layer.category} · {layer.provider} ·{" "}
                      {layer.premium_tier === "free"
                        ? "Official / free"
                        : "Premium"}
                      {["vic-zoning", "nsw-zoning"].includes(layer.id)
                        ? " · Featured"
                        : ""}
                    </small>
                    <p>{layer.description}</p>
                    {layer.dataset_metadata?.version ? (
                      <small>
                        {layer.dataset_metadata.geography} ·{" "}
                        {layer.dataset_metadata.reference_period} ·{" "}
                        {layer.dataset_metadata.licence}
                      </small>
                    ) : null}
                    {!layer.enabled &&
                    layer.release_checklist?.release_blocker ? (
                      <p>{String(layer.release_checklist.release_blocker)}</p>
                    ) : null}
                    <button
                      disabled={busy !== null || !layer.enabled}
                      onClick={() =>
                        void change({
                          catalog_id: layer.id,
                          visible: true,
                          opacity: 0.65,
                          position: active.length,
                        })
                      }
                    >
                      {layer.enabled ? "Add" : "Unavailable"}
                    </button>
                  </div>
                ))}
              </section>
            ) : null;
          })}
          {!matches.length ? (
            <p>No matching layers for this search and coverage.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

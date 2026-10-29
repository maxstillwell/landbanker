"use client";
import { useState } from "react";
import type { CatalogLayer, ActiveLayer } from "@/lib/map/catalog-types";
import { LayerLegend } from "./layer-legend";
export function LayerLibrary({
  catalog,
  active,
  onChange,
  onReorder,
}: {
  catalog: CatalogLayer[];
  active: ActiveLayer[];
  onChange: (item: ActiveLayer, remove?: boolean) => Promise<void>;
  onReorder: (ids: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
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
      `${l.name} ${l.state} ${l.category} ${l.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="layer-library">
      <div role="tablist" aria-label="Layer library views"><button role="tab" aria-selected={!open} onClick={()=>setOpen(false)}>Added to Map ({active.length})</button><button role="tab" aria-selected={open} onClick={()=>setOpen(true)}>Catalogue</button></div>
      <div className="section-label">{open ? "CATALOGUE" : "ADDED TO MAP"}</div>
      {!open && active.map((item, index) => {
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
            <details>
              <summary>Source & scope</summary>
              <p>{layer.description}</p>
              <small>Release status: {layer.release_status || "beta"}</small>
              {!layer.enabled && layer.release_checklist?.release_blocker ? (
                <p>{String(layer.release_checklist.release_blocker)}</p>
              ) : null}
              <p>{layer.usage_notes}</p>
              <p>Release status: {layer.release_status || "beta"}</p>
              <a href={layer.source_url} target="_blank" rel="noreferrer">
                Official source
              </a>
              <LayerLegend id={layer.id} />
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
        <div className="catalog-search"><p>Official layers · Featured sources are marked below. Future premium datasets are not yet available.</p>
          <label>
            Search layers
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="flood, zoning, heritage…"
            />
          </label>
          {(["Parcels", "Planning", "Environmental", "Infrastructure", "Other"] as const).map((group) => {
            const items = matches.filter((layer) => {
              const category = `${layer.category} ${layer.name}`.toLowerCase();
              const actual = /parcel|cadast|property boundar/.test(category) ? "Parcels" : /flood|bushfire|environment|heritage|biodiversity|vegetation|water/.test(category) ? "Environmental" : /infrastructure|transport|road|utility|utilities/.test(category) ? "Infrastructure" : /planning|zon|overlay/.test(category) ? "Planning" : "Other";
              return actual === group;
            });
            return items.length ? <section key={group} aria-label={group}><strong>{group}</strong>{items.map((layer) => (
            <div className="catalog-result" key={layer.id}>
              <strong>{layer.name}</strong>
              <small>
                {layer.state} · {layer.category} · {layer.provider} · {layer.premium_tier === "free" ? "Official / free" : "Premium"}{["vic-zoning", "nsw-zoning"].includes(layer.id) ? " · Featured" : ""}
              </small>
              <p>{layer.description}</p>
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
          ))}</section> : null;
          })}
          {!matches.length ? (
            <p>
              No matching available layers. Coverage currently Victoria and NSW.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

"use client";
import {
  MAPLIBRE_BASEMAPS,
  type MapLibreBasemap,
} from "@/lib/map/maplibre-config";
const swatches: Record<MapLibreBasemap, string> = {
  hybrid: "linear-gradient(135deg,#344e32 15%,#9e8e60 40%,#315f54 65%,#7c7462 85%)",
  "esri-satellite": "linear-gradient(135deg,#344e32 15%,#9e8e60 40%,#315f54 65%,#7c7462 85%)",
  streets:
    "linear-gradient(135deg,#dce8c5 25%,#f4ddaa 25%,#f4ddaa 40%,#a8cbdf 40%,#a8cbdf 47%,#eee6d5 47%)",
  light:
    "linear-gradient(135deg,#f5f5ef 40%,#d6d9d1 40%,#d6d9d1 45%,#f5f5ef 45%,#f5f5ef 70%,#cddfe4 70%)",
  dark: "linear-gradient(135deg,#202a32 40%,#53606a 40%,#53606a 45%,#202a32 45%,#202a32 70%,#304d61 70%)",
  fiord:
    "linear-gradient(130deg,#a8b8b9 40%,#546b79 40%,#546b79 50%,#dce1d5 50%)",
  terrain:
    "linear-gradient(135deg,#cee2b5 40%,#ead6ae 40%,#ead6ae 45%,#cee2b5 45%,#cee2b5 70%,#8fcae0 70%)",
};

export function BasemapSelector({
  value,
  onChange,
  esriEnabled,
}: {
  value: MapLibreBasemap;
  onChange: (next: MapLibreBasemap) => void;
  esriEnabled: boolean;
}) {
  const basemapOrder: MapLibreBasemap[] = ["streets", "light", "dark", "esri-satellite", "hybrid"];
  return (
    <details className="basemap-picker">
      <summary aria-label="Basemap previews">
        <i style={{ background: swatches[value] }} />
        {MAPLIBRE_BASEMAPS[value].label}
      </summary>
      <div className="basemap-options">
        <label>
          Basemap
          <select
            aria-label="Basemap"
            value={value}
            onChange={(e) => onChange(e.target.value as MapLibreBasemap)}
          >
            {basemapOrder.map((id) => (
              <option key={id} value={id} disabled={(id === "esri-satellite" || id === "hybrid") && !esriEnabled}>
                {MAPLIBRE_BASEMAPS[id].label}
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Basemap styles">
          {basemapOrder.map((id) => (
            <button
              key={id}
              aria-pressed={value === id}
              disabled={(id === "esri-satellite" || id === "hybrid") && !esriEnabled}
              title={(id === "esri-satellite" || id === "hybrid") && !esriEnabled ? "Satellite imagery is not configured" : undefined}
              onClick={(event) => {
                onChange(id as MapLibreBasemap);
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
            >
              <i style={{ background: swatches[id as MapLibreBasemap] }} />
              <span>{MAPLIBRE_BASEMAPS[id].label}</span>
            </button>
          ))}
        </div>
        {!esriEnabled && <small>Satellite imagery is not configured.</small>}
      </div>
    </details>
  );
}

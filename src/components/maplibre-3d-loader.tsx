"use client";

import dynamic from "next/dynamic";

const MapLibre3DCanvas = dynamic(() => import("./maplibre-3d-canvas"), {
  ssr: false,
  loading: () => <div className="map-3d-loading">Loading 3D map…</div>,
});

export default MapLibre3DCanvas;

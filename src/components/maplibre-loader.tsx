"use client";

import dynamic from "next/dynamic";

const MapLibreWorkspace = dynamic(() => import("./maplibre-workspace"), {
  ssr: false,
  loading: () => <div className="map-loading">Preparing 3D map…</div>,
});

export default MapLibreWorkspace;

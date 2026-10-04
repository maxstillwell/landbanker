"use client";
import dynamic from "next/dynamic";
const MapWorkspace = dynamic(() => import("./map-workspace"), {
  ssr: false,
  loading: () => <div className="map-loading">Preparing your map…</div>,
});
export default MapWorkspace;

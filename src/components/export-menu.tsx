"use client";
import type { SpatialExportFormat } from "@/lib/map/spatial-file";
export function ExportMenu({onExport}:{onExport:(format:SpatialExportFormat)=>void}) {return <details className="object-export"><summary>Export</summary><div className="actions">{(["kml","kmz","geojson","csv"] as const).map(format=><button key={format} onClick={event=>{onExport(format);event.currentTarget.closest('details')?.removeAttribute('open');}}>{format.toUpperCase()}</button>)}</div></details>;}

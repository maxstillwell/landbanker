import type { NextRequest } from "next/server";
import { z } from "zod";
import { workspaceContext } from "@/lib/workspace";
import { apiError, json } from "@/lib/api";
export async function GET(request: NextRequest) {
  try {
    await workspaceContext();
    const q = z.string().trim().min(3).max(80).parse(request.nextUrl.searchParams.get("q"));
    const term = q.replace(/[\u0000-\u001f%_]/g, "").replace(/'/g, "''");
    if (term.length < 3) return json({ places: [] });
    const params = new URLSearchParams({ f: "json", where: `UPPER(name) LIKE '${term.toUpperCase()}%'`, outFields: "name,feature,latitude,longitude,authority", returnGeometry: "false", resultRecordCount: "12", orderByFields: "name ASC" });
    const response = await fetch(`https://services.ga.gov.au/gis/rest/services/Composite_Gazetteer_of_Australia/MapServer/0/query?${params}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("National places service unavailable.");
    const body = await response.json(); if (body.error) throw new Error("National places service unavailable.");
    const places = (body.features || []).flatMap((item: { attributes?: Record<string, unknown> }) => { const a = item.attributes || {}; const latitude = Number(a.latitude), longitude = Number(a.longitude); return typeof a.name === "string" && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? [{ name: a.name, kind: String(a.feature || "Place"), latitude, longitude, authority: String(a.authority || "Geoscience Australia") }] : []; });
    return json({ places });
  } catch (error) { return apiError(error); }
}

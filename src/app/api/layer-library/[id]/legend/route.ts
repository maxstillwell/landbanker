import { workspaceContext } from "@/lib/workspace";
import { apiError, json } from "@/lib/api";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const c = await workspaceContext();
    const { id } = await params;
    const { data: layer, error } = await c.client
      .from("layer_catalog")
      .select("service_url,renderer,layer_ids,enabled")
      .eq("id", id)
      .single();
    if (error || !layer?.enabled) throw new Error("Layer unavailable");
    if (layer.renderer !== "arcgis_export") return json({ symbols: [] });
    const url = new URL(layer.service_url);
    if (
      url.protocol !== "https:" ||
      ![
        "plan-gis.mapshare.vic.gov.au",
        "portal.spatial.nsw.gov.au",
        "mapprod2.environment.nsw.gov.au",
        "mapprod3.environment.nsw.gov.au",
        "mapprod.environment.nsw.gov.au",
      ].includes(url.hostname)
    )
      throw new Error("Legend provider is not verified.");
    const response = await fetch(`${layer.service_url}/legend?f=json`, {
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 86400 },
      redirect: "error",
    });
    if (!response.ok)
      throw new Error("Official legend temporarily unavailable.");
    const data = await response.json();
    const ids = (layer.layer_ids || "0").split(",").map(Number);
    const symbols: { label: string; image: string }[] = [];
    for (const item of data.layers || []) {
      if (!ids.includes(item.layerId)) continue;
      for (const legend of item.legend || []) {
        if (
          legend.contentType !== "image/png" ||
          typeof legend.imageData !== "string" ||
          legend.imageData.length > 6000 ||
          !/^[A-Za-z0-9+/=]+$/.test(legend.imageData)
        )
          continue;
        symbols.push({
          label: String(legend.label || item.layerName).slice(0, 200),
          image: `data:image/png;base64,${legend.imageData}`,
        });
        if (symbols.length >= 40) return json({ symbols });
      }
    }
    return json({ symbols });
  } catch (e) {
    return apiError(e);
  }
}

import { workspaceContext } from "@/lib/workspace";
import { canPreviewTerrain } from "@/lib/terrain-preview";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  try {
    const c = await workspaceContext();
    if (!canPreviewTerrain(c.user.id, c.role)) return new Response(null, { status: 403 });
    const p = await params;
    if (![p.z, p.x, p.y].every((v) => /^\d{1,5}$/.test(v))) return new Response(null, { status: 400 });
    const z = Number(p.z), x = Number(p.x), y = Number(p.y);
    if (z > 12 || x >= 2 ** z || y >= 2 ** z) return new Response(null, { status: 400 });
    const response = await fetch(`https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${z}/${x}/${y}.png`, { cache: "no-store", signal: AbortSignal.timeout(12000), redirect: "error" });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png")) return new Response(null, { status: 502 });
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 2_000_000) return new Response(null, { status: 502 });
    return new Response(bytes, { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
}

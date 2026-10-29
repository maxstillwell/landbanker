/** Provider configuration is deliberately separate from basemap imagery. */
export type TerrainProvider = {
  id: string;
  label: string;
  url?: string;
  tiles?: string[];
  tileSize: 256 | 512;
  attribution: string;
  resolution: string;
  datum: string;
  accuracy: string;
  maxzoom?: number;
  bounds?: [number, number, number, number];
  testingOnly: boolean;
  datumVerified: boolean;
};

function https(value: string) {
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password; }
  catch { return false; }
}

export function terrainProvider(input: Partial<TerrainProvider>): TerrainProvider | null {
  if (!input.id || !input.label || !input.attribution?.trim()) return null;
  if (input.tileSize !== 256 && input.tileSize !== 512) return null;
  if (Boolean(input.url) === Boolean(input.tiles?.length)) return null;
  if (input.url && !https(input.url)) return null;
  if (input.tiles?.some((tile) => !https(tile) || !["{z}", "{x}", "{y}"].every((token) => tile.includes(token)))) return null;
  if (input.maxzoom !== undefined && (!Number.isInteger(input.maxzoom) || input.maxzoom < 0 || input.maxzoom > 15)) return null;
  if (input.bounds && (input.bounds.length !== 4 || !input.bounds.every(Number.isFinite) || input.bounds[0] >= input.bounds[2] || input.bounds[1] >= input.bounds[3] || input.bounds[0] < -180 || input.bounds[2] > 180 || input.bounds[1] < -85.051129 || input.bounds[3] > 85.051129)) return null;
  return { ...input, id: input.id, label: input.label, attribution: input.attribution.trim(), tileSize: input.tileSize, resolution: input.resolution?.trim() || "unknown", datum: input.datum?.trim() || "unknown", accuracy: input.accuracy?.trim() || "unknown", testingOnly: input.testingOnly ?? false, datumVerified: input.datumVerified === true && Boolean(input.datum?.trim()) };
}

/** A bounded test candidate, never returned for a production build. */
export const TILEZEN_TEST_PROVIDER: TerrainProvider = {
  id: "tilezen-test", label: "AWS Tilezen (testing only)",
  tiles: ["https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"],
  tileSize: 256, maxzoom: 12, bounds: [112, -44, 154, -10],
  attribution: "Mapzen / Tilezen · © Commonwealth of Australia (Geoscience Australia) 2017 · SRTM and GMTED2010 courtesy of the U.S. Geological Survey",
  resolution: "varies by source and zoom; do not infer resolution from display pixels",
  datum: "unverified mixed-source mosaic; not established as AHD",
  accuracy: "unknown; estimates only, not survey grade",
  testingOnly: true, datumVerified: false,
};

export function availableTerrainProviders(configured: TerrainProvider | null, enableTilezenTest: boolean, development: boolean): TerrainProvider[] {
  return [...(configured ? [configured] : []), ...(enableTilezenTest && development ? [TILEZEN_TEST_PROVIDER] : [])];
}

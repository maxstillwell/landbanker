import { createHash } from "node:crypto";
export type LegacyRow = { id: string; [key: string]: unknown };
export type Snapshot = {
  version: 1;
  source_project: string;
  exported_at: string;
  parcels: LegacyRow[];
  observations: LegacyRow[];
  media: LegacyRow[];
  layers: LegacyRow[];
};
export type ImportRecord = {
  table: string;
  sourceTable: string;
  legacyId: string;
  sourceHash: string;
  row: Record<string, unknown> & { id: string; workspace_id: string };
};
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
      .join(",")}}`.slice(0, -1);
  return JSON.stringify(value) ?? "null";
}
export function sourceHash(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
export function mappedId(workspace: string, table: string, id: string) {
  const h = createHash("sha256")
    .update(`land-banker:maxqi:v1:${workspace}:${table}:${id}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  h[12] = "5";
  h[16] = ((parseInt(h[16], 16) & 3) | 8).toString(16);
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
function number(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}
export function planImport(snapshot: Snapshot, workspace: string) {
  if (
    snapshot.version !== 1 ||
    snapshot.source_project !== "kcdzzbmkqtuwfzbeqcks"
  )
    throw new Error("Unexpected source snapshot");
  const records: ImportRecord[] = [];
  const issues: string[] = [];
  const parcelIds = new Set(snapshot.parcels.map((p) => p.id));
  const observationIds = new Set(snapshot.observations.map((p) => p.id));
  const add = (
    table: string,
    sourceTable: string,
    legacy: LegacyRow,
    row: Record<string, unknown>,
    suffix = "",
  ) => {
    records.push({
      table,
      sourceTable,
      legacyId: legacy.id + suffix,
      sourceHash: sourceHash(legacy),
      row: {
        ...row,
        id: mappedId(workspace, sourceTable, legacy.id + suffix),
        workspace_id: workspace,
      },
    });
  };
  for (const p of snapshot.parcels)
    add("land_parcels", "land_parcels", p, {
      title: String(p.title || p.address || "Imported parcel").slice(0, 160),
      latitude: number(p.lat),
      longitude: number(p.lng),
      geometry: p.geojson ?? null,
      hectares: number(p.hectares),
      status: String(p.status || "research"),
      notes: p.notes ?? null,
      metadata: { legacy: p },
    });
  for (const o of snapshot.observations) {
    const linked =
      typeof o.linked_parcel_id === "string" ? o.linked_parcel_id : null;
    if (linked && !parcelIds.has(linked))
      issues.push(`Missing parcel ${linked} for observation ${o.id}`);
    add("field_observations", "land_field_observations", o, {
      title: String(o.title || "Field observation").slice(0, 160),
      notes: o.notes ?? null,
      latitude: number(o.latitude),
      longitude: number(o.longitude),
      observed_at: o.observed_at,
      linked_parcel_id:
        linked && parcelIds.has(linked)
          ? mappedId(workspace, "land_parcels", linked)
          : null,
      metadata: { legacy: o },
    });
  }
  for (const m of snapshot.media) {
    if (!observationIds.has(String(m.observation_id))) {
      issues.push(`Orphan media ${m.id}`);
      continue;
    }
    add("field_observation_media", "land_field_observation_media", m, {
      observation_id: mappedId(
        workspace,
        "land_field_observations",
        String(m.observation_id),
      ),
      mime_type: m.mime_type,
      original_filename: String(
        m.original_filename ||
          String(m.storage_path || "")
            .split("/")
            .pop() ||
          `legacy-${m.id}`,
      ).slice(0, 160),
      size_bytes: number(m.size_bytes),
      captured_at: m.captured_at ?? null,
      storage_path: null,
      upload_status: "legacy_pending",
      metadata: {
        legacy: m,
        source_storage: {
          project: snapshot.source_project,
          bucket: m.storage_bucket,
          path: m.storage_path,
        },
        copy_status: "not_copied",
      },
    });
  }
  for (const l of snapshot.layers) {
    const d = (l.layer_data || {}) as Record<string, unknown>;
    let geojson = d.data ?? (d.type === "FeatureCollection" ? d : null);
    if (
      !geojson &&
      l.layer_kind === "polygon" &&
      Array.isArray(d.coordinates)
    ) {
      const coordinates = (d.coordinates as number[][]).map((c) => [
        c[1],
        c[0],
      ]);
      if (coordinates.length >= 3)
        geojson = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Polygon",
                coordinates: [[...coordinates, coordinates[0]]],
              },
            },
          ],
        };
    }
    add("spatial_layers", "land_spatial_layers", l, {
      name: l.name,
      layer_kind: l.layer_kind,
      geojson: geojson ?? null,
      layer_data: d,
      metadata: { legacy: l },
    });
    const f = (geojson as { features?: unknown[] } | null)?.features || [];
    f.forEach((feature, index) =>
      add(
        "spatial_features",
        "land_spatial_layer_features",
        { id: l.id, ...{ feature } },
        { layer_id: mappedId(workspace, "land_spatial_layers", l.id), feature },
        `:${index}`,
      ),
    );
  }
  return {
    records,
    issues,
    counts: Object.fromEntries(
      [...new Set(records.map((r) => r.table))].map((t) => [
        t,
        records.filter((r) => r.table === t).length,
      ]),
    ),
  };
}

import { z } from "zod";
import { planImport, type Snapshot } from "./transform";
// Offline, reviewable connector adapter. No source connection, no UPDATE/DELETE.
const tables = new Set([
  "land_parcels",
  "field_observations",
  "field_observation_media",
  "spatial_layers",
  "spatial_features",
]);
const literal = (s: string) => "'" + s.replaceAll("'", "''") + "'";
export function limitedCopySQL(
  snapshot: Snapshot,
  workspace: string,
  owner: string,
  verifyOnly = false,
) {
  z.uuid().parse(workspace);
  z.uuid().parse(owner);
  const sourceCount =
    snapshot.parcels.length +
    snapshot.observations.length +
    snapshot.media.length +
    snapshot.layers.length;
  if (sourceCount < 1 || sourceCount > 10)
    throw new Error(
      "Connector copy is limited to 10 source records; full migration requires a separate milestone",
    );
  const plan = planImport(snapshot, workspace);
  if (plan.issues.length)
    throw new Error("Resolve source relationships before copy");
  if (plan.records.length > 100)
    throw new Error("Limited sample exceeds derived feature budget");
  const sql = [
    "begin;",
    "set local standard_conforming_strings = on;",
    `do $guard$ begin if not exists(select 1 from public.workspace_memberships where workspace_id=${literal(workspace)}::uuid and user_id=${literal(owner)}::uuid and role='owner' and status='active') then raise exception 'Verified registered owner required';end if;end $guard$;`,
  ];
  for (const record of plan.records) {
    if (!tables.has(record.table)) throw new Error("Invalid import table");
    const row = {
      ...record.row,
      ...(record.table === "spatial_features" ? {} : { created_by: owner }),
    };
    const columns = Object.keys(row);
    if (columns.some((c) => !/^[_a-z]+$/.test(c)))
      throw new Error("Invalid column");
    const value = literal(JSON.stringify(row));
    const condition = `workspace_id=${literal(workspace)}::uuid and source_system='maxqi' and source_table=${literal(record.sourceTable)} and legacy_id=${literal(record.legacyId)}`;
    const table = `public.${record.table}`,
      id = literal(row.id);
    const equality = columns
      .map(
        (c) =>
          `to_jsonb(t)->${literal(c)} is not distinct from to_jsonb(p)->${literal(c)}`,
      )
      .join(" and ");
    const lineage =
      record.table === "spatial_features"
        ? `t.layer_id=(r->>'layer_id')::uuid and t.feature=r->'feature'`
        : `t.metadata->'legacy'->>'id'=r->'metadata'->'legacy'->>'id'`;
    let tag = "$landos_import$";
    while ((value + condition).includes(tag)) tag = tag.slice(0, -1) + "x$";
    sql.push(`do ${tag} declare r jsonb:=${value}::jsonb; n integer; begin
    if exists(select 1 from public.migration_mappings where ${condition} and (target_id<>${id}::uuid or target_table<>${literal(record.table)})) then raise exception 'Mapping mismatch';end if;
    if exists(select 1 from ${table} where id=${id}::uuid and workspace_id<>${literal(workspace)}::uuid) then raise exception 'Target Workspace mismatch';end if;
    if not exists(select 1 from public.migration_mappings where ${condition}) and exists(select 1 from ${table} t where t.id=${id}::uuid and (${lineage}) is not true) then raise exception 'Unverified existing target';end if;
    ${
      verifyOnly
        ? ""
        : `insert into ${table}(${columns.join(",")}) select ${columns.map((c) => "p." + c).join(",")} from jsonb_populate_record(null::${table},r) p on conflict(id) do nothing;
    get diagnostics n = row_count;
    if n=1 and not exists(select 1 from ${table} t cross join jsonb_populate_record(null::${table},r) p where t.id=${id}::uuid and ${equality}) then raise exception 'Inserted values differ';end if;
    insert into public.migration_mappings(workspace_id,source_system,source_table,legacy_id,target_table,target_id,source_hash) values(${literal(workspace)}::uuid,'maxqi',${literal(record.sourceTable)},${literal(record.legacyId)},${literal(record.table)},${id}::uuid,${literal(record.sourceHash)}) on conflict(workspace_id,source_system,source_table,legacy_id) do nothing;`
    }
    if not exists(select 1 from ${table} t join public.migration_mappings m on m.target_id=t.id where m.${condition.replaceAll(" and ", " and m.")} and t.workspace_id=${literal(workspace)}::uuid) then raise exception 'Copy verification failed';end if;
  end ${tag};`);
  }
  const expected = plan.records
    .map(
      (r) =>
        `(${literal(r.sourceTable)},${literal(r.legacyId)},${literal(r.sourceHash)})`,
    )
    .join(",");
  sql.push(
    `select jsonb_build_object('verified',${plan.records.length},'source_records',${sourceCount},'media_files_copied',0,'source_changed',(select count(*) from (values ${expected}) e(source_table,legacy_id,source_hash) join public.migration_mappings m on m.workspace_id=${literal(workspace)}::uuid and m.source_system='maxqi' and m.source_table=e.source_table and m.legacy_id=e.legacy_id where m.source_hash<>e.source_hash),'counts',${literal(JSON.stringify(plan.counts))}::jsonb) as copy_report;`,
    "commit;",
  );
  return sql.join("\n");
}

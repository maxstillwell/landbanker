import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assertIndependentBackend } from "../src/lib/config";
import {
  planImport,
  sourceHash,
  type Snapshot,
} from "../src/lib/import/transform";
const args = process.argv.slice(2);
const value = (name: string) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const path = value("--snapshot");
const workspace =
  value("--workspace") || process.env.LAND_BANKER_IMPORT_WORKSPACE_ID;
if (!path || !workspace)
  throw new Error(
    "Usage: npm run import:maxqi -- --snapshot private-imports/maxqi.json --workspace UUID [--apply] [--verify]",
  );
z.uuid().parse(workspace);
const snapshot = JSON.parse(await readFile(path, "utf8")) as Snapshot;
const plan = planImport(snapshot, workspace);
if (plan.issues.length)
  throw new Error(
    `Resolve missing relationships before applying: ${plan.issues.join("; ")}`,
  );
const report: {
  counts: Record<string, number>;
  created: number;
  alreadyImported: number;
  sourceChanged: string[];
  verified: number;
  mediaFilesCopied: number;
} = {
  counts: plan.counts,
  created: 0,
  alreadyImported: 0,
  sourceChanged: [],
  verified: 0,
  mediaFilesCopied: 0,
};
if (args.includes("--apply") || args.includes("--verify")) {
  const url = assertIndependentBackend(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  );
  const key = process.env.LAND_BANKER_IMPORT_SECRET_KEY;
  if (!key)
    throw new Error(
      "Destination import key required; never use source key for destination",
    );
  const project = process.env.LAND_BANKER_PROJECT_REF;
  const localTest =
    args.includes("--local-test") &&
    project === "land-banker-local" &&
    ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  if (
    !project ||
    (!localTest && new URL(url).hostname !== `${project}.supabase.co`)
  )
    throw new Error("Explicit destination project ref must match backend");
  const destination = createClient(url, key, {
    auth: { persistSession: false },
  });
  const { data: owner, error: ownerError } = await destination
    .from("workspace_memberships")
    .select("user_id")
    .eq("workspace_id", workspace)
    .eq("role", "owner")
    .eq("status", "active")
    .single();
  if (ownerError || !owner)
    throw new Error(
      "A registered user-owned destination workspace is required",
    );
  for (const record of plan.records) {
    const { data: mapping, error: mapError } = await destination
      .from("migration_mappings")
      .select("target_id,target_table,source_hash")
      .eq("workspace_id", workspace)
      .eq("source_system", "maxqi")
      .eq("source_table", record.sourceTable)
      .eq("legacy_id", record.legacyId)
      .maybeSingle();
    if (mapError) throw new Error(mapError.message);
    if (
      mapping &&
      (mapping.target_id !== record.row.id ||
        mapping.target_table !== record.table)
    )
      throw new Error("Migration mapping does not match the planned copy");
    if (args.includes("--verify") && !args.includes("--apply") && !mapping)
      throw new Error(
        "Copy verification requires a persisted migration mapping",
      );
    if (mapping && mapping.source_hash !== record.sourceHash)
      report.sourceChanged.push(record.legacyId);
    const { data: existing, error: readError } = await destination
      .from(record.table)
      .select("*")
      .eq("id", record.row.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (existing) {
      if (existing.workspace_id !== workspace)
        throw new Error("Target workspace mismatch");
      if (!mapping && record.table !== "spatial_features") {
        const marker = existing.metadata?.legacy;
        if (
          marker?.id !==
          (record.row.metadata as { legacy?: { id?: string } } | undefined)
            ?.legacy?.id
        )
          throw new Error("Existing target is not a verified legacy copy");
      }
      if (
        !mapping &&
        record.table === "spatial_features" &&
        (existing.layer_id !== record.row.layer_id ||
          sourceHash(existing.feature) !== sourceHash(record.row.feature))
      )
        throw new Error("Existing feature is not a verified legacy copy");
      report.alreadyImported++;
    } else if (args.includes("--apply")) {
      const { error } = await destination.from(record.table).insert({
        ...record.row,
        ...(record.table !== "spatial_features"
          ? { created_by: owner.user_id }
          : {}),
      });
      if (error) throw new Error(error.message);
      report.created++;
    } else
      throw new Error(`Missing destination ${record.table}:${record.row.id}`);
    if (args.includes("--apply") && !mapping) {
      const { error } = await destination.from("migration_mappings").insert({
        workspace_id: workspace,
        source_system: "maxqi",
        source_table: record.sourceTable,
        legacy_id: record.legacyId,
        target_table: record.table,
        target_id: record.row.id,
        source_hash: record.sourceHash,
      });
      if (error) throw new Error(error.message);
    }
    const { data: verified, error: verifyError } = await destination
      .from(record.table)
      .select("id,workspace_id")
      .eq("id", record.row.id)
      .single();
    if (verifyError || verified?.workspace_id !== workspace)
      throw new Error("Copy verification failed");
    report.verified++;
  }
}
await mkdir("private-imports", { recursive: true });
await writeFile(
  "private-imports/import-report.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
console.log(
  args.includes("--apply")
    ? "Copy completed. Source was never opened for writes."
    : "Dry run / verification complete. No source or destination data was changed.",
);

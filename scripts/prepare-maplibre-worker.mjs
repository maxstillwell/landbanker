import { readFile, mkdir, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const packagePath = fileURLToPath(
  import.meta.resolve("maplibre-gl/package.json"),
);
const { version } = JSON.parse(await readFile(packagePath, "utf8"));
const destination = join("public", "maplibre", version);
await mkdir(destination, { recursive: true });
await copyFile(
  join(dirname(packagePath), "dist", "maplibre-gl-worker.mjs"),
  join(destination, "maplibre-gl-worker.mjs"),
);
console.log(`Prepared same-origin MapLibre ${version} worker`);

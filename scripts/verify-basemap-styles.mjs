import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
const results = await Promise.all(
  ["liberty", "positron", "bright", "dark", "fiord"].map(async (style) => {
    const url = `https://tiles.openfreemap.org/styles/${style}`;
    try {
      const start = performance.now();
      const { stdout } = await run(
        "curl",
        ["--fail", "--silent", "--show-error", "--max-time", "25", url],
        { maxBuffer: 4 * 1024 * 1024 },
      );
      const value = JSON.parse(stdout);
      if (value.version !== 8 || !value.sources || !value.layers?.length)
        throw new Error("Invalid MapLibre style");
      return {
        style,
        url,
        status: "pass",
        layers: value.layers.length,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (error) {
      return { style, url, status: "fail", error: error.message };
    }
  }),
);
console.log(
  JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2),
);
if (results.some((r) => r.status !== "pass")) process.exitCode = 1;

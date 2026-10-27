// Deterministic renderer fixtures; real Auth/API/Storage still use disposable local services.
// Provider availability/placement is tested separately from workflow regressions.
import { chromium as playwrightChromium } from "@playwright/test";
const tile = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
export async function mapFixtures(target) {
  await target.route("https://tiles.openfreemap.org/**", async (route) => {
    if (route.request().url().includes("/styles/"))
      return route.fulfill({
        json: {
          version: 8,
          sources: {
            fixture: {
              type: "raster",
              tiles: [
                "https://tiles.openfreemap.org/workflow-fixture/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              attribution: "Synthetic workflow fixture",
            },
          },
          layers: [
            { id: "fixture-background", type: "background", paint: { "background-color": route.request().url().endsWith("/dark") ? "#19242c" : route.request().url().endsWith("/fiord") ? "#c8d4cf" : "#eef1ee" } },
            { id: "fixture", type: "raster", source: "fixture", paint: { "raster-opacity": 0.02 } },
          ],
        },
      });
    return route.fulfill({ contentType: "image/png", body: tile });
  });
}
export const chromium = {
  async launch(options = {}) {
    const browser = await playwrightChromium.launch({
      ...options,
      args: [
        ...(options.args || []),
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    });
    const newContext = browser.newContext.bind(browser),
      newPage = browser.newPage.bind(browser);
    browser.newContext = async (...args) => {
      const context = await newContext(...args);
      await mapFixtures(context);
      return context;
    };
    browser.newPage = async (...args) => {
      const page = await newPage(...args);
      await mapFixtures(page);
      return page;
    };
    return browser;
  },
};

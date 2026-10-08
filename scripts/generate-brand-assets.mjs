import { mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const master = path.join(root, "brand", "landos-app-icon.svg");
const webDir = path.join(root, "public", "brand");
const appIconDir = path.join(
  root,
  "ios",
  "LandBanker",
  "Assets.xcassets",
  "AppIcon.appiconset",
);
const selectedPreviewDir = path.join(root, "brand", "round-2", "previews");

await mkdir(webDir, { recursive: true });
await mkdir(appIconDir, { recursive: true });
await mkdir(selectedPreviewDir, { recursive: true });
await copyFile(
  path.join(root, "brand", "landos-mark.svg"),
  path.join(webDir, "landos-mark.svg"),
);
await copyFile(
  path.join(root, "brand", "landos-logo.svg"),
  path.join(webDir, "landos-logo.svg"),
);
await copyFile(
  master,
  path.join(root, "brand", "round-2", "concept-b-spatial-data-overlay-v2.svg"),
);

async function render(destination, size) {
  await sharp(master, { density: 144 })
    .resize(size, size, { fit: "fill" })
    .png({ compressionLevel: 9, palette: true })
    .toFile(destination);
}

for (const size of [16, 32, 180, 192, 512]) {
  const name =
    size === 180
      ? "apple-touch-icon.png"
      : size === 16
        ? "favicon-16.png"
        : size === 32
          ? "favicon-32.png"
          : `icon-${size}.png`;
  await render(path.join(webDir, name), size);
}
await render(path.join(webDir, "icon-512-maskable.png"), 512);

for (const size of [32, 60, 120, 1024]) {
  await render(
    path.join(selectedPreviewDir, `selected-spatial-data-overlay-${size}.png`),
    size,
  );
}
const iosMask = Buffer.from(
  '<svg width="512" height="512"><rect width="512" height="512" rx="112" fill="white"/></svg>',
);
await sharp(master, { density: 144 })
  .resize(512, 512)
  .composite([{ input: iosMask, blend: "dest-in" }])
  .png({ compressionLevel: 9, palette: true })
  .toFile(
    path.join(selectedPreviewDir, "selected-spatial-data-overlay-ios-mask.png"),
  );

const iosImages = [
  ["iphone", "20x20", "2x", 40, "AppIcon-20@2x.png"],
  ["iphone", "20x20", "3x", 60, "AppIcon-20@3x.png"],
  ["iphone", "29x29", "2x", 58, "AppIcon-29@2x.png"],
  ["iphone", "29x29", "3x", 87, "AppIcon-29@3x.png"],
  ["iphone", "40x40", "2x", 80, "AppIcon-40@2x.png"],
  ["iphone", "40x40", "3x", 120, "AppIcon-40@3x.png"],
  ["iphone", "60x60", "2x", 120, "AppIcon-60@2x.png"],
  ["iphone", "60x60", "3x", 180, "AppIcon-60@3x.png"],
  ["ipad", "20x20", "1x", 20, "AppIcon-20@1x.png"],
  ["ipad", "20x20", "2x", 40, "AppIcon-20-ipad@2x.png"],
  ["ipad", "29x29", "1x", 29, "AppIcon-29@1x.png"],
  ["ipad", "29x29", "2x", 58, "AppIcon-29-ipad@2x.png"],
  ["ipad", "40x40", "1x", 40, "AppIcon-40@1x.png"],
  ["ipad", "40x40", "2x", 80, "AppIcon-40-ipad@2x.png"],
  ["ipad", "76x76", "1x", 76, "AppIcon-76@1x.png"],
  ["ipad", "76x76", "2x", 152, "AppIcon-76@2x.png"],
  ["ipad", "83.5x83.5", "2x", 167, "AppIcon-83.5@2x.png"],
  ["ios-marketing", "1024x1024", "1x", 1024, "AppIcon-1024.png"],
];

for (const [, , , pixels, filename] of iosImages) {
  await render(path.join(appIconDir, filename), pixels);
}

await writeFile(
  path.join(appIconDir, "Contents.json"),
  `${JSON.stringify(
    {
      images: iosImages.map(([idiom, size, scale, , filename]) => ({
        filename,
        idiom,
        scale,
        size,
      })),
      info: { author: "xcode", version: 1 },
    },
    null,
    2,
  )}\n`,
);

console.log("Generated LandOS web and iOS brand assets.");

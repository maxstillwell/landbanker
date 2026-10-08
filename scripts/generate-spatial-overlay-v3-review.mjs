import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const reviewDir = path.join(root, "brand", "round-2");
const previewDir = path.join(reviewDir, "previews");
const sourcePath = path.join(reviewDir, "concept-b-spatial-data-overlay-v3.svg");
const source = await readFile(sourcePath, "utf8");
const sourceUri = `data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}`;

await mkdir(previewDir, { recursive: true });

for (const size of [32, 60, 120, 1024]) {
  await sharp(Buffer.from(source))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(path.join(previewDir, `spatial-data-overlay-v3-${size}.png`));
}

const mask = Buffer.from(
  '<svg width="512" height="512"><rect width="512" height="512" rx="112" fill="white"/></svg>',
);
await sharp(Buffer.from(source))
  .resize(512, 512)
  .composite([{ input: mask, blend: "dest-in" }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(previewDir, "spatial-data-overlay-v3-ios-mask.png"));

function maskedIcon(x, y, size, radius = Math.round(size * 0.22)) {
  const id = `mask-${x}-${y}-${size}`;
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}"/></clipPath><image href="${sourceUri}" x="${x}" y="${y}" width="${size}" height="${size}" clip-path="url(#${id})"/>`;
}

function homeScreen(x, y, dark) {
  const bg = dark ? "#080A10" : "#E9EEF5";
  const tile = dark ? "#252B37" : "#D4DCE7";
  const fg = dark ? "#F4F7FA" : "#192333";
  const iconX = x + 151;
  const iconY = y + 70;
  return `<g>
    <rect x="${x}" y="${y}" width="360" height="270" rx="38" fill="${bg}"/>
    <text x="${x + 24}" y="${y + 36}" class="screen" fill="${fg}">${dark ? "DARK" : "LIGHT"} HOME SCREEN</text>
    <g fill="${tile}"><rect x="${x + 45}" y="${y + 70}" width="78" height="78" rx="18"/><rect x="${x + 237}" y="${y + 70}" width="78" height="78" rx="18"/><rect x="${x + 45}" y="${y + 178}" width="58" height="58" rx="14"/><rect x="${x + 257}" y="${y + 178}" width="58" height="58" rx="14"/></g>
    ${maskedIcon(iconX, iconY, 78, 18)}
    <text x="${iconX + 39}" y="${iconY + 101}" class="app" fill="${fg}" text-anchor="middle">LandOS</text>
  </g>`;
}

const board = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200" viewBox="0 0 1800 1200" role="img" aria-labelledby="title desc">
  <title id="title">LandOS Spatial Data Overlay icon-only review</title>
  <desc id="desc">A focused review board for the layered spatial intelligence icon at large and small sizes with light and dark home screen previews.</desc>
  <style>
    text { font-family: Inter, Arial, sans-serif; }
    .kicker { font-size: 17px; font-weight: 750; letter-spacing: 4px; fill: #A8BDCF; }
    .title { font-size: 48px; font-weight: 780; letter-spacing: -1.5px; fill: #F5F9FC; }
    .subtitle { font-size: 20px; fill: #9EB0C1; }
    .label { font-size: 14px; font-weight: 760; letter-spacing: 1.5px; fill: #9EB0C1; }
    .size { font-size: 13px; font-weight: 700; fill: #9EB0C1; }
    .screen { font-size: 11px; font-weight: 750; letter-spacing: 1.2px; }
    .app { font-size: 12px; font-weight: 650; }
    .body { font-size: 18px; fill: #CBD6DF; }
    .hex { font-size: 12px; font-weight: 700; fill: #C7D3DE; }
  </style>
  <rect width="1800" height="1200" fill="#0B111A"/>
  <circle cx="1400" cy="120" r="500" fill="#193827" opacity=".3"/>
  <text x="74" y="72" class="kicker">ICON-ONLY DESIGN REVIEW · V3</text>
  <text x="74" y="135" class="title">LandOS — Spatial Data Overlay</text>
  <text x="74" y="176" class="subtitle">Layered parcel intelligence, analytical nodes and a dense topographic field.</text>
  <rect x="74" y="234" width="720" height="720" rx="54" fill="#121B27" stroke="#243141"/>
  ${maskedIcon(130, 290, 608, 134)}
  <text x="434" y="995" class="label" text-anchor="middle">IOS ROUNDED-SQUARE MASK · SQUARE SVG SOURCE</text>
  <text x="866" y="252" class="label">ACTUAL-SIZE READABILITY</text>
  ${maskedIcon(875, 300, 120, 27)}
  ${maskedIcon(1057, 330, 60, 14)}
  ${maskedIcon(1190, 344, 32, 7)}
  <text x="935" y="446" class="size" text-anchor="middle">120 px</text>
  <text x="1087" y="446" class="size" text-anchor="middle">60 px</text>
  <text x="1206" y="446" class="size" text-anchor="middle">32 px</text>
  <text x="866" y="535" class="label">COLOUR SYSTEM</text>
  <g transform="translate(875 575)">
    <rect width="118" height="58" rx="14" fill="#D4FC34"/><rect x="118" width="118" height="58" fill="#A3E635"/><rect x="236" width="118" height="58" fill="#10B981"/><rect x="354" width="118" height="58" fill="#172131"/><rect x="472" width="118" height="58" rx="0 14 14 0" fill="#0A111B"/>
    <text x="59" y="84" class="hex" text-anchor="middle">D4FC34</text><text x="177" y="84" class="hex" text-anchor="middle">A3E635</text><text x="295" y="84" class="hex" text-anchor="middle">10B981</text><text x="413" y="84" class="hex" text-anchor="middle">172131</text><text x="531" y="84" class="hex" text-anchor="middle">0A111B</text>
  </g>
  <text x="866" y="733" class="label">HOME-SCREEN CONTEXT</text>
  ${homeScreen(875, 774, false)}
  ${homeScreen(1262, 774, true)}
  <text x="74" y="1080" class="body">Three translucent land-data planes · active parcel boundaries · connected analysis nodes</text>
  <text x="74" y="1116" class="body">No numbers, pins, houses or surveying clip art. Topographic texture remains visible behind the full stack.</text>
</svg>`;

await writeFile(path.join(reviewDir, "spatial-data-overlay-v3-review-board.svg"), board);
await sharp(Buffer.from(board))
  .png({ compressionLevel: 9 })
  .toFile(path.join(previewDir, "spatial-data-overlay-v3-review-board.png"));

console.log("Generated Spatial Data Overlay v3 icon review assets.");

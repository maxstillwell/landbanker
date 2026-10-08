import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const reviewDir = path.join(root, "brand", "round-2");
const previewDir = path.join(reviewDir, "previews");
await mkdir(previewDir, { recursive: true });

const concepts = [
  {
    key: "a",
    file: "concept-a-signature-l.svg",
    title: "A — Signature L",
    subtitle: "A decisive L with a land-stratum cut",
    explanation: [
      "A premium, ownable letterform rather than a GIS symbol.",
      "The diagonal insert suggests ground layers without clip art.",
      "The coral terminal behaves like a software status accent.",
    ],
    palette: ["#111A3F", "#3348A5", "#F4F1E8", "#C9F36B", "#FF8662"],
    wordmark: "LandOS",
    wordmarkColor: "#111A3F",
    accentColor: "#3348A5",
  },
  {
    key: "b",
    file: "concept-b-landos-monogram.svg",
    title: "B — LandOS Monogram",
    subtitle: "Interlocking L + O with a bold product silhouette",
    explanation: [
      "The L anchors the open centre of a custom O.",
      "Overlap creates a memorable LO ligature, not typed initials.",
      "Soft mint and coral make the product feel modern and global.",
    ],
    palette: ["#24112F", "#6C2E79", "#C8F0DE", "#FF9A6B", "#F7F1E8"],
    wordmark: "LandOS",
    wordmarkColor: "#24112F",
    accentColor: "#6C2E79",
  },
  {
    key: "c",
    file: "concept-c-wordmark-icon.svg",
    title: "C — Wordmark Icon",
    subtitle: "The full name, rebuilt as a compact LAND / OS block",
    explanation: [
      "Custom modular letters make the brand name the icon itself.",
      "LAND remains clear at 60 px; OS carries recognition at 32 px.",
      "The warm field is intentionally unlike conventional GIS palettes.",
    ],
    palette: ["#FFB14A", "#F0523A", "#121B35", "#FFF4DD", "#FFFFFF"],
    wordmark: "LAND / OS",
    wordmarkColor: "#121B35",
    accentColor: "#F0523A",
  },
];

function dataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

for (const concept of concepts) {
  concept.svg = await readFile(path.join(reviewDir, concept.file), "utf8");
  concept.uri = dataUri(concept.svg);
  for (const size of [32, 60, 120, 1024]) {
    await sharp(Buffer.from(concept.svg))
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(previewDir, `concept-${concept.key}-${size}.png`));
  }
  const mask = Buffer.from(
    `<svg width="512" height="512"><rect width="512" height="512" rx="112" fill="white"/></svg>`,
  );
  await sharp(Buffer.from(concept.svg))
    .resize(512, 512)
    .composite([{ input: mask, blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(previewDir, `concept-${concept.key}-ios-mask.png`));
}

function palette(colors, x, y) {
  return colors
    .map(
      (color, index) =>
        `<g transform="translate(${x + index * 64} ${y})"><circle r="20" fill="${color}" stroke="#0D1830" stroke-opacity=".12"/><text y="43" text-anchor="middle" class="hex">${color.slice(1)}</text></g>`,
    )
    .join("");
}

function homeScreen(concept, x, y, dark) {
  const background = dark ? "#111522" : "#EEF1F6";
  const foreground = dark ? "#F4F6FA" : "#172033";
  const tile = dark ? "#2A3040" : "#DDE3EC";
  return `
    <g transform="translate(${x} ${y})">
      <rect width="306" height="218" rx="30" fill="${background}"/>
      <text x="22" y="31" fill="${foreground}" class="screen-label">${dark ? "DARK" : "LIGHT"} HOME SCREEN</text>
      <g fill="${tile}">
        <rect x="22" y="54" width="60" height="60" rx="14"/>
        <rect x="94" y="54" width="60" height="60" rx="14"/>
        <rect x="238" y="54" width="46" height="46" rx="12"/>
        <rect x="22" y="146" width="46" height="46" rx="12"/>
        <rect x="238" y="146" width="46" height="46" rx="12"/>
      </g>
      <clipPath id="home-${concept.key}-${dark ? "d" : "l"}"><rect x="166" y="54" width="60" height="60" rx="14"/></clipPath>
      <image href="${concept.uri}" x="166" y="54" width="60" height="60" clip-path="url(#home-${concept.key}-${dark ? "d" : "l"})"/>
      <text x="196" y="134" fill="${foreground}" class="app-name" text-anchor="middle">LandOS</text>
    </g>`;
}

function card(concept, index) {
  const x = 64 + index * 768;
  const clip = `card-icon-${concept.key}`;
  const sizes = [32, 60, 120];
  let sx = x + 82;
  const smallIcons = sizes
    .map((size) => {
      const centreY = 760;
      const item = `<g><clipPath id="size-${concept.key}-${size}"><rect x="${sx}" y="${centreY - size / 2}" width="${size}" height="${size}" rx="${Math.round(size * 0.22)}"/></clipPath><image href="${concept.uri}" x="${sx}" y="${centreY - size / 2}" width="${size}" height="${size}" clip-path="url(#size-${concept.key}-${size})"/><text x="${sx + size / 2}" y="842" class="size-label" text-anchor="middle">${size}px</text></g>`;
      sx += size + 66;
      return item;
    })
    .join("");
  return `
    <g>
      <rect x="${x}" y="180" width="736" height="1288" rx="34" fill="#FFFFFF" stroke="#DDE3EA"/>
      <text x="${x + 46}" y="240" class="concept-title">${concept.title}</text>
      <text x="${x + 46}" y="280" class="subtitle">${concept.subtitle}</text>
      <clipPath id="${clip}"><rect x="${x + 188}" y="320" width="360" height="360" rx="80"/></clipPath>
      <image href="${concept.uri}" x="${x + 188}" y="320" width="360" height="360" clip-path="url(#${clip})"/>
      <text x="${x + 368}" y="710" class="ios-label" text-anchor="middle">iOS MASKED PREVIEW · 1024 SOURCE</text>
      ${smallIcons}
      <g transform="translate(${x + 46} 902)">
        <rect width="54" height="54" rx="12" fill="${concept.accentColor}"/>
        <text x="78" y="39" fill="${concept.wordmarkColor}" class="wordmark">${concept.wordmark}</text>
      </g>
      ${palette(concept.palette, x + 66, 1012)}
      <text x="${x + 46}" y="1094" class="body">${concept.explanation[0]}</text>
      <text x="${x + 46}" y="1126" class="body">${concept.explanation[1]}</text>
      <text x="${x + 46}" y="1158" class="body">${concept.explanation[2]}</text>
      ${homeScreen(concept, x + 46, 1200, false)}
      ${homeScreen(concept, x + 384, 1200, true)}
    </g>`;
}

const board = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1540" viewBox="0 0 2400 1540" role="img" aria-labelledby="board-title board-desc">
  <title id="board-title">LandOS App Icon Redesign Round 2 comparison</title>
  <desc id="board-desc">Three substantially different typographic App Icon concepts shown at large and small sizes with light and dark iPhone home-screen previews</desc>
  <style>
    text { font-family: Inter, Arial, sans-serif; }
    .kicker { font-size: 17px; font-weight: 700; letter-spacing: 4px; fill: #53627A; }
    .board-title { font-size: 54px; font-weight: 780; letter-spacing: -2px; fill: #0D1830; }
    .board-note { font-size: 20px; fill: #657188; }
    .concept-title { font-size: 31px; font-weight: 760; fill: #0D1830; }
    .subtitle { font-size: 17px; fill: #66748B; }
    .ios-label, .size-label { font-size: 12px; font-weight: 700; letter-spacing: 1.4px; fill: #768298; }
    .wordmark { font-size: 34px; font-weight: 800; letter-spacing: -1px; }
    .hex { font-size: 9px; font-weight: 700; fill: #748096; }
    .body { font-size: 16px; fill: #46536A; }
    .screen-label { font-size: 10px; font-weight: 700; letter-spacing: 1.2px; }
    .app-name { font-size: 10px; font-weight: 600; }
  </style>
  <rect width="2400" height="1540" fill="#F3F5F8"/>
  <text x="64" y="66" class="kicker">DESIGN REVIEW · NO WINNER SELECTED</text>
  <text x="64" y="128" class="board-title">LandOS App Icon Redesign — Round 2</text>
  <text x="2336" y="118" class="board-note" text-anchor="end">Original vector concepts · 32 / 60 / 120 / 1024 px review</text>
  ${concepts.map(card).join("")}
</svg>`;

await writeFile(path.join(reviewDir, "comparison-board.svg"), board);
await sharp(Buffer.from(board))
  .png({ compressionLevel: 9 })
  .toFile(path.join(previewDir, "comparison-board.png"));

console.log("Generated LandOS Round 2 design-review previews.");

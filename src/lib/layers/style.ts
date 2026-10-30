import type { ExpressionSpecification } from "maplibre-gl";
import type { Indicator } from "./types";
export const THEMATIC_COLORS = [
  "#edf8e9",
  "#c7e9c0",
  "#a1d99b",
  "#74c476",
  "#31a354",
  "#006d2c",
];
export const NO_DATA_COLOR = "#858d94";
export function formatIndicator(
  value: unknown,
  unit: Indicator["unit"] = "count",
) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "No data";
  return unit === "aud"
    ? new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
        maximumFractionDigits: 0,
      }).format(value)
    : `${value.toLocaleString("en-AU", { maximumFractionDigits: unit === "percent" || unit === "rate" ? 1 : 0 })}${unit === "percent" ? "%" : ""}`;
}
export function thematicColor(indicator: Indicator): ExpressionSpecification {
  return [
    "case",
    ["==", ["get", "value"], null],
    NO_DATA_COLOR,
    [
      "step",
      ["to-number", ["get", "value"]],
      THEMATIC_COLORS[0],
      ...indicator.breaks.flatMap((v, i) => [v, THEMATIC_COLORS[i + 1]]),
    ],
  ] as ExpressionSpecification;
}
export function legendRanges(indicator: Indicator) {
  const format = (x: number) => formatIndicator(x, indicator.unit);
  return THEMATIC_COLORS.map((color, i) => ({
    color,
    label:
      i === 0
        ? `< ${format(indicator.breaks[0])}`
        : i === THEMATIC_COLORS.length - 1
          ? `≥ ${format(indicator.breaks[i - 1])}`
          : `${format(indicator.breaks[i - 1])} – < ${format(indicator.breaks[i])}`,
  }));
}

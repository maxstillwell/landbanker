import populationData from "./data/population.json";
import salesData from "./data/vic-sales.json";
import crimeData from "./data/vic-crime.json";
import seifaData from "./data/seifa.json";
import approvalsData from "./data/building-approvals.json";
import type { LayerProduct } from "./types";

const population = populationData as Record<
  string,
  { name: string; erp: (number | null)[] }
>;
const sales = salesData as Record<
  string,
  Record<string, Record<string, number | null>>
>;
const crime = crimeData as Record<
  string,
  Record<string, Record<string, number | null>>
>;
export function percentage(current: number | null, previous: number | null) {
  return current !== null && previous !== null && previous > 0
    ? (current / previous - 1) * 100
    : null;
}
export function statistic(
  product: LayerProduct,
  code: string,
  period: string,
  indicator: string,
) {
  const year = Number(period);
  if (product.query.statistics === "seifa") {
    const fields =
      (seifaData as Record<string, Record<string, number | null>>)[code] || {};
    return {
      value: fields[indicator] ?? null,
      fields,
      reference: "Census 2021",
      comparison: null,
    };
  }
  if (product.query.statistics === "approvals") {
    const fields =
      (approvalsData as Record<string, Record<string, number | null>>)[code] ||
      {};
    const erp = population[code]?.erp[24] ?? null;
    const value =
      indicator === "per_1000"
        ? fields.new_dwellings != null && erp != null && erp > 0
          ? (fields.new_dwellings / erp) * 1000
          : null
        : (fields[indicator] ?? null);
    return {
      value,
      fields: { ...fields, denominator_erp_30_june_2025: erp },
      reference: "Financial year 2025–26",
      comparison: null,
    };
  }
  if (product.query.statistics === "population") {
    const row = population[code];
    const at = (y: number) => row?.erp[y - 2001] ?? null;
    const current = at(year),
      previous = at(year - 1);
    const fields = {
      population: current,
      annual_change:
        current !== null && previous !== null ? current - previous : null,
      annual_growth: percentage(current, previous),
      five_year_growth: percentage(current, at(year - 5)),
      ten_year_growth: percentage(current, at(year - 10)),
    };
    const comparison =
      indicator === "five_year_growth"
        ? year - 5
        : indicator === "ten_year_growth"
          ? year - 10
          : indicator === "population"
            ? null
            : year - 1;
    return {
      value: fields[indicator as keyof typeof fields] ?? null,
      fields,
      reference: `30 June ${year}`,
      comparison: comparison ? `30 June ${comparison}` : null,
    };
  }
  const fields =
    (product.query.statistics === "sales" ? sales : crime)[code]?.[period] ||
    {};
  const value =
    indicator === "house_growth"
      ? percentage(
          fields.house ?? null,
          sales[code]?.[String(year - 1)]?.house ?? null,
        )
      : (fields[indicator] ?? null);
  return {
    value,
    fields,
    reference:
      product.query.statistics === "crime"
        ? `Year ending 30 June ${year}`
        : `Calendar year ${year}`,
    comparison:
      indicator === "house_growth" ? `Calendar year ${year - 1}` : null,
  };
}

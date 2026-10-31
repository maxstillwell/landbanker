import populationData from "./data/population.json";
import salesData from "./data/vic-sales.json";
import crimeData from "./data/vic-crime.json";
import seifaData from "./data/seifa.json";
import approvalsData from "./data/building-approvals.json";
import suburbPrices from "./data/vic-suburb-prices.json";
import suburbCrime from "./data/vic-suburb-crime.json";
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
): {
  value: number | null;
  fields: Record<string, unknown>;
  reference: string;
  comparison: string | null;
} {
  const year = Number(period);
  if (product.query.statistics === "suburb-sales") {
    const data = suburbPrices as Record<
      string,
      Record<string, Record<string, number | string | null>>
    >;
    const published = data[code]?.[period] || {};
    const fields = { ...published };
    for (const kind of ["house", "unit", "land"]) {
      if (published[kind + "_source_marker"] === "*") {
        fields[kind + "_published_carried_forward"] = published[kind];
        fields[kind] = null;
      }
    }
    const observed = (row: typeof fields, kind: string) =>
      row[kind + "_source_marker"] === "*"
        ? null
        : typeof row[kind] === "number"
          ? (row[kind] as number)
          : null;
    const value =
      indicator === "house_growth"
        ? percentage(
            observed(fields, "house"),
            observed(data[code]?.[String(year - 1)] || {}, "house"),
          )
        : observed(fields, indicator);
    return {
      value,
      fields,
      reference: `Calendar year ${period}`,
      comparison:
        indicator === "house_growth" ? `Calendar year ${year - 1}` : null,
    };
  }
  if (product.query.statistics === "suburb-crime") {
    const data = suburbCrime as Record<
      string,
      Record<string, Record<string, number | string[]>>
    >;
    const raw = data[code]?.[period] || {};
    const fields = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [
        k,
        Array.isArray(v) ? v.join(", ") : v,
      ]),
    );
    return {
      value:
        typeof raw[indicator] === "number" ? (raw[indicator] as number) : null,
      fields,
      reference: `Year ending 30 June ${period}`,
      comparison: null,
    };
  }
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

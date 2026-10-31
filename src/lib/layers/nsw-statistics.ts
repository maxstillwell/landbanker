import salesData from "./data/nsw-sales.json";
import rentData from "./data/nsw-rent.json";
import crimeData from "./data/nsw-crime.json";

type Observation = { value: number | null; source_marker: string | null };
type MarketRow = Record<string, Observation>;
type Area = { name: string; source_name: string; [period: string]: unknown };
const sales = salesData as Record<string, Area>;
const rent = rentData as Record<string, Area>;
const crime = crimeData as Record<string, Area>;

const saleOptions: Record<string, [string, string]> = {
  median_total: ["Total", "median"],
  median_non_strata: ["Non Strata", "median"],
  median_strata: ["Strata", "median"],
  sales_total: ["Total", "sales"],
  sales_non_strata: ["Non Strata", "sales"],
  sales_strata: ["Strata", "sales"],
  annual_change: ["Total", "annual_change"],
  quarterly_change: ["Total", "quarterly_change"],
};
const rentOptions: Record<string, [string, string]> = {
  median_all: ["Total / Total", "median"],
  median_house: ["House / Total", "median"],
  median_flat_unit: ["Flat/Unit / Total", "median"],
  median_house_3: ["House / 3 Bedrooms", "median"],
  median_flat_unit_2: ["Flat/Unit / 2 Bedrooms", "median"],
  new_bonds: ["Total / Total", "new_bonds"],
  total_bonds_held: ["Total / Total", "total_bonds_held"],
  annual_change: ["Total / Total", "annual_change"],
  quarterly_change: ["Total / Total", "quarterly_change"],
};

function quarterLabel(period: string, offset = 0) {
  const year = Number(period.slice(0, 4));
  const quarter = Number(period.at(-1)) - 1;
  const index = year * 4 + quarter + offset;
  return `${["March", "June", "September", "December"][((index % 4) + 4) % 4]} quarter ${Math.floor(index / 4)}`;
}

export function nswStatistic(
  kind: "nsw-sales" | "nsw-rent" | "nsw-crime",
  code: string,
  period: string,
  indicator: string,
) {
  if (kind === "nsw-crime") {
    const area = crime[code];
    const row = (area?.[period] || {}) as Record<string, number>;
    return {
      value: typeof row[indicator] === "number" ? row[indicator] : null,
      fields: {
        ...row,
        source_local_government_area: area?.source_name ?? null,
      },
      reference: `Year ending 30 June ${period}`,
      comparison: null,
    };
  }
  const area = (kind === "nsw-sales" ? sales : rent)[code];
  const [category, metric] = (kind === "nsw-sales" ? saleOptions : rentOptions)[
    indicator
  ] || ["", ""];
  const categories = area?.[period] as Record<string, MarketRow> | undefined;
  const row = categories?.[category] || {};
  const fieldNames =
    kind === "nsw-sales"
      ? {
          median: "median_price_aud",
          sales: "sales_count",
          annual_change: "annual_median_change_percent",
          quarterly_change: "quarterly_median_change_percent",
        }
      : {
          median: "median_weekly_rent_aud",
          new_bonds: "new_bonds_count",
          total_bonds_held: "total_bonds_held_count",
          annual_change: "annual_median_change_percent",
          quarterly_change: "quarterly_median_change_percent",
        };
  const fields: Record<string, unknown> = {
    source_local_government_area: area?.source_name ?? null,
    published_category: category,
  };
  for (const [source, name] of Object.entries(fieldNames)) {
    fields[name] = row[source]?.value ?? null;
    fields[name + "_source_marker"] = row[source]?.source_marker ?? null;
  }
  return {
    value: row[metric]?.value ?? null,
    fields,
    reference: quarterLabel(period),
    comparison:
      metric === "annual_change"
        ? quarterLabel(period, -4)
        : metric === "quarterly_change"
          ? quarterLabel(period, -1)
          : null,
  };
}

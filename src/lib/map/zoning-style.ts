// Display groups only: official codes remain the legal/provider identifiers.
export const ZONE_CATEGORIES = {
  residential: { label: "Residential", color: "#f2c94c" },
  commercial: { label: "Commercial / mixed use", color: "#f07868" },
  industrial: { label: "Industrial", color: "#af83d5" },
  rural: { label: "Rural / agriculture", color: "#8fbc63" },
  conservation: { label: "Conservation / open space", color: "#267350" },
  special: { label: "Special purpose", color: "#559bcf" },
  unknown: { label: "Other / unclassified", color: "#9ca3af" },
} as const;
export type ZoneCategory = keyof typeof ZONE_CATEGORIES;
export function zoneCategory(
  state: "VIC" | "NSW",
  input: unknown,
  description: unknown = "",
): ZoneCategory {
  const code = String(input ?? "")
    .trim()
    .toUpperCase()
    .split(/\s+/)[0];
  // Numeric suffixes indicate schedules/variants, not a new visual category.
  const vic = code.replace(/\d+$/, "");
  if (state === "VIC") {
    if (["GRZ", "NRZ", "RGZ", "LDRZ", "MUZ", "TZ"].includes(vic))
      return "residential";
    if (
      [
        "C1Z",
        "C2Z",
        "C3Z",
        "B1Z",
        "B2Z",
        "B3Z",
        "B4Z",
        "B5Z",
        "C1",
        "C2",
        "C3",
      ].includes(code) ||
      /^(C[123]Z|B[1-5]Z)\d*$/.test(code)
    )
      return "commercial";
    if (/^IN[123]Z\d*$/.test(code)) return "industrial";
    if (["FZ", "RLZ", "RAZ", "RZ", "GWZ", "GWAZ"].includes(vic)) return "rural";
    if (["PCRZ", "PPRZ", "RCZ"].includes(vic)) return "conservation";
    if (
      ["PUZ", "TRZ", "RDZ", "SUZ", "CDZ", "PDZ", "UGZ", "ACZ", "CA"].includes(
        vic,
      )
    )
      return "special";
  } else {
    if (/^R[1-5]$/.test(code) || code === "RU5") return "residential";
    if (/^E[1-5]$/.test(code)) {
      const label = String(description).toLowerCase();
      // Legacy environmental E zones coexist with employment E zones across EPIs.
      // Preserve ambiguity when the official description cannot disambiguate.
      if (/environment|conservation|national park/.test(label))
        return "conservation";
      if (/local centre|commercial centre/.test(label)) return "commercial";
      if (/productivity|industrial|employment/.test(label)) return "industrial";
      return "unknown";
    }
    if (/^B[1-8]$/.test(code) || code === "MU1") return "commercial";
    if (/^IN[1-4]$/.test(code)) return "industrial";
    if (["RU1", "RU2", "RU3", "RU4", "RU6"].includes(code)) return "rural";
    if (/^C[1-4]$/.test(code) || ["RE1", "RE2"].includes(code))
      return "conservation";
    if (/^(SP[1-5]|W[1-4])$/.test(code)) return "special";
  }
  return "unknown";
}
export function officialZoneCode(
  state: "VIC" | "NSW",
  properties: Record<string, unknown>,
) {
  // LAY_CLASS holds NSW zone codes; SYM_CODE is the provider's alternate symbol code.
  if (state === "VIC") return String(properties.ZONE_CODE ?? "");
  const codes = [properties.LAY_CLASS, properties.SYM_CODE];
  return String(
    codes.find((code) =>
      /^(R[1-5]|RU[1-6]|B[1-8]|IN[1-4]|C[1-4]|E[1-5]|MU1|RE[12]|SP[1-5]|W[1-4])(?:$|\s)/i.test(
        String(code ?? ""),
      ),
    ) ??
      properties.LAY_CLASS ??
      properties.SYM_CODE ??
      "",
  );
}

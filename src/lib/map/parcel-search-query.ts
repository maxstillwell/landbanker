import type { SupportedState } from "./parcel-types";

const roadTypes: Record<string, string> = {
  ST: "STREET",
  RD: "ROAD",
  AVE: "AVENUE",
  AV: "AVENUE",
  DR: "DRIVE",
  CT: "COURT",
  CRES: "CRESCENT",
  CR: "CRESCENT",
  HWY: "HIGHWAY",
  PL: "PLACE",
  PDE: "PARADE",
  TCE: "TERRACE",
  LN: "LANE",
  BLVD: "BOULEVARD",
};
const types = new Set([...Object.keys(roadTypes), ...Object.values(roadTypes)]);
const literal = (s: string) => `'${s.replaceAll("'", "''")}'`;
export function addressQueries(text: string, state: SupportedState): string[] {
  // Retain token boundaries; a unit number is not the street number.
  const cleaned = text
    .toUpperCase()
    .replace(/\b(?:UNIT|APT|APARTMENT|SUITE)\s+\d+[A-Z]?\s*[,/]?\s*/g, "")
    .replace(/^\s*\d+[A-Z]?\s*\/\s*(?=\d)/, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .trim();
  const tokens = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t !== state);
  if (!tokens.length) throw new Error("Enter an address or suburb.");
  const number = /^\d+[A-Z]?$/.test(tokens[0]) ? tokens.shift()! : null;
  const house = number
    ? state === "VIC"
      ? `HOUSE_NUMBER_1=${parseInt(number, 10)} AND `
      : `housenumber=${literal(number)} AND `
    : "";
  const normalized = tokens.map((t) => roadTypes[t] || t);
  const field = state === "VIC" ? "EZI_ADDRESS" : "address";
  const matching = normalized.filter((t) => !/^\d{4}$/.test(t));
  if (!matching.length) throw new Error("Include a street name or suburb.");
  const broad =
    house +
    matching.map((t) => `${field} LIKE ${literal(`%${t}%`)}`).join(" AND ");
  if (state === "NSW") return [broad];
  const typeIndex = tokens.findIndex((t) => types.has(t));
  if (typeIndex > 0) {
    const road = tokens.slice(0, typeIndex).join(" ");
    const locality = tokens
      .slice(typeIndex + 1)
      .filter((t) => !/^\d{4}$/.test(t))
      .join(" ");
    return [
      house +
        `ROAD_NAME=${literal(road)} AND ROAD_TYPE=${literal(normalized[typeIndex])}` +
        (locality ? ` AND LOCALITY_NAME LIKE ${literal(`${locality}%`)}` : ""),
      broad,
    ];
  }
  return [
    number
      ? house + `ROAD_NAME LIKE ${literal(`${tokens.join(" ")}%`)}`
      : `LOCALITY_NAME LIKE ${literal(`${tokens.join(" ")}%`)}`,
    broad,
  ];
}

export function parcelIdentifierQuery(
  text: string,
  state: SupportedState,
): string {
  const value = text.toUpperCase().trim().replace(/\s+/g, " ");
  const id = value.match(/^(PFI|CADID)\s*:?\s*(\d+)$/);
  if (
    id &&
    ((state === "VIC" && id[1] === "PFI") ||
      (state === "NSW" && id[1] === "CADID"))
  ) {
    if (state === "NSW" && !Number.isSafeInteger(Number(id[2])))
      throw new Error("Invalid CADID.");
    return state === "VIC"
      ? `PARCEL_PFI=${literal(id[2])}`
      : `cadid=${Number(id[2])}`;
  }
  const lot = value
    .replace(/^LOT\s+/, "")
    .match(/^(\d+[A-Z]?)\s*[/\\ ]\s*((?:DP|SP|PS|LP|TP|CP|RP)\s*\d+[A-Z]?)$/);
  if (lot) {
    const plan = lot[2].replaceAll(" ", "");
    if (state === "NSW" && /^(DP|SP)/.test(plan))
      return `lotnumber=${literal(lot[1])} AND planlabel=${literal(plan)}`;
    if (state === "VIC" && /^(PS|LP|TP|CP|RP|SP)/.test(plan))
      return `PARCEL_LOT_NUMBER=${literal(lot[1])} AND PARCEL_PLAN_NUMBER=${literal(plan)}`;
  }
  const spi = value.replace(/^SPI\s*:?\s*/, "");
  if (
    state === "VIC" &&
    /^[A-Z0-9]+\\(?:PS|LP|TP|CP|RP|SP)\d+[A-Z]?$/.test(spi)
  )
    return `PARCEL_SPI=${literal(spi)}`;
  throw new Error(
    state === "VIC"
      ? "Use PFI: number or lot/plan (for example 1/PS123456)."
      : "Use CADID: number or lot/plan (for example 1/DP123456).",
  );
}

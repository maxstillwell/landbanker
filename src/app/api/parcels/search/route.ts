import type { NextRequest } from "next/server";
import { z } from "zod";
import { workspaceContext } from "@/lib/workspace";
import { json, apiError } from "@/lib/api";
import {
  searchOfficialAddresses,
  searchOfficialParcelIdentifiers,
} from "@/lib/map/official-parcels";
export async function GET(request: NextRequest) {
  try {
    await workspaceContext();
    const q = z
      .string()
      .trim()
      .min(3)
      .max(120)
      .parse(request.nextUrl.searchParams.get("q"));
    const state = z
      .enum(["VIC", "NSW"])
      .parse(request.nextUrl.searchParams.get("state"));
    const mode = z
      .enum(["address", "identifier"])
      .parse(request.nextUrl.searchParams.get("mode") || "address");
    return json({
      results:
        mode === "address" ? await searchOfficialAddresses(q, state) : [],
      parcels:
        mode === "identifier"
          ? await searchOfficialParcelIdentifiers(q, state)
          : [],
      coverage:
        "VIC and NSW only. Source availability and address matching vary.",
    });
  } catch (e) {
    return apiError(e);
  }
}

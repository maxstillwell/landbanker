import type { NextRequest } from "next/server";
import { z } from "zod";
import { workspaceContext } from "@/lib/workspace";
import { json, apiError } from "@/lib/api";
import { searchOfficialAddresses } from "@/lib/map/official-parcels";
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
    return json({
      results: await searchOfficialAddresses(q, state),
      coverage:
        "VIC and NSW only. Source availability and address matching vary.",
    });
  } catch (e) {
    return apiError(e);
  }
}

import type { NextRequest } from "next/server";
import { workspaceContext } from "@/lib/workspace";
import { json, apiError } from "@/lib/api";
import { lookupOfficialParcels } from "@/lib/map/official-parcels";
import { parcelPoint } from "@/lib/map/parcel-input";
export async function GET(request: NextRequest) {
  try {
    await workspaceContext();
    const p = parcelPoint.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    return json({ parcels: await lookupOfficialParcels(p) });
  } catch (e) {
    return apiError(e);
  }
}

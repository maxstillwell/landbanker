import type { Observation, Parcel, SpatialLayer } from "@/lib/types";
import type { OfficialParcel } from "./parcel-types";
export type MapSelection =
  | { kind: "observation"; record: Observation }
  | { kind: "parcel"; record: Parcel }
  | { kind: "official-parcel"; record: OfficialParcel }
  | { kind: "drawing"; record: SpatialLayer; featureId: string }
  | null;

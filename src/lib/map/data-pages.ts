import type { MapData } from "@/lib/types";
export const MAP_PAGE_SIZE = 100;
export type MapPage = MapData & {
  pagination: {
    page: number;
    hasMore: Record<
      "parcels" | "observations" | "layers" | "savedViews",
      boolean
    >;
  };
};
export function mergeMapPages(pages: MapPage[]): MapData {
  const unique = <T extends { id: string }>(items: T[]) => [
    ...new Map(items.map((item) => [item.id, item])).values(),
  ];
  return {
    parcels: unique(pages.flatMap((p) => p.parcels)),
    observations: unique(pages.flatMap((p) => p.observations)),
    layers: unique(pages.flatMap((p) => p.layers)),
    savedViews: unique(pages.flatMap((p) => p.savedViews)),
  };
}

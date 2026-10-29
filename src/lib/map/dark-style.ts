import type { Map } from "maplibre-gl";
/** Restrained charcoal palette; the original vector sources, labels and attribution remain. */
export function polishDarkBasemap(map: Map) {
 for (const layer of map.getStyle().layers) {
  if (layer.id.startsWith("landos-") || layer.id.startsWith("official-")) continue;
  if(layer.type === "background") map.setPaintProperty(layer.id,"background-color","#182228");
  else if(layer.type === "fill") {
   const color=/water/i.test(layer.id)?"#203d4a":/building/i.test(layer.id)?"#35434a":/park|landcover|landuse/i.test(layer.id)?"#233430":null;
   if(color)map.setPaintProperty(layer.id,"fill-color",color);
  } else if(layer.type === "line" && /transportation|road|highway/i.test(layer.id)) map.setPaintProperty(layer.id,"line-color",/motorway|trunk/i.test(layer.id)?"#899284":"#4c6068");
  else if(layer.type === "symbol" && layer.layout?.["text-field"] && !/road|highway|shield/i.test(layer.id)) {map.setPaintProperty(layer.id,"text-color","#c8d5d7");map.setPaintProperty(layer.id,"text-halo-color","#182228");}
 }
}

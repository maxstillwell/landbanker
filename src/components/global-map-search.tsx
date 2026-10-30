"use client";
import { useEffect, useState } from "react";
import type { AddressResult, OfficialParcel } from "@/lib/map/parcel-types";
import type { Parcel, SpatialLayer } from "@/lib/types";
import { MapIcon } from "./map-icon";
import { timeoutFetch } from "@/lib/network";

type Place = { name: string; kind: string; latitude: number; longitude: number; authority: string };
type Result = { type: "address"; value: AddressResult } | { type: "parcel"; value: OfficialParcel };
export function GlobalMapSearch({ open, onOpenChange, properties, researchAreas, onAddress, onPlace, onParcel, onProperty, onResearchArea }: {
  open: boolean; onOpenChange:(open:boolean)=>void; properties: Parcel[]; researchAreas: SpatialLayer[]; onAddress: (value: AddressResult) => void; onPlace: (value: Place) => void;
  onParcel: (value: OfficialParcel) => void; onProperty: (value: Parcel) => void; onResearchArea: (value: SpatialLayer) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [partial, setPartial] = useState(false);
  useEffect(() => { const openSearch = () => onOpenChange(true); window.addEventListener("landos:focus-search", openSearch); return () => window.removeEventListener("landos:focus-search", openSearch); }, [onOpenChange]);
  useEffect(() => {
    const term = query.trim();
    if (!open || term.length < 3) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setBusy(true); setPartial(false);
      const modes = /\b(?:lot|plan|lp|dp)\b|\d+\s*\/\s*\d+/i.test(term) ? ["address", "identifier"] : ["address"];
      void timeoutFetch(`/api/places/search?${new URLSearchParams({ q: term })}`, { signal: controller.signal }, 12000).then(async (response) => { if (!response.ok) throw new Error("Places unavailable"); return response.json() as Promise<{ places: Place[] }>; }).then((body) => { if (!controller.signal.aborted) setPlaces(body.places); }).catch(() => { if (!controller.signal.aborted) setPartial(true); });
      void Promise.allSettled(["VIC", "NSW"].flatMap((state) => modes.map(async (mode) => {
        const response = await timeoutFetch(`/api/parcels/search?${new URLSearchParams({ q: term, state, mode })}`, { signal: controller.signal }, 12000);
        if (!response.ok) throw new Error("Search unavailable");
        return response.json() as Promise<{ results: AddressResult[]; parcels: OfficialParcel[] }>;
      }))).then((items) => {
        if (controller.signal.aborted) return;
        setPartial((previous) => previous || items.some((item) => item.status === "rejected"));
        setResults(items.flatMap((item) => item.status === "fulfilled" ? [...item.value.results.map((value) => ({ type: "address" as const, value })), ...item.value.parcels.map((value) => ({ type: "parcel" as const, value }))] : []).slice(0, 16));
        setBusy(false);
      });
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query,open]);
  const term = query.trim().toLowerCase();
  const savedProperties = term.length >= 2 ? properties.filter((item) => item.title.toLowerCase().includes(term)).slice(0, 8) : [];
  const savedResearch = term.length >= 2 ? researchAreas.filter((item) => item.name.toLowerCase().includes(term)).slice(0, 8) : [];
  function close() { onOpenChange(false); setQuery(""); setResults([]); setPlaces([]); }
  useEffect(()=>{if(!open)return;const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){onOpenChange(false);window.setTimeout(()=>Array.from(document.querySelectorAll<HTMLButtonElement>('[data-map-search-trigger]')).find(button=>button.getClientRects().length>0)?.focus(),0);}};window.addEventListener("keydown",escape);return()=>window.removeEventListener("keydown",escape);},[open,onOpenChange]);
  if(!open)return null;
  return <section className="global-search-panel" role="dialog" aria-label="Search the map"><div className="search-panel-heading"><strong>Search</strong><button aria-label="Close search" onClick={close}><MapIcon name="close"/></button></div><label>Find a location or saved object<input autoFocus value={query} maxLength={120} onChange={(event) => { setQuery(event.target.value); setResults([]); setPlaces([]); if (event.target.value.trim().length < 3) { setBusy(false); setPartial(false); } }} placeholder="Address, place, parcel or property" /></label>
      <small>Places: Geoscience Australia. Official addresses and parcels currently cover Victoria and NSW.</small>
      {busy && <p role="status">Searching…</p>}{partial && <p role="status">Some official search services are unavailable.</p>}
      {savedProperties.length > 0 && <section aria-label="Properties"><strong>Properties</strong>{savedProperties.map((item) => <button key={item.id} onClick={() => { onProperty(item); close(); }}>{item.title}<small>{item.address || "Saved property"}</small></button>)}</section>}
      {savedResearch.length > 0 && <section aria-label="Research Areas"><strong>Research Areas</strong>{savedResearch.map((item) => <button key={item.id} onClick={() => { onResearchArea(item); close(); }}>{item.name}<small>Saved research area</small></button>)}</section>}
      {places.length > 0 && <section aria-label="Australian places"><strong>Australian places</strong>{places.map((place, index) => <button key={`${place.name}-${index}`} onClick={() => { onPlace(place); close(); }}>{place.name}<small>{place.kind} · {place.authority}</small></button>)}</section>}
      {results.length > 0 && <section aria-label="Official results"><strong>Official results</strong>{results.map((item, index) => <button key={`${item.type}-${index}`} onClick={() => { if (item.type === "address") onAddress(item.value); else onParcel(item.value); close(); }}>{item.value.address || (item.type === "parcel" ? item.value.sourceId : "Address")}<small>{item.type === "parcel" ? "Parcel" : "Address"} · {item.value.state} · {item.value.source}</small></button>)}</section>}
      {term.length >= 3 && !busy && !results.length && !places.length && !savedProperties.length && !savedResearch.length && <p>No matches found.</p>}
  </section>;
}

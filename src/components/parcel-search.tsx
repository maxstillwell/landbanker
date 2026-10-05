"use client";
import { useState } from "react";
import type {
  AddressResult,
  OfficialParcel,
  SupportedState,
} from "@/lib/map/parcel-types";
import { timeoutFetch } from "@/lib/network";
export function ParcelSearch({
  onSelect,
  onAddress,
}: {
  onSelect: (p: OfficialParcel) => void;
  onAddress: (p: AddressResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SupportedState>("VIC");
  const [results, setResults] = useState<AddressResult[]>([]);
  const [parcels, setParcels] = useState<OfficialParcel[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function request(path: string) {
    const r = await timeoutFetch(path);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Official source unavailable");
    return d;
  }
  async function search() {
    setBusy(true);
    setMessage("");
    setParcels([]);
    try {
      const d = await request(
        `/api/parcels/search?${new URLSearchParams({ q: query, state })}`,
      );
      setResults(d.results);
      if (!d.results.length)
        setMessage("No official address match. Try a full street address.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }
  async function choose(address: AddressResult) {
    onAddress(address);
    setBusy(true);
    setMessage("");
    try {
      const d = await request(
        `/api/parcels/lookup?${new URLSearchParams({ ...address, latitude: String(address.latitude), longitude: String(address.longitude) })}`,
      );
      setParcels(d.parcels);
      if (d.parcels.length === 1) {
        onSelect(d.parcels[0]);
        setResults([]);
      } else if (!d.parcels.length)
        setMessage(
          "Address located; no official parcel boundary returned. This location has limited coverage.",
        );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Boundary unavailable");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="parcel-search">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label>
          State
          <select
            value={state}
            onChange={(e) => {
              setState(e.target.value as SupportedState);
              setResults([]);
              setParcels([]);
            }}
          >
            <option value="VIC">Victoria</option>
            <option value="NSW">New South Wales</option>
          </select>
        </label>
        <label>
          Search address
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Street address or suburb"
            minLength={3}
            maxLength={120}
            required
          />
        </label>
        <button disabled={busy} type="submit">
          {busy ? "Searching…" : "Search properties"}
        </button>
      </form>
      <small>
        Official VIC / NSW sources. Availability varies; other states are not
        supported yet.
      </small>
      {message ? <p role="status">{message}</p> : null}
      {results.map((a, i) => (
        <button
          className="record-row"
          disabled={busy}
          key={`${a.latitude}:${i}`}
          onClick={() => void choose(a)}
        >
          {a.address}
        </button>
      ))}
      {parcels.length > 1
        ? parcels.map((p) => (
            <button
              key={p.sourceId}
              className="record-row"
              onClick={() => onSelect(p)}
            >
              Lot {p.lot} · {p.plan} · {p.sourceId}
            </button>
          ))
        : null}
    </section>
  );
}

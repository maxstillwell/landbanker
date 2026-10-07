"use client";
import { useEffect, useState } from "react";
import type {
  AddressResult,
  OfficialParcel,
  SupportedState,
} from "@/lib/map/parcel-types";
import { timeoutFetch } from "@/lib/network";
import { formatArea } from "@/lib/map/measurement";
import {
  readRecentSearches,
  rememberSearch,
  type RecentSearch,
} from "@/lib/layer-draft";
export function ParcelSearch({
  userId,
  workspaceId,
  onSelect,
  onAddress,
}: {
  userId: string;
  workspaceId: string;
  onSelect: (p: OfficialParcel) => void;
  onAddress: (p: AddressResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"address" | "identifier">("address");
  const [state, setState] = useState<SupportedState>("VIC");
  const [results, setResults] = useState<AddressResult[]>([]);
  const [parcels, setParcels] = useState<OfficialParcel[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  useEffect(() => {
    let active = true;
    readRecentSearches(userId, workspaceId)
      .then((items) => {
        if (active) setRecent(items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId, workspaceId]);
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
    setResults([]);
    try {
      const d = await request(
        `/api/parcels/search?${new URLSearchParams({ q: query, state, mode })}`,
      );
      setResults(d.results);
      setParcels(d.parcels || []);
      try {
        setRecent(
          await rememberSearch(userId, workspaceId, {
            query,
            state,
            mode,
            searchedAt: Date.now(),
          }),
        );
      } catch {
        /* Search still works when device persistence is unavailable. */
      }
      if (!d.results.length && !d.parcels?.length)
        setMessage(
          "No official match. Check the state and address or parcel identifier.",
        );
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
          Search by
          <select
            value={mode}
            disabled={busy}
            onChange={(e) => {
              setMode(e.target.value as typeof mode);
              setResults([]);
              setParcels([]);
              setMessage("");
            }}
          >
            <option value="address">Address or suburb</option>
            <option value="identifier">Parcel identifier</option>
          </select>
        </label>
        <label>
          State
          <select
            value={state}
            disabled={busy}
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
          {mode === "address" ? "Search address" : "Parcel identifier"}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === "address"
                ? "Street address or suburb"
                : state === "VIC"
                  ? "PFI: number or lot/plan"
                  : "CADID: number or lot/plan"
            }
            minLength={3}
            maxLength={120}
            required
          />
        </label>
        <button disabled={busy} type="submit">
          {busy ? "Searching…" : "Search properties"}
        </button>
      </form>
      {recent.length ? (
        <details>
          <summary>Recent searches</summary>
          <small>Only on this device and in this account/workspace.</small>
          {recent.map((item) => (
            <button
              key={`${item.state}:${item.mode}:${item.query}`}
              className="record-row"
              disabled={busy}
              onClick={() => {
                setQuery(item.query);
                setState(item.state);
                setMode(item.mode);
                setResults([]);
                setParcels([]);
                setMessage("");
              }}
            >
              {item.query} · {item.state} ·{" "}
              {item.mode === "identifier" ? "Parcel identifier" : "Address"}
            </button>
          ))}
          <button
            disabled={busy}
            onClick={() =>
              void rememberSearch(userId, workspaceId, null)
                .then(setRecent)
                .catch(() =>
                  setMessage(
                    "Could not clear device search history. Try again.",
                  ),
                )
            }
          >
            Clear recent searches
          </button>
        </details>
      ) : null}
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
          <span>
            <strong>{a.address}</strong>
            <small>
              {a.state} · {a.source}{" "}
              {a.addressId ? `· Address/property ID ${a.addressId}` : ""}
            </small>
          </span>
        </button>
      ))}
      {parcels.length > 0
        ? parcels.map((p) => (
            <button
              key={p.sourceId}
              className="record-row"
              disabled={busy}
              onClick={() => onSelect(p)}
            >
              <span>
                <strong>{p.address || `Lot ${p.lot} · ${p.plan}`}</strong>
                <small>
                  {p.state} · {p.lot ? `Lot ${p.lot}` : "Lot not supplied"} ·{" "}
                  {p.plan || "Plan not supplied"}
                </small>
                {Number.isFinite(p.areaM2) && p.areaM2 > 0 ? (
                  <small>{formatArea(p.areaM2)}</small>
                ) : null}
                <small>
                  Parcel {p.sourceId} · {p.source}
                </small>
              </span>
            </button>
          ))
        : null}
    </section>
  );
}

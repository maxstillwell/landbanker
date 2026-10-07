"use client";
import { useState } from "react";
import { timeoutFetch } from "@/lib/network";
type Symbol = { label: string; image: string };
export function LayerLegend({ id }: { id: string }) {
  const [symbols, setSymbols] = useState<Symbol[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        disabled={busy || symbols !== null}
        onClick={async () => {
          setBusy(true);
          try {
            const response = await timeoutFetch(
              `/api/layer-library/${encodeURIComponent(id)}/legend`,
            );
            const data = await response.json();
            if (!response.ok)
              throw new Error(data.error || "Legend unavailable");
            setSymbols(data.symbols);
            setMessage(
              data.symbols.length
                ? ""
                : "Official provider has not supplied a supported legend.",
            );
          } catch (e) {
            setMessage(
              e instanceof Error ? e.message : "Legend unavailable. Try again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Loading legend…" : "Show legend"}
      </button>
      {message ? <p role="status">{message}</p> : null}
      {symbols?.map((symbol, i) => (
        <div className="legend-symbol" key={i}>
          <img src={symbol.image} alt="" width={24} height={24} />{" "}
          <span>{symbol.label}</span>
        </div>
      ))}
    </div>
  );
}

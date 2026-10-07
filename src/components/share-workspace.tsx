"use client";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/field-queue";
import { timeoutFetch } from "@/lib/network";
import { readShareUrls, storeShareUrl } from "@/lib/layer-draft";
type Summary = {
  name: string;
  parcels: number;
  layers: number;
  features: number;
  officialLayers: number;
  viewport: boolean;
};
type Share = {
  id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  resource_type: string;
  resource_ids: string[];
  manifest: {
    name?: string;
    parcel_ids?: string[];
    layer_ids?: string[];
    feature_ids?: Record<string, string[]>;
  };
};
export function ShareWorkspace({
  userId,
  workspaceId,
  views,
}: {
  userId: string;
  workspaceId: string;
  views: { id: string; name: string }[];
}) {
  const [shares, setShares] = useState<Share[]>([]),
    [urls, setUrls] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState(""),
    [preview, setPreview] = useState<{
      viewId: string;
      summary: Summary;
      scopeHash: string;
    } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [latest, setLatest] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const reload = useCallback(async () => {
    const response = await timeoutFetch("/api/shares");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Shares unavailable");
    setShares(data.shares);
    const stored = await readShareUrls(userId, workspaceId);
    setUrls((old) => ({ ...old, ...stored }));
  }, [userId, workspaceId]);
  useEffect(() => {
    let alive = true;
    void reload().catch((e) => {
      if (alive) setMessage(e.message);
    });
    return () => {
      alive = false;
    };
  }, [reload]);
  const viewId = chosen || views[0]?.id || "";
  return (
    <section className="share-management">
      <div className="section-label">SHARE MANAGEMENT</div>
      {views.length ? (
        <>
          <label>
            Saved View to share
            <select
              value={viewId}
              onChange={(e) => {
                setChosen(e.target.value);
                setPreview(null);
              }}
            >
              {views.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMessage("");
              try {
                const result = await apiRequest("/api/shares", {
                  resource_type: "saved_view",
                  resource_ids: [viewId],
                  dry_run: true,
                });
                setPreview({
                  viewId,
                  summary: result.summary,
                  scopeHash: result.scope_hash,
                });
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : "Scope unavailable",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Share view
          </button>
        </>
      ) : (
        <small>Save a map view to choose a share scope.</small>
      )}
      {preview ? (
        <div className="share-scope">
          <strong>This link will include:</strong>
          <ul>
            <li>✓ {preview.summary.parcels} selected properties</li>
            <li>
              ✓ {preview.summary.layers} selected user layers ·{" "}
              {preview.summary.features} current saved features, including
              features outside the viewport
            </li>
            <li>✓ {preview.summary.officialLayers} active official layers</li>
            <li>✓ Saved viewport</li>
            <li>✕ Private observations and photos</li>
            <li>✕ Private notes</li>
          </ul>
          <small>
            Read-only · expires in 7 days · current feature IDs frozen when
            created
          </small>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                // Reverify scope during create. The server is the authority, not this preview.
                const result = await apiRequest("/api/shares", {
                  resource_type: "saved_view",
                  resource_ids: [preview.viewId],
                  days: 7,
                  scope_hash: preview.scopeHash,
                });
                setLatest(result.url);
                setUrls((old) => ({ ...old, [result.id]: result.url }));
                try {
                  await storeShareUrl(
                    userId,
                    workspaceId,
                    result.id,
                    result.url,
                  );
                } catch {
                  setMessage(
                    "Link created. Copy it now; this device could not retain it.",
                  );
                }
                await reload();
                setPreview(null);
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : "Share creation failed",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Create read-only link
          </button>
        </div>
      ) : null}
      {latest ? (
        <p>
          <a href={latest} target="_blank" rel="noreferrer">
            New read-only link
          </a>
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      {shares.map((share) => {
        const active = !share.revoked_at && Date.parse(share.expires_at) > now;
        return (
          <div className="share-result" key={share.id}>
            <strong>{share.manifest.name || "Shared selection"}</strong>
            <small>
              Created {new Date(share.created_at).toLocaleDateString()} ·
              expires {new Date(share.expires_at).toLocaleString()} ·{" "}
              {share.revoked_at ? "Revoked" : active ? "Active" : "Expired"}
            </small>
            <p>
              {share.manifest.parcel_ids?.length || 0} properties ·{" "}
              {share.manifest.layer_ids?.length || 0} user layers · read-only
            </p>
            {active && urls[share.id] ? (
              <>
                <a href={urls[share.id]} target="_blank" rel="noreferrer">
                  Open shared view
                </a>
                <button
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(urls[share.id])
                      .then(() => setMessage("Link copied."))
                      .catch(() =>
                        setMessage(
                          "Copy unavailable. Open the link and copy its address.",
                        ),
                      )
                  }
                >
                  Copy link
                </button>
              </>
            ) : active ? (
              <small>
                The original link is available on the device where it was
                created. Create a replacement if needed.
              </small>
            ) : null}
            {active ? (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await apiRequest("/api/shares", { id: share.id }, "DELETE");
                    await reload();
                    setMessage("Share link revoked.");
                  } catch (e) {
                    setMessage(
                      e instanceof Error ? e.message : "Revoke failed",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Revoke link
              </button>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

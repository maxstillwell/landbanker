"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Position = { x: number; y: number };

/** Device-local widget position, constrained to the visible map surface. */
export function FloatingMapWidget({
  title,
  storageKey,
  children,
  initialPosition = { x: 20, y: 180 },
  initiallyExpanded = false,
}: {
  title: string;
  storageKey: string;
  children: ReactNode;
  initialPosition?: Position;
  initiallyExpanded?: boolean;
}) {
  const node = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    origin: Position;
  } | null>(null);
  const [position, setPosition] = useState<Position>(initialPosition);
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const initial = useRef(initialPosition);
  const [loadedKey, setLoadedKey] = useState("");
  const clamp = (p: Position): Position => {
    const el = node.current,
      parent = el?.parentElement;
    if (!el || !parent) return p;
    const map = parent.querySelector(".map-canvas") as HTMLElement | null;
    const bounds = map?.getBoundingClientRect();
    const sheet = parent.querySelector(".inspector")?.getBoundingClientRect();
    const height =
      bounds && sheet && sheet.top > bounds.top && sheet.top < bounds.bottom
        ? sheet.top - bounds.top
        : (bounds?.height ?? parent.clientHeight);
    const offset = bounds
      ? bounds.left - parent.getBoundingClientRect().left
      : 0;
    const header = parent.querySelector(".map-header")?.getBoundingClientRect();
    const minY = header ? Math.max(0, header.bottom - parent.getBoundingClientRect().top + 8) : 0;
    return {
      x: Math.max(
        offset,
        Math.min(
          p.x,
          offset +
            Math.max(0, (bounds?.width ?? parent.clientWidth) - el.offsetWidth),
        ),
      ),
      y: Math.max(minY, Math.min(p.y, Math.max(minY, height - el.offsetHeight))),
    };
  };
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y))
        setPosition(clamp(saved));
      // Opening the dock entry must expose the tools, even if the widget was
      // collapsed when it was last closed.
      if (!initiallyExpanded && typeof saved?.expanded === "boolean") setExpanded(saved.expanded);
    } catch {
      /* Local preference storage is optional. */
    }
    setLoadedKey(storageKey);
    const resize = () =>
      setPosition((p) => {
        const next = clamp(p);
        return next.x === p.x && next.y === p.y ? p : next;
      });
    const reset = () => {
      // The sidebar may be closing in the same React update. Clamp after its
      // resize, rather than against the stale, narrower map bounds.
      setPosition(initial.current);
      setExpanded(initiallyExpanded);
    };
    window.addEventListener("landos:reset-layout", reset);
    const observer = new ResizeObserver(resize);
    const parent = node.current?.parentElement;
    if (parent) {
      observer.observe(parent);
      const canvas = parent.querySelector(".map-canvas");
      const inspector = parent.querySelector(".inspector");
      const header = parent.querySelector(".map-header");
      if (canvas) observer.observe(canvas);
      if (inspector) observer.observe(inspector);
      if (header) observer.observe(header);
    }
    if (node.current) observer.observe(node.current);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("landos:reset-layout", reset);
      observer.disconnect();
    };
  }, [storageKey, initiallyExpanded]);
  useEffect(() => {
    if (loadedKey !== storageKey) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ ...position, expanded }),
      );
    } catch {
      /* Keep controls usable without device storage. */
    }
  }, [storageKey, position, expanded, loadedKey]);
  return (
    <div
      ref={node}
      className="floating-map-widget"
      style={{ left: position.x, top: position.y }}
    >
      <div className="floating-map-widget-header">
        <button
          type="button"
          className="floating-map-widget-handle"
          aria-label={`Move ${title}`}
          title="Drag or use arrow keys to move"
          onPointerDown={(event) => {
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = {
              pointer: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              origin: position,
            };
          }}
          onPointerMove={(event) => {
            const d = drag.current;
            if (!d || d.pointer !== event.pointerId) return;
            event.stopPropagation();
            setPosition(
              clamp({
                x: d.origin.x + event.clientX - d.x,
                y: d.origin.y + event.clientY - d.y,
              }),
            );
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={(event) => {
            const offsets: Record<string, Position> = {
              ArrowLeft: { x: -10, y: 0 },
              ArrowRight: { x: 10, y: 0 },
              ArrowUp: { x: 0, y: -10 },
              ArrowDown: { x: 0, y: 10 },
            };
            const delta = offsets[event.key];
            if (!delta) return;
            event.preventDefault();
            setPosition((p) => clamp({ x: p.x + delta.x, y: p.y + delta.y }));
          }}
        >
          ⠿
        </button>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {title}
        </button>
      </div>
      {expanded ? (
        <div className="floating-map-widget-content">{children}</div>
      ) : null}
    </div>
  );
}

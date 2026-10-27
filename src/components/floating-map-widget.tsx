"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Position = { x: number; y: number };

/** Device-local widget position, constrained to the visible map surface. */
export function FloatingMapWidget({
  title,
  storageKey,
  children,
}: {
  title: string;
  storageKey: string;
  children: ReactNode;
}) {
  const node = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    origin: Position;
  } | null>(null);
  const [position, setPosition] = useState<Position>({ x: 12, y: 90 });
  const [expanded, setExpanded] = useState(true);
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
    return {
      x: Math.max(
        0,
        Math.min(
          p.x,
          Math.max(0, (bounds?.width ?? parent.clientWidth) - el.offsetWidth),
        ),
      ),
      y: Math.max(0, Math.min(p.y, Math.max(0, height - el.offsetHeight))),
    };
  };
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y))
        setPosition(clamp(saved));
      if (typeof saved?.expanded === "boolean") setExpanded(saved.expanded);
    } catch {
      /* Local preference storage is optional. */
    }
    const resize = () => setPosition((p) => clamp(p));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [storageKey]);
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ ...position, expanded }),
      );
    } catch {
      /* Keep controls usable without device storage. */
    }
  }, [storageKey, position, expanded]);
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

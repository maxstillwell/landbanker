"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  readDrawingSession,
  writeDrawingSession,
  type DrawingSession,
} from "../layer-draft";
export function useDrawingSession(userId: string, workspaceId: string) {
  const [active, setActive] = useState<DrawingSession | null>(null);
  const [found, setFound] = useState<DrawingSession | null>(null);
  const [loadedScope, setLoadedScope] = useState("");
  const scope = `${userId}:${workspaceId}`;
  const [error, setError] = useState("");
  const ref = useRef<DrawingSession | null>(null);
  const writes = useRef(Promise.resolve());
  const store = useCallback(
    (draft: DrawingSession | null) => {
      writes.current = writes.current
        .catch(() => {})
        .then(() => writeDrawingSession(userId, workspaceId, draft));
      void writes.current.catch(() =>
        setError(
          "Drawing device storage unavailable. Keep this screen open until saved to Workspace.",
        ),
      );
      return writes.current;
    },
    [userId, workspaceId],
  );
  const update = useCallback(
    (value: DrawingSession | null) => {
      if (
        value &&
        (value.userId !== userId || value.workspaceId !== workspaceId)
      )
        throw new Error("Drawing scope mismatch");
      ref.current = value;
      setActive(value);
      return store(value);
    },
    [store, userId, workspaceId],
  );
  useEffect(() => {
    let mounted = true;
    ref.current = null;
    void readDrawingSession(userId, workspaceId)
      .then((value) => {
        if (mounted) {
          setFound(value);
          setLoadedScope(scope);
        }
      })
      .catch(() => {
        if (mounted) {
          setError("Drawing device storage unavailable.");
          setLoadedScope(scope);
        }
      });
    // Each edit is persisted immediately, not only during unload (iOS may skip unload).
    const flush = () => {
      if (ref.current) void store(ref.current);
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [userId, workspaceId, store, scope]);
  const change = useCallback(
    (patch: Partial<DrawingSession>, remember = false) => {
      const current = ref.current;
      if (
        !current ||
        current.userId !== userId ||
        current.workspaceId !== workspaceId
      )
        return;
      void update({
        ...current,
        ...patch,
        undo: remember ? current.points : current.undo,
        updatedAt: Date.now(),
      });
    },
    [update, userId, workspaceId],
  );
  return {
    active:
      active?.userId === userId && active.workspaceId === workspaceId
        ? active
        : null,
    found:
      found?.userId === userId && found.workspaceId === workspaceId
        ? found
        : null,
    ready: loadedScope === scope,
    error,
    ref,
    change,
    start: update,
    resume() {
      if (found) {
        void update(found);
        setFound(null);
      }
    },
    async discard() {
      await update(null);
      setFound(null);
    },
    undo() {
      const current = ref.current;
      if (current?.undo)
        void update({
          ...current,
          points: current.undo,
          undo: undefined,
          updatedAt: Date.now(),
        });
    },
  };
}

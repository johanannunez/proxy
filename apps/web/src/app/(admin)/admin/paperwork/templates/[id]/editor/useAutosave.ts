"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave. `serialize` returns the current HTML; `save` persists it.
 * Call `markDirty()` on real edits. `flush()` saves immediately (tab switch /
 * unload). Tracks the last-saved HTML so identical content is not re-sent.
 */
export function useAutosave({
  serialize,
  save,
  delay = 1500,
}: {
  serialize: () => string;
  save: (html: string) => Promise<{ ok: boolean }>;
  delay?: number;
}) {
  const [state, setState] = useState<SaveState>("idle");
  const lastSaved = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  const doSave = useCallback(async () => {
    const html = serialize();
    if (html === lastSaved.current) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setState("saving");
    const res = await save(html);
    inFlight.current = false;
    if (res.ok) {
      lastSaved.current = html;
      setState("saved");
    } else {
      setState("error");
    }
  }, [serialize, save]);

  const markDirty = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSave(), delay);
  }, [doSave, delay]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await doSave();
  }, [doSave]);

  /** Mark the current content as the saved baseline (call once after load). */
  const setBaseline = useCallback((html: string) => {
    lastSaved.current = html;
    setState("saved");
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { state, markDirty, flush, setBaseline };
}

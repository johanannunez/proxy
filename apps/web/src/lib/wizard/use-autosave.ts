"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Hook for localStorage auto-save on setup step forms.
 *
 * Saves form data to localStorage debounced at 500ms on every field change.
 * Key format: 'proxy:setup:v1:{stepKey}:{propertyId}'
 *
 * Usage:
 *   const { save, load, clear } = useAutoSave("wifi", propertyId);
 *   // On mount: const saved = load();
 *   // On field change: save(formData);
 *   // On successful server save: clear();
 */
export function useAutoSave(stepKey: string, propertyId?: string) {
  const key = `proxy:setup:v1:${stepKey}:${propertyId ?? "owner"}`;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (data: Record<string, unknown>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          const payload = {
            data,
            savedAt: new Date().toISOString(),
          };
          localStorage.setItem(key, JSON.stringify(payload));
        } catch {
          // localStorage might be full or unavailable
        }
      }, 500);
    },
    [key],
  );

  const load = useCallback((): {
    data: Record<string, unknown>;
    savedAt: string;
  } | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [key]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }, [key]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { save, load, clear };
}

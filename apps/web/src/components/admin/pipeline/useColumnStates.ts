'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ColumnState } from './pipeline-types';

const STORAGE_PREFIX = 'proxy.columnState.v1.';
const SYNC_EVENT = 'proxy:column-state-changed';

type StateMap = Record<string, ColumnState>;

function storageKey(boardKey: string): string {
  return `${STORAGE_PREFIX}${boardKey}`;
}

function readStored(boardKey: string): StateMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey(boardKey));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as StateMap;
    return {};
  } catch {
    return {};
  }
}

function writeStored(boardKey: string, next: StateMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(boardKey), JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent(SYNC_EVENT, { detail: { boardKey } }),
    );
  } catch {
    // quota or privacy-mode: ignore
  }
}

/**
 * Per-column show/collapse/hide state with localStorage persistence.
 *
 * - `boardKey` namespaces the persistence (e.g. 'contacts:lead-pipeline').
 * - `defaults` is the initial state for each column when the user has no
 *   stored preference.
 * - Multiple mount points (StatusBoard + ColumnsMenu) stay in sync via a
 *   custom window event broadcast on every write.
 */
export function useColumnStates(
  boardKey: string | undefined,
  defaults: StateMap,
): {
  stateOf: (columnKey: string) => ColumnState;
  setState: (columnKey: string, next: ColumnState) => void;
  reset: () => void;
} {
  const [overrides, setOverrides] = useState<StateMap>({});

  useEffect(() => {
    if (!boardKey) return;
    setOverrides(readStored(boardKey));
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ boardKey: string }>).detail;
      if (detail?.boardKey === boardKey) {
        setOverrides(readStored(boardKey));
      }
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, [boardKey]);

  const stateOf = useCallback(
    (columnKey: string): ColumnState => {
      if (overrides[columnKey]) return overrides[columnKey];
      return defaults[columnKey] ?? 'shown';
    },
    [overrides, defaults],
  );

  const setState = useCallback(
    (columnKey: string, next: ColumnState) => {
      setOverrides((prev) => {
        const updated = { ...prev, [columnKey]: next };
        if (boardKey) writeStored(boardKey, updated);
        return updated;
      });
    },
    [boardKey],
  );

  const reset = useCallback(() => {
    setOverrides({});
    if (boardKey && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(storageKey(boardKey));
        window.dispatchEvent(
          new CustomEvent(SYNC_EVENT, { detail: { boardKey } }),
        );
      } catch {
        // ignore
      }
    }
  }, [boardKey]);

  return { stateOf, setState, reset };
}

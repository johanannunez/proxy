'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'next/navigation';

type FiltersState = {
  sources: string[];
  assignees: string[];
  hiddenViews: string[];
};

type FiltersContextValue = FiltersState & {
  setSources: (next: string[]) => void;
  setAssignees: (next: string[]) => void;
  setHiddenViews: (next: string[]) => void;
  clear: () => void;
};

const ContactsFiltersContext = createContext<FiltersContextValue | null>(null);

export const UNASSIGNED_FILTER_KEY = '__unassigned__';

export function matchesAssigneeFilter(
  assignees: string[],
  rowAssignedTo: string | null,
): boolean {
  if (assignees.length === 0) return true;
  const wantsUnassigned = assignees.includes(UNASSIGNED_FILTER_KEY);
  if (wantsUnassigned && !rowAssignedTo) return true;
  if (rowAssignedTo && assignees.includes(rowAssignedTo)) return true;
  return false;
}

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function serialize(values: string[]): string | null {
  if (values.length === 0) return null;
  return values.join(',');
}

export function ContactsFiltersProvider({ children }: { children: ReactNode }) {
  const sp = useSearchParams();

  const [state, setState] = useState<FiltersState>(() => ({
    sources: parseList(sp?.get('source')),
    assignees: parseList(sp?.get('assignee')),
    hiddenViews: [],
  }));

  useEffect(() => {
    try {
      const stored = localStorage.getItem('proxy_contacts_hidden_views');
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed)) {
          setState((prev) => ({ ...prev, hiddenViews: parsed }));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // When URL changes externally (e.g. user clicks a saved-view tab), re-sync
  // local state from the URL. We guard this with a ref so our own
  // history.replaceState updates do not re-enter.
  const selfUpdateRef = useRef(false);
  const urlSources = sp?.get('source') ?? '';
  const urlAssignees = sp?.get('assignee') ?? '';
  useEffect(() => {
    if (selfUpdateRef.current) {
      selfUpdateRef.current = false;
      return;
    }
    setState((prev) => ({
      ...prev,
      sources: parseList(urlSources),
      assignees: parseList(urlAssignees),
    }));
  }, [urlSources, urlAssignees]);

  const syncUrl = useCallback((next: FiltersState) => {
    selfUpdateRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const src = serialize(next.sources);
    const asg = serialize(next.assignees);
    if (src) params.set('source', src);
    else params.delete('source');
    if (asg) params.set('assignee', asg);
    else params.delete('assignee');
    const query = params.toString();
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState(null, '', newUrl);
  }, []);

  const setSources = useCallback(
    (next: string[]) => {
      setState((prev) => {
        const updated = { ...prev, sources: next };
        syncUrl(updated);
        return updated;
      });
    },
    [syncUrl],
  );

  const setAssignees = useCallback(
    (next: string[]) => {
      setState((prev) => {
        const updated = { ...prev, assignees: next };
        syncUrl(updated);
        return updated;
      });
    },
    [syncUrl],
  );

  const setHiddenViews = useCallback((next: string[]) => {
    setState((prev) => ({ ...prev, hiddenViews: next }));
    try {
      localStorage.setItem('proxy_contacts_hidden_views', JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const clear = useCallback(() => {
    setState((prev) => {
      const updated = { ...prev, sources: [], assignees: [] };
      if (prev.sources.length === 0 && prev.assignees.length === 0) return prev;
      syncUrl(updated);
      return updated;
    });
  }, [syncUrl]);

  const value = useMemo<FiltersContextValue>(
    () => ({
      sources: state.sources,
      assignees: state.assignees,
      hiddenViews: state.hiddenViews,
      setSources,
      setAssignees,
      setHiddenViews,
      clear,
    }),
    [state.sources, state.assignees, state.hiddenViews, setSources, setAssignees, setHiddenViews, clear],
  );

  return (
    <ContactsFiltersContext.Provider value={value}>
      {children}
    </ContactsFiltersContext.Provider>
  );
}

export function useContactsFilters(): FiltersContextValue {
  const ctx = useContext(ContactsFiltersContext);
  if (!ctx) {
    throw new Error('useContactsFilters must be used inside ContactsFiltersProvider');
  }
  return ctx;
}

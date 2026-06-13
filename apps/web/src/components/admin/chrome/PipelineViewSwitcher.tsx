'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Kanban, List, MapTrifold } from '@phosphor-icons/react';
import { useSetTopBarSlots } from './TopBarSlotsContext';
import styles from './PipelineViewSwitcher.module.css';

export type PipelineViewMode = 'status' | 'compact' | 'map';

type TabDef = { key: PipelineViewMode; label: string; icon: React.ReactNode };

// URL param stays 'status' for the kanban mode so existing links keep working.
const TAB_DEFS: Record<PipelineViewMode, TabDef> = {
  status:  { key: 'status',  label: 'Kanban', icon: <Kanban     size={14} weight="duotone" /> },
  compact: { key: 'compact', label: 'List',   icon: <List       size={14} weight="duotone" /> },
  map:     { key: 'map',     label: 'Map',    icon: <MapTrifold size={14} weight="duotone" /> },
};

const DEFAULT_SUPPORTED: PipelineViewMode[] = ['status', 'compact'];

function Switcher({
  activeKey,
  tabs,
}: {
  activeKey: PipelineViewMode;
  tabs: TabDef[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const shellRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<CSSProperties>({ opacity: 0 });

  useLayoutEffect(() => {
    if (!shellRef.current) return;
    const active = shellRef.current.querySelector<HTMLElement>(`[data-key="${activeKey}"]`);
    if (!active) { setIndicator((p) => ({ ...p, opacity: 0 })); return; }
    const parentRect = shellRef.current.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    setIndicator({
      transform: `translateX(${rect.left - parentRect.left}px)`,
      width: `${rect.width}px`,
      opacity: 1,
    });
  }, [activeKey, tabs]);

  function navigate(mode: PipelineViewMode) {
    const params = new URLSearchParams(sp?.toString() ?? '');
    params.set('mode', mode);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div ref={shellRef} className={styles.switcher} role="tablist" aria-label="View mode">
      <span className={styles.indicator} style={indicator} aria-hidden />
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-key={tab.key}
            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
            onClick={() => navigate(tab.key)}
          >
            <span className={styles.icon} aria-hidden>{tab.icon}</span>
            <span className={styles.label}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Injects a Kanban/List/Map view switcher into the admin top bar center slot.
 * Pass `supported` to constrain which modes render for the current board.
 * If only one mode is supported, the switcher is hidden entirely.
 */
export function PipelineViewSwitcher({
  defaultMode = 'compact',
  supported = DEFAULT_SUPPORTED,
}: {
  defaultMode?: PipelineViewMode;
  supported?: PipelineViewMode[];
}) {
  const sp = useSearchParams();
  const urlMode = sp?.get('mode') as PipelineViewMode | null;
  const mode: PipelineViewMode =
    urlMode && supported.includes(urlMode) ? urlMode : defaultMode;

  const tabs = supported.map((k) => TAB_DEFS[k]);

  useSetTopBarSlots(
    () => ({
      centerSlot: tabs.length > 1 ? <Switcher activeKey={mode} tabs={tabs} /> : null,
    }),
     
    [mode, supported.join('|')],
  );

  return null;
}

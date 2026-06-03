'use client';

import { useState, useEffect } from 'react';
import styles from './DashboardCustomizer.module.css';

export type WidgetKey =
  | 'pipelinePulse'
  | 'coldLeads'
  | 'ownerActivity'
  | 'todaySchedule'
  | 'onboarding'
  | 'aiRiskDigest'
  | 'allocationHealth'
  | 'openInvoices'
  | 'recurringMaintenance'
  | 'projectBoard'
  | 'winbackQueue'
  | 'guestIntelligence';

const WIDGET_LABELS: Record<WidgetKey, { label: string; group: string }> = {
  pipelinePulse:        { label: 'Pipeline Pulse',        group: 'Pipeline' },
  coldLeads:            { label: 'Cold Leads Alert',       group: 'Pipeline' },
  ownerActivity:        { label: 'Owner Activity',         group: 'Pipeline' },
  onboarding:           { label: 'Onboarding Progress',    group: 'Pipeline' },
  todaySchedule:        { label: "Today's Schedule",       group: 'Operations' },
  recurringMaintenance: { label: 'Recurring Maintenance',  group: 'Operations' },
  projectBoard:         { label: 'Project Board',          group: 'Operations' },
  allocationHealth:     { label: 'Allocation Health',      group: 'Financial' },
  openInvoices:         { label: 'Open Invoices',          group: 'Financial' },
  aiRiskDigest:         { label: 'AI Risk Digest',         group: 'Intelligence' },
  winbackQueue:         { label: 'Winback Queue',          group: 'Intelligence' },
  guestIntelligence:    { label: 'Guest Intelligence',     group: 'Intelligence' },
};

const STORAGE_KEY = 'proxy:dashboard:widgets';
const ALL_KEYS = Object.keys(WIDGET_LABELS) as WidgetKey[];

function loadPrefs(): Record<WidgetKey, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<WidgetKey, boolean>>;
      const result = {} as Record<WidgetKey, boolean>;
      for (const k of ALL_KEYS) result[k] = parsed[k] !== false;
      return result;
    }
  } catch { /* ignore */ }
  const defaults = {} as Record<WidgetKey, boolean>;
  for (const k of ALL_KEYS) defaults[k] = true;
  return defaults;
}

export function useWidgetPrefs() {
  const [prefs, setPrefs] = useState<Record<WidgetKey, boolean>>(() => {
    const defaults = {} as Record<WidgetKey, boolean>;
    for (const k of ALL_KEYS) defaults[k] = true;
    return defaults;
  });

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const toggle = (key: WidgetKey) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  return { prefs, toggle };
}

type Props = {
  prefs: Record<WidgetKey, boolean>;
  onToggle: (key: WidgetKey) => void;
};

export function DashboardCustomizer({ prefs, onToggle }: Props) {
  const [open, setOpen] = useState(false);

  const groups = ['Pipeline', 'Operations', 'Financial', 'Intelligence'] as const;

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-label="Customize dashboard"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="1.5" fill="currentColor" />
          <circle cx="7" cy="2.5" r="1.5" fill="currentColor" />
          <circle cx="7" cy="11.5" r="1.5" fill="currentColor" />
        </svg>
        Customize
      </button>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Dashboard Widgets</span>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            <p className={styles.panelSubtitle}>Toggle widgets on or off to customize your view.</p>

            {groups.map((group) => {
              const groupKeys = ALL_KEYS.filter((k) => WIDGET_LABELS[k].group === group);
              return (
                <div key={group} className={styles.group}>
                  <div className={styles.groupLabel}>{group}</div>
                  {groupKeys.map((key) => (
                    <label key={key} className={styles.row}>
                      <span className={styles.widgetLabel}>{WIDGET_LABELS[key].label}</span>
                      <span
                        role="switch"
                        aria-checked={prefs[key]}
                        className={`${styles.toggle} ${prefs[key] ? styles.toggleOn : ''}`}
                        onClick={() => onToggle(key)}
                      >
                        <span className={styles.toggleKnob} />
                      </span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

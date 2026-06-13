'use client';

import { useEffect, useRef, useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import type { ColumnState } from './pipeline-types';
import { useColumnStates } from './useColumnStates';
import styles from './ColumnsMenu.module.css';

export function ColumnsMenu({
  boardKey,
  columns,
}: {
  boardKey: string;
  columns: Array<{ key: string; label: string; count: number; defaultState: ColumnState }>;
}) {
  const defaults = columns.reduce<Record<string, ColumnState>>((m, c) => {
    m[c.key] = c.defaultState;
    return m;
  }, {});

  const { stateOf, setState, reset } = useColumnStates(boardKey, defaults);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const hiddenCount = columns.filter((c) => stateOf(c.key) === 'hidden').length;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.pill} ${hiddenCount > 0 ? styles.pillActive : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Columns</span>
        {hiddenCount > 0 ? (
          <span className={styles.badge}>{hiddenCount}</span>
        ) : null}
        <CaretDown size={11} weight="bold" className={styles.caret} />
      </button>
      {open ? (
        <div className={styles.menu} role="menu">
          {columns.map((c) => {
            const s = stateOf(c.key);
            return (
              <div key={c.key} className={styles.row}>
                <span className={styles.label}>
                  {c.label}
                  <span className={styles.count}>{c.count}</span>
                </span>
                <div className={styles.stateGroup} role="radiogroup">
                  <StateBtn active={s === 'shown'} onClick={() => setState(c.key, 'shown')} title="Show full column">Show</StateBtn>
                  <StateBtn active={s === 'collapsed'} onClick={() => setState(c.key, 'collapsed')} title="Collapse to rail">Collapse</StateBtn>
                  <StateBtn active={s === 'hidden'} onClick={() => setState(c.key, 'hidden')} title="Hide from board">Hide</StateBtn>
                </div>
              </div>
            );
          })}
          <div className={styles.footer}>
            <button type="button" className={styles.resetBtn} onClick={reset}>
              Reset to defaults
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ColumnsList({
  boardKey,
  columns,
}: {
  boardKey: string;
  columns: Array<{ key: string; label: string; count: number; defaultState: ColumnState }>;
}) {
  const defaults = columns.reduce<Record<string, ColumnState>>((m, c) => {
    m[c.key] = c.defaultState;
    return m;
  }, {});

  const { stateOf, setState, reset } = useColumnStates(boardKey, defaults);

  return (
    <div className={styles.inlineList} role="group" aria-label="Columns">
      {columns.map((c) => {
        const s = stateOf(c.key);
        return (
          <div key={c.key} className={styles.row}>
            <span className={styles.label}>
              {c.label}
              <span className={styles.count}>{c.count}</span>
            </span>
            <div className={styles.stateGroup} role="radiogroup">
              <StateBtn active={s === 'shown'} onClick={() => setState(c.key, 'shown')} title="Show full column">Show</StateBtn>
              <StateBtn active={s === 'collapsed'} onClick={() => setState(c.key, 'collapsed')} title="Collapse to rail">Collapse</StateBtn>
              <StateBtn active={s === 'hidden'} onClick={() => setState(c.key, 'hidden')} title="Hide from board">Hide</StateBtn>
            </div>
          </div>
        );
      })}
      <div className={styles.footer}>
        <button type="button" className={styles.resetBtn} onClick={reset}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

function StateBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      title={title}
      className={`${styles.stateBtn} ${active ? styles.stateBtnActive : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

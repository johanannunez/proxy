'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  getDaysInMonth,
  getDay,
  parseISO,
  isToday,
  isSameDay,
  isValid,
} from 'date-fns';
import styles from './DatePickerInput.module.css';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function calcPosition(rect: DOMRect) {
  const W = 280;
  const H = 320;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = rect.bottom + 6;
  let left = rect.left;
  if (left + W > vw - 8) left = Math.max(8, vw - W - 8);
  if (top + H > vh - 8) top = Math.max(8, rect.top - H - 6);
  return { top, left };
}

export function DatePickerInput({ value, onChange, placeholder = 'Pick a date' }: Props) {
  const parsedValue = value ? parseISO(value) : null;
  const validSelected = parsedValue && isValid(parsedValue) ? parsedValue : null;

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => validSelected ?? new Date());
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (validSelected) setViewDate(validSelected);
  }, [value]);

  useEffect(() => {
    if (open && anchorRef.current) {
      setPos(calcPosition(anchorRef.current.getBoundingClientRect()));
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !anchorRef.current?.contains(e.target as Node) &&
        !popoverRef.current?.contains(e.target as Node)
      ) setOpen(false);
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 60);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleSelect = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
    setOpen(false);
  };

  const displayValue = validSelected ? format(validSelected, 'MMM d, yyyy') : '';

  const monthStart = startOfMonth(viewDate);
  const daysInMonth = getDaysInMonth(viewDate);
  const startDow = getDay(monthStart);

  const cells: Array<Date | null> = [
    ...Array<null>(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewDate.getFullYear(), viewDate.getMonth(), i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={displayValue ? styles.triggerValue : styles.triggerPlaceholder}>
          {displayValue || placeholder}
        </span>
        <CalendarBlank size={14} className={styles.icon} />
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          className={styles.popover}
          style={{ top: pos.top, left: pos.left }}
          role="dialog"
          aria-label="Choose date"
        >
          <div className={styles.nav}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => setViewDate((d) => subMonths(d, 1))}
              aria-label="Previous month"
            >
              <CaretLeft size={12} weight="bold" />
            </button>
            <span className={styles.monthLabel}>{format(viewDate, 'MMMM yyyy')}</span>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => setViewDate((d) => addMonths(d, 1))}
              aria-label="Next month"
            >
              <CaretRight size={12} weight="bold" />
            </button>
          </div>

          <div className={styles.weekdays}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <span key={d} className={styles.weekday}>{d}</span>
            ))}
          </div>

          <div className={styles.grid}>
            {cells.map((date, i) => {
              if (!date) return <span key={i} />;
              const isSelected = validSelected ? isSameDay(date, validSelected) : false;
              const isTodayDate = isToday(date);
              return (
                <button
                  key={i}
                  type="button"
                  className={`${styles.day}${isSelected ? ` ${styles.daySelected}` : ''}${isTodayDate && !isSelected ? ` ${styles.dayToday}` : ''}`}
                  onClick={() => handleSelect(date)}
                  aria-label={format(date, 'MMMM d, yyyy')}
                  aria-pressed={isSelected}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {value && (
            <div className={styles.popoverFooter}>
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => { onChange(''); setOpen(false); }}
              >
                Clear
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

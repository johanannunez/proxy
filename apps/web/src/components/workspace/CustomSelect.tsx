"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";

export type SelectOption = { value: string; label: string };
export type SelectGroup = { label: string; options: SelectOption[] };

interface CustomSelectProps {
  /** Controlled value. Use alongside onChange. */
  value?: string;
  /** Uncontrolled initial value. Use for plain HTML form submission. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** For plain HTML form submission — renders a hidden input with this name. */
  name?: string;
  id?: string;
  /** Flat list of options. Provide either options or groups, not both. */
  options?: SelectOption[];
  /** Grouped list of options (replaces native optgroup). */
  groups?: SelectGroup[];
  placeholder?: string;
  hasError?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Pass through for accessibility (aria-invalid). */
  "aria-invalid"?: boolean;
  /** Pass through for accessibility (aria-describedby). */
  "aria-describedby"?: string;
}

function flattenGroups(groups: SelectGroup[]): SelectOption[] {
  return groups.flatMap((g) => g.options);
}

function findLabel(
  value: string,
  options?: SelectOption[],
  groups?: SelectGroup[],
): string {
  const flat = options ?? (groups ? flattenGroups(groups) : []);
  return flat.find((o) => o.value === value)?.label ?? value;
}

export function CustomSelect({
  value: controlledValue,
  defaultValue,
  onChange,
  name,
  id,
  options,
  groups,
  placeholder = "Select...",
  hasError,
  disabled,
  required,
  "aria-describedby": ariaDescribedby,
}: CustomSelectProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState<string>(
    defaultValue ?? options?.[0]?.value ?? groups?.[0]?.options?.[0]?.value ?? "",
  );
  const current = isControlled ? (controlledValue ?? "") : internalValue;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function handleSelect(val: string) {
    if (!isControlled) setInternalValue(val);
    onChange?.(val);
    setOpen(false);
  }

  const displayLabel = current
    ? findLabel(current, options, groups)
    : placeholder;

  const allOptions = options ?? (groups ? flattenGroups(groups) : []);

  return (
    <div ref={ref} className="relative">
      {/* Hidden input for plain HTML form submission */}
      {name ? (
        <input type="hidden" name={name} value={current} required={required} />
      ) : null}

      {/* Trigger */}
      <button
        type="button"
        id={id}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-describedby={ariaDescribedby}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          backgroundColor: open
            ? "rgba(2, 170, 235, 0.04)"
            : "var(--color-white)",
          borderColor: hasError
            ? "#ef4444"
            : open
              ? "var(--color-brand)"
              : "var(--color-warm-gray-200)",
          color: current ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
          boxShadow: open ? "0 0 0 3px rgba(2, 170, 235, 0.12)" : "none",
        }}
      >
        <span className="truncate">{displayLabel}</span>
        <CaretDown
          size={12}
          weight="bold"
          className="shrink-0 transition-transform duration-150"
          style={{
            color: "var(--color-text-tertiary)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Dropdown panel */}
      {open ? (
        <div
          className="scrollbar-hide absolute left-0 right-0 z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl border py-1 shadow-lg"
          style={{
            backgroundColor: "var(--color-white)",
            borderColor: "var(--color-warm-gray-200)",
            boxShadow:
              "0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 32px -4px rgba(0,0,0,0.10)",
          }}
          role="listbox"
          aria-label={id}
        >
          {/* Flat options */}
          {options
            ? options.map((opt) => (
                <OptionRow
                  key={opt.value}
                  option={opt}
                  isSelected={opt.value === current}
                  onSelect={handleSelect}
                />
              ))
            : null}

          {/* Grouped options */}
          {groups
            ? groups.map((group) => (
                <div key={group.label}>
                  <div
                    className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {group.label}
                  </div>
                  {group.options.map((opt) => (
                    <OptionRow
                      key={opt.value}
                      option={opt}
                      isSelected={opt.value === current}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              ))
            : null}

          {/* Empty state */}
          {allOptions.length === 0 ? (
            <div
              className="px-3 py-2 text-sm"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              No options
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function OptionRow({
  option,
  isSelected,
  onSelect,
}: {
  option: SelectOption;
  isSelected: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={() => onSelect(option.value)}
      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors duration-75"
      style={{
        backgroundColor: isSelected ? "rgba(2, 170, 235, 0.06)" : undefined,
        color: isSelected ? "var(--color-brand)" : "var(--color-text-primary)",
      }}
      onMouseEnter={(e) => {
        if (!isSelected)
          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
            "var(--color-warm-gray-50, #fafaf9)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected)
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "";
      }}
    >
      <span>{option.label}</span>
      {isSelected ? (
        <Check
          size={12}
          weight="bold"
          style={{ color: "var(--color-brand)", flexShrink: 0 }}
        />
      ) : null}
    </button>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlass,
  ArrowRight,
  House,
  Buildings,
  CalendarBlank,
  Wallet,
  ClipboardText,
  Gear,
  DownloadSimple,
} from "@phosphor-icons/react";
import { activeSetupSearchIndex as setupSearchIndex } from "@/lib/wizard/search-index";
import { usePwaInstall } from "@/hooks/usePwaInstall";

type Result = {
  id: string;
  label: string;
  description?: string;
  href: string;
  category: string;
  icon?: React.ReactNode;
  onSelect?: () => void | Promise<void>;
};

const portalPages: Result[] = [
  {
    id: "nav-dashboard",
    label: "Home",
    href: "/workspace/home",
    category: "Go to...",
    icon: <House size={16} weight="duotone" />,
  },
  {
    id: "nav-properties",
    label: "Properties",
    href: "/workspace/properties",
    category: "Go to...",
    icon: <Buildings size={16} weight="duotone" />,
  },
  {
    id: "nav-reserve",
    label: "Reserve",
    href: "/workspace/reserve",
    category: "Go to...",
    icon: <CalendarBlank size={16} weight="duotone" />,
  },
  {
    id: "nav-payouts",
    label: "Payouts",
    href: "/workspace/payouts",
    category: "Go to...",
    icon: <Wallet size={16} weight="duotone" />,
  },
  {
    id: "nav-setup",
    label: "Setup",
    href: "/workspace/setup",
    category: "Go to...",
    icon: <ClipboardText size={16} weight="duotone" />,
  },
];

const setupStepResults: Result[] = setupSearchIndex.map((step) => ({
  id: `step-${step.stepKey}`,
  label: step.label,
  description: step.group,
  href: step.href,
  category: "Setup steps",
  icon: <Gear size={16} weight="duotone" />,
}));

function matchScore(query: string, result: Result): number {
  const q = query.toLowerCase();
  const label = result.label.toLowerCase();

  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.includes(q)) return 60;

  // Check keywords from search index
  const step = setupSearchIndex.find(
    (s) => `step-${s.stepKey}` === result.id,
  );
  if (step) {
    for (const kw of step.keywords) {
      if (kw.toLowerCase().includes(q)) return 40;
    }
  }

  if (result.description?.toLowerCase().includes(q)) return 30;
  return 0;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // PWA install action — always offered so users can install or reinstall.
  const pwa = usePwaInstall();
  const installResult = useMemo<Result | null>(() => {
    if (pwa.status === "checking") return null;
    const base: Result = {
      id: "action-install-webapp",
      label: "Install Proxy as a web app on this device",
      description: "Add a home screen shortcut. Nothing is downloaded.",
      href: "/workspace/account#install",
      category: "Actions",
      icon: <DownloadSimple size={16} weight="duotone" />,
    };
    if (pwa.status === "available") {
      return {
        ...base,
        onSelect: async () => {
          await pwa.promptInstall();
        },
      };
    }
    return base;
  }, [pwa]);

  // Build results
  const allResults = useMemo(
    () => [
      ...(installResult ? [installResult] : []),
      ...portalPages,
      ...setupStepResults,
    ],
    [installResult],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) {
      // Show suggested + go-to pages + actions when no query
      return [
        ...portalPages.slice(0, 3).map((r) => ({
          ...r,
          category: "Suggested",
        })),
        ...portalPages,
        ...(installResult ? [installResult] : []),
      ];
    }

    const scored = allResults
      .map((r) => ({ result: r, score: matchScore(query, r) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.map((s) => s.result);
  }, [query, allResults, installResult]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, Result[]>();
    for (const r of filtered) {
      const existing = map.get(r.category) ?? [];
      existing.push(r);
      map.set(r.category, existing);
    }
    return [...map.entries()];
  }, [filtered]);

  const flatResults = filtered;

  // Clamp active index
  useEffect(() => {
    if (activeIndex >= flatResults.length) {
      setActiveIndex(Math.max(0, flatResults.length - 1));
    }
  }, [flatResults.length, activeIndex]);

  const activate = useCallback(
    (result: Result) => {
      setOpen(false);
      if (result.onSelect) {
        void result.onSelect();
      } else {
        router.push(result.href);
      }
    },
    [router],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatResults[activeIndex]) {
      e.preventDefault();
      activate(flatResults[activeIndex]);
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  let flatIdx = -1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Panel */}
      <div className="fixed inset-x-0 top-[15vh] z-50 mx-auto w-full max-w-lg px-4">
        <div
          className="overflow-hidden rounded-2xl border"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            backgroundColor: "var(--color-white)",
            boxShadow: "0 16px 48px rgba(0, 0, 0, 0.15)",
          }}
        >
          {/* Search input */}
          <div
            className="flex items-center gap-3 border-b px-4 py-3"
            style={{ borderColor: "var(--color-warm-gray-200)" }}
          >
            <MagnifyingGlass
              size={18}
              weight="bold"
              style={{ color: "var(--color-text-tertiary)" }}
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search pages, setup steps, properties..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
              style={{ color: "var(--color-text-primary)" }}
              aria-label="Search"
            />
            <kbd
              className="hidden rounded border px-1.5 py-0.5 text-[10px] font-medium sm:inline-block"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-tertiary)",
              }}
            >
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div
            ref={listRef}
            className="max-h-80 overflow-y-auto py-2"
            role="listbox"
          >
            {flatResults.length === 0 ? (
              <p
                className="px-4 py-6 text-center text-sm"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                No results for &ldquo;{query}&rdquo;
              </p>
            ) : (
              grouped.map(([category, items]) => (
                <div key={category}>
                  <p
                    className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {category}
                  </p>
                  {items.map((item) => {
                    flatIdx++;
                    const isActive = flatIdx === activeIndex;
                    const currentIdx = flatIdx;
                    return (
                      <button
                        key={`${item.category}-${item.id}`}
                        role="option"
                        aria-selected={isActive}
                        data-active={isActive}
                        onClick={() => activate(item)}
                        onMouseEnter={() => setActiveIndex(currentIdx)}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors"
                        style={{
                          backgroundColor: isActive
                            ? "rgba(2, 170, 235, 0.06)"
                            : "transparent",
                          color: isActive
                            ? "#1b77be"
                            : "var(--color-text-primary)",
                        }}
                      >
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center"
                          style={{
                            color: isActive
                              ? "#02aaeb"
                              : "var(--color-text-tertiary)",
                          }}
                        >
                          {item.icon ?? (
                            <ArrowRight size={14} weight="bold" />
                          )}
                        </span>
                        <span className="flex-1 truncate font-medium">
                          {item.label}
                        </span>
                        {item.description && (
                          <span
                            className="shrink-0 text-xs"
                            style={{
                              color: "var(--color-text-tertiary)",
                            }}
                          >
                            {item.description}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div
            className="flex items-center justify-between border-t px-4 py-2"
            style={{ borderColor: "var(--color-warm-gray-200)" }}
          >
            <span
              className="text-[11px]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Navigate with arrow keys, Enter to select
            </span>
            <div className="flex gap-1">
              <kbd
                className="rounded border px-1 py-0.5 text-[10px] font-medium"
                style={{
                  borderColor: "var(--color-warm-gray-200)",
                  color: "var(--color-text-tertiary)",
                }}
              >
                ↑↓
              </kbd>
              <kbd
                className="rounded border px-1 py-0.5 text-[10px] font-medium"
                style={{
                  borderColor: "var(--color-warm-gray-200)",
                  color: "var(--color-text-tertiary)",
                }}
              >
                ↵
              </kbd>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Trigger button for the sidebar */
export function CommandPaletteTrigger() {
  const [, setOpen] = useState(false);

  function handleClick() {
    // Dispatch Cmd+K to open the palette
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
    setOpen(true);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-warm-gray-50)]"
      style={{ color: "var(--color-text-secondary)" }}
    >
      <span
        className="inline-flex h-5 w-5 items-center justify-center"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <MagnifyingGlass size={18} weight="duotone" />
      </span>
      <span className="flex-1 text-left">Search</span>
      <kbd
        className="hidden rounded border px-1.5 py-0.5 text-[10px] font-medium sm:inline-block"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          color: "var(--color-text-tertiary)",
        }}
      >
        ⌘K
      </kbd>
    </button>
  );
}

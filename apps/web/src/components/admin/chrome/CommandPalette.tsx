"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  MagnifyingGlass,
  X,
  CheckSquare,
  CalendarBlank,
  House,
  UserCircle,
  AddressBook,
  Kanban,
  UsersThree,
  Buildings,
  Sparkle,
  ArrowRight,
  ListChecks,
  ClockCounterClockwise,
  Wallet,
  ChatCircle,
  Files,
  FileDashed,
  type Icon,
} from "@phosphor-icons/react";
import type {
  PaletteHit,
  PaletteScope,
  PaletteSearchResponse,
} from "@/lib/admin/palette-search";
import styles from "./CommandPalette.module.css";

/* ───── Static Create + Suggested data ───── */

type CreateKind =
  | "task" | "email" | "meeting" | "note"
  | "property" | "invoice" | "contact" | "workspace" | "project";

type CreateItem = {
  id: string;
  label: string;
  icon: Icon;
  kbd: string;
  createKind: CreateKind;
};

const CREATE_ITEMS: CreateItem[] = [
  { id: "c-task",     label: "Task",     icon: CheckSquare,     kbd: "T", createKind: "task" },
  { id: "c-contact",  label: "Person",   icon: AddressBook,     kbd: "C", createKind: "contact" },
  { id: "c-workspace", label: "Workspace", icon: Buildings,     kbd: "W", createKind: "workspace" },
  { id: "c-project",  label: "Project",  icon: Kanban,          kbd: "J", createKind: "project" },
];

type SuggestedItem = { id: string; label: string; icon: Icon; href: string };
const SUGGESTED_ITEMS: SuggestedItem[] = [
  { id: "s-onboarding", label: "Finish onboarding for 1431 Jadwin", icon: Sparkle,    href: "/admin/properties" },
  { id: "s-payouts",    label: "Review this month's payouts",       icon: Wallet,     href: "/admin/payouts" },
  { id: "s-tasks",      label: "Open tasks across all properties",  icon: ListChecks, href: "/admin/tasks" },
];

/* ───── Result kind to icon and group label ───── */

const KIND_META: Record<PaletteHit["kind"], { icon: Icon; group: string }> = {
  contact:  { icon: AddressBook, group: "People"     },
  owner:    { icon: UserCircle,  group: "Workspaces" },
  property: { icon: Buildings,   group: "Properties" },
  task:     { icon: CheckSquare, group: "Tasks"      },
  project:  { icon: Kanban,      group: "Projects"   },
  document: { icon: Files,       group: "Documents"  },
  template: { icon: FileDashed,  group: "Templates"  },
};

const GROUP_ORDER: Array<keyof PaletteSearchResponse> = [
  "contacts",
  "owners",
  "properties",
  "tasks",
  "projects",
  "documents",
  "templates",
];

/* ───── Recent tracking (localStorage) ───── */

const RECENT_KEY = "proxy.admin.recent";
const RECENT_LIMIT = 8;

type RecentEntry = { href: string; label: string; icon: string; at: number };

function readRecents(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

function writeRecent(entry: RecentEntry) {
  if (typeof window === "undefined") return;
  try {
    const existing = readRecents().filter((r) => r.href !== entry.href);
    const next = [entry, ...existing].slice(0, RECENT_LIMIT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

const ICON_REGISTRY: Record<string, Icon> = {
  House, ChatCircle, ListChecks, UsersThree, Buildings, Kanban,
  CalendarBlank, ClockCounterClockwise, Wallet, UserCircle, AddressBook,
};

function labelFromPathname(pathname: string): { label: string; icon: string } | null {
  const segs = pathname.split("/").filter(Boolean);
  if (segs[0] !== "admin") return null;
  if (segs.length === 1) return { label: "Dashboard", icon: "House" };

  const map: Record<string, { label: string; icon: string }> = {
    inbox:      { label: "Inbox",      icon: "ChatCircle" },
    tasks:      { label: "Tasks",      icon: "ListChecks" },
    workspaces: { label: "Workspaces", icon: "UserCircle" },
    people:     { label: "People",     icon: "UsersThree" },
    prospects:  { label: "Prospects",  icon: "AddressBook" },
    properties: { label: "Properties", icon: "Buildings" },
    projects:   { label: "Projects",   icon: "Kanban" },
    calendar:   { label: "Calendar",   icon: "CalendarBlank" },
    finances:   { label: "Finances",   icon: "Wallet" },
    meetings:   { label: "Meetings",   icon: "CalendarBlank" },
    timeline:   { label: "Timeline",   icon: "ClockCounterClockwise" },
    payouts:    { label: "Payouts",    icon: "Wallet" },
  };

  const base = map[segs[1]];
  if (!base) return null;
  if (segs.length >= 3) return { label: `${base.label.replace(/s$/, "")} detail`, icon: base.icon };
  return base;
}

/* ───── Route → scope ───── */

function scopeFromPath(pathname: string): PaletteScope | null {
  const segs = pathname.split("/").filter(Boolean);
  if (segs[0] !== "admin" || segs.length < 2) return null;
  if (segs.length > 2) return null; // detail pages — skip scope list for now
  const section = segs[1];
  const map: Record<string, PaletteScope> = {
    people:     "contacts",
    prospects:  "contacts",
    workspaces: "owners",
    properties: "properties",
    tasks:      "tasks",
    projects:   "projects",
  };
  return map[section] ?? null;
}

function scopeHeader(scope: PaletteScope): { label: string; icon: Icon } {
  const m: Record<PaletteScope, { label: string; icon: Icon }> = {
    contacts:   { label: "In People",     icon: UsersThree },
    owners:     { label: "In Workspaces", icon: UserCircle },
    properties: { label: "In Properties", icon: Buildings  },
    tasks:      { label: "In Tasks",      icon: ListChecks },
    projects:   { label: "In Projects",   icon: Kanban     },
    all:        { label: "Results",       icon: MagnifyingGlass },
  };
  return m[scope];
}

/* ───── Main component ───── */

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [isMac, setIsMac] = useState(true);
  const [results, setResults] = useState<PaletteSearchResponse>({
    contacts: [], owners: [], properties: [], tasks: [], projects: [],
    documents: [], templates: [],
  });
  const [scopeList, setScopeList] = useState<PaletteHit[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scope = useMemo(() => scopeFromPath(pathname), [pathname]);

  useEffect(() => {
    setMounted(true);
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform));
  }, []);

  /* Track pathname → localStorage recent */
  useEffect(() => {
    const entry = labelFromPathname(pathname);
    if (!entry) return;
    writeRecent({ href: pathname, label: entry.label, icon: entry.icon, at: Date.now() });
  }, [pathname]);

  /* Load recents on open */
  useEffect(() => {
    if (open) setRecents(readRecents().filter((r) => r.href !== pathname));
  }, [open, pathname]);

  /* Global open/close keyboard + event */
  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    const customHandler = () => setOpen(true);
    window.addEventListener("keydown", keyHandler);
    window.addEventListener("admin:palette-open", customHandler);
    return () => {
      window.removeEventListener("keydown", keyHandler);
      window.removeEventListener("admin:palette-open", customHandler);
    };
  }, [open]);

  /* Focus input on open, reset on close */
  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
    setQuery("");
    setActiveIndex(0);
    setResults({
      contacts: [], owners: [], properties: [], tasks: [], projects: [],
      documents: [], templates: [],
    });
  }, [open]);

  /* Bulletproof scroll lock via position: fixed */
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  /* Load scope list when opening on a list page, with no query */
  useEffect(() => {
    if (!open) return;
    if (query.trim().length > 0) return;
    if (!scope) {
      setScopeList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/palette-search?scope=${encodeURIComponent(scope)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as PaletteSearchResponse;
        if (cancelled) return;
        const list =
          scope === "contacts"   ? data.contacts :
          scope === "owners"     ? data.owners :
          scope === "properties" ? data.properties :
          scope === "tasks"      ? data.tasks :
          scope === "projects"   ? data.projects :
          [];
        setScopeList(list);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [open, query, scope]);

  /* Debounced global search */
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 1) {
      setResults({
        contacts: [], owners: [], properties: [], tasks: [], projects: [],
        documents: [], templates: [],
      });
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(
          `/api/admin/palette-search?q=${encodeURIComponent(q)}`,
          { cache: "no-store", signal: ctrl.signal },
        );
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as PaletteSearchResponse;
        setResults(data);
      } catch (err: unknown) {
        if ((err as { name?: string } | null)?.name !== "AbortError") {
          setResults({
            contacts: [], owners: [], properties: [], tasks: [], projects: [],
            documents: [], templates: [],
          });
        }
      } finally {
        setSearching(false);
      }
    }, 150);
    return () => window.clearTimeout(handle);
  }, [query, open]);

  /* Reset cursor when results change */
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const typing = query.trim().length > 0;

  const recentItems = useMemo(() => recents.slice(0, 6), [recents]);

  /* Build keyboard list for middle column */
  const centerFlat: Array<{ label: string; run: () => void }> = useMemo(() => {
    if (typing) {
      const flat: Array<{ label: string; run: () => void }> = [];
      for (const key of GROUP_ORDER) {
        for (const hit of results[key]) {
          flat.push({ label: hit.label, run: () => router.push(hit.href) });
        }
      }
      return flat;
    }
    const flat: Array<{ label: string; run: () => void }> = [];
    for (const s of SUGGESTED_ITEMS) {
      flat.push({ label: s.label, run: () => router.push(s.href) });
    }
    for (const r of recentItems) {
      flat.push({ label: r.label, run: () => router.push(r.href) });
    }
    return flat;
  }, [typing, results, recentItems, router]);

  const close = useCallback(() => setOpen(false), []);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(centerFlat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = centerFlat[activeIndex];
      if (item) {
        item.run();
        close();
      }
    }
  };

  const runCreate = (kind: CreateKind) => {
    window.dispatchEvent(new CustomEvent("admin:create-open", { detail: { kind } }));
    close();
  };

  const goTo = (href: string) => {
    router.push(href);
    close();
  };

  if (!mounted || !open) return null;

  const totalResults =
    results.contacts.length +
    results.owners.length +
    results.properties.length +
    results.tasks.length +
    results.projects.length +
    results.documents.length +
    results.templates.length;

  const palette = (
    <div
      className={styles.scrim}
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className={styles.inputRow}>
          <MagnifyingGlass size={16} weight="duotone" className={styles.inputIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Search people, Workspaces, properties, tasks, documents, templates"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            aria-label="Command palette query"
          />
          <kbd className={styles.inputKbd} aria-hidden>
            <span>{isMac ? "\u2318" : "Ctrl"}</span>
            <span>K</span>
          </kbd>
          <button type="button" className={styles.closeBtn} aria-label="Close palette" onClick={close}>
            <X size={12} weight="bold" />
          </button>
        </div>

        <div className={`${styles.body} ${scope ? styles.bodyThree : styles.bodyTwo}`}>
          {/* Left: Create (dark navy rail) */}
          <div className={`${styles.col} ${styles.colCreate}`}>
            <div className={styles.sectionLabel}>Create</div>
            <ul className={styles.list}>
              {CREATE_ITEMS.map((item) => (
                <li key={item.id}>
                  <button type="button" className={styles.row} onClick={() => runCreate(item.createKind)}>
                    <span className={styles.rowIcon}>
                      <item.icon size={14} weight="duotone" />
                    </span>
                    <span className={styles.rowLabel}>{item.label}</span>
                    <span className={styles.rowKbd}>{item.kbd}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Middle: Suggested and Recent idle state or grouped results while typing */}
          <div className={styles.col}>
            {typing ? (
              <GroupedResults
                results={results}
                activeIndex={activeIndex}
                searching={searching}
                totalResults={totalResults}
                onRun={(hit) => goTo(hit.href)}
                setActiveIndex={setActiveIndex}
              />
            ) : (
              <IdleCenter
                activeIndex={activeIndex}
                setActiveIndex={setActiveIndex}
                recentItems={recentItems}
                onRun={goTo}
              />
            )}
          </div>

          {/* Right: context list scoped to the current page, persists while typing */}
          {scope ? (
            <ScopeColumn scope={scope} list={scopeList} onRun={goTo} />
          ) : null}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerCluster}><kbd>\u2191\u2193</kbd><span>navigate</span></span>
          <span className={styles.footerCluster}><kbd>\u21B5</kbd><span>select</span></span>
          <span className={styles.footerCluster}><kbd>esc</kbd><span>close</span></span>
          <span className={styles.footerSpacer} />
          <span className={styles.footerHint}>
            {typing
              ? (searching ? "Searching…" : `${totalResults} result${totalResults === 1 ? "" : "s"}`)
              : "Suggestions · Recent"}
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(palette, document.body);
}

/* ───── Idle center column (Suggested + Recent) ───── */

function IdleCenter({
  activeIndex,
  setActiveIndex,
  recentItems,
  onRun,
}: {
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  recentItems: RecentEntry[];
  onRun: (href: string) => void;
}) {
  return (
    <>
      <div className={styles.sectionLabel}>Suggested</div>
      <ul className={styles.list}>
        {SUGGESTED_ITEMS.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              className={`${styles.row} ${styles.rowWrap} ${activeIndex === i ? styles.rowActive : ""}`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => onRun(item.href)}
            >
              <span className={styles.rowIconAccent}>
                <item.icon size={14} weight="duotone" />
              </span>
              <span className={styles.rowLabel}>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.sectionLabel} style={{ marginTop: 12 }}>Recent</div>
      {recentItems.length === 0 ? (
        <div className={styles.empty}>Pages you visit will show up here.</div>
      ) : (
        <ul className={styles.list}>
          {recentItems.map((item, i) => {
            const idx = SUGGESTED_ITEMS.length + i;
            const Icon = ICON_REGISTRY[item.icon] ?? ArrowRight;
            return (
              <li key={item.href}>
                <button
                  type="button"
                  className={`${styles.row} ${activeIndex === idx ? styles.rowActive : ""}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => onRun(item.href)}
                >
                  <span className={styles.rowIcon}>
                    <Icon size={14} weight="duotone" />
                  </span>
                  <span className={styles.rowLabel}>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/* ───── Grouped search results ───── */

function GroupedResults({
  results,
  activeIndex,
  searching,
  totalResults,
  onRun,
  setActiveIndex,
}: {
  results: PaletteSearchResponse;
  activeIndex: number;
  searching: boolean;
  totalResults: number;
  onRun: (hit: PaletteHit) => void;
  setActiveIndex: (i: number) => void;
}) {
  if (searching && totalResults === 0) {
    return (
      <>
        <div className={styles.sectionLabel}>Searching</div>
        <div className={styles.shimmerRow} />
        <div className={styles.shimmerRow} />
        <div className={styles.shimmerRow} />
      </>
    );
  }
  if (totalResults === 0) {
    return <div className={styles.empty}>No matches. Try another word.</div>;
  }

  let idx = 0;
  return (
    <>
      {GROUP_ORDER.map((key) => {
        const hits = results[key];
        if (hits.length === 0) return null;
        const meta = KIND_META[hits[0].kind];
        return (
          <div key={key} className={styles.group}>
            <div className={styles.sectionLabel}>{meta.group}</div>
            <ul className={styles.list}>
              {hits.map((hit) => {
                const mine = idx++;
                return (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className={`${styles.row} ${styles.rowWithSub} ${mine === activeIndex ? styles.rowActive : ""}`}
                      onMouseEnter={() => setActiveIndex(mine)}
                      onClick={() => onRun(hit)}
                    >
                      <span className={styles.rowIcon}>
                        <meta.icon size={14} weight="duotone" />
                      </span>
                      <span className={styles.rowStack}>
                        <span className={styles.rowLabel}>{hit.label}</span>
                        {hit.subtitle ? <span className={styles.rowSub}>{hit.subtitle}</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </>
  );
}

/* ───── Right column: scope list ───── */

function ScopeColumn({
  scope,
  list,
  onRun,
}: {
  scope: PaletteScope;
  list: PaletteHit[];
  onRun: (href: string) => void;
}) {
  const header = scopeHeader(scope);
  return (
    <div className={`${styles.col} ${styles.colContext}`}>
      <div className={styles.contextHeader}>
        <header.icon size={14} weight="duotone" />
        <span>{header.label}</span>
      </div>
      {list.length === 0 ? (
        <div className={styles.empty}>Nothing to show yet.</div>
      ) : (
        <ul className={styles.list}>
          {list.map((hit) => {
            const meta = KIND_META[hit.kind];
            return (
              <li key={hit.id}>
                <button
                  type="button"
                  className={`${styles.row} ${styles.rowWithSub}`}
                  onClick={() => onRun(hit.href)}
                >
                  <span className={styles.rowIcon}>
                    <meta.icon size={14} weight="duotone" />
                  </span>
                  <span className={styles.rowStack}>
                    <span className={styles.rowLabel}>{hit.label}</span>
                    {hit.subtitle ? <span className={styles.rowSub}>{hit.subtitle}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ───── Helper for other triggers to dispatch open ───── */

export function openCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("admin:palette-open"));
  }
}

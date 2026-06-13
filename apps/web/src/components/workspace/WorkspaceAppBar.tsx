"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Copy, Eye, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import { NotificationBell } from "@/components/workspace/NotificationBell";
import { useWorkspaceHeaderOverride } from "@/components/workspace/WorkspaceHeaderContext";
import { useTheme } from "@/components/ThemeProvider";
import { setViewingAs, clearViewingAs } from "@/app/(workspace)/workspace/viewing-as-actions";

/**
 * Workspace app bar.
 *
 * Brand-blue gradient bar with white title + 1-line subtitle on the left,
 * action pill (route-specific) + search pill + bell on the right. The bar
 * is rendered for every portal route. Pages should NOT render their own
 * `<PageHeader>` because the bar IS the page header.
 *
 * IMPORTANT: All "white" colors are hardcoded literal `#ffffff` (or
 * `rgba(255,255,255,...)`) instead of Tailwind's `text-white` / `bg-white`
 * classes. The worktree's globals.css redefines `--color-white: #141414`
 * inside `.dark`, and Tailwind v4's `text-white` / `bg-white` reference
 * `var(--color-white)`, so they would flip to BLACK in dark mode. Hardcoded
 * literals stay white regardless of theme.
 *
 * Subtitles must be short. Long copy is truncated. Edit `getWorkspaceHeader`
 * to tighten any string.
 */

type WorkspaceHeader = {
  title: string;
  subtitle?: ReactNode;
  action?: { href: string; label: string };
  copyable?: boolean;
};

export type OwnerOption = {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function getWorkspaceHeader(
  pathname: string | null,
  firstName: string,
): WorkspaceHeader | null {
  if (!pathname) return null;

  if (pathname === "/workspace/home") {
    return {
      title: `${getGreeting()}, ${firstName}.`,
      subtitle: "Properties, documents, and messages, all in one view.",
    };
  }

  if (pathname === "/workspace/properties") {
    return {
      title: "Your properties",
      subtitle: "Every home under Proxy management.",
    };
  }

  if (pathname.startsWith("/workspace/properties/")) {
    return {
      title: "Property details",
      subtitle: "Bookings, documents, and listing information.",
    };
  }

  if (pathname === "/workspace/documents") {
    return {
      title: "Documents",
      subtitle: "Signed agreements, tax forms, and uploaded files.",
    };
  }

  if (pathname === "/workspace/reserve") {
    return {
      title: "Reserve",
      subtitle:
        "Bookings, blocked dates, and owner stays across your portfolio.",
    };
  }

  if (pathname === "/workspace/cleaning-checklist") {
    return {
      title: "Cleaning checklist",
      subtitle:
        "The standards every Proxy home meets between guests. Use this if you're cleaning the home yourself.",
    };
  }

  if (pathname === "/workspace/tasks") {
    return {
      title: "Tasks",
      subtitle: "Action items and to-dos from your Proxy team.",
    };
  }

  if (pathname === "/workspace/timeline") {
    return {
      title: "Timeline",
      subtitle: "A history of activity on your account and properties.",
    };
  }

  if (pathname === "/workspace/meetings") {
    return {
      title: "Meetings",
      subtitle: "Notes and summaries from your conversations with Proxy.",
    };
  }

  if (pathname === "/workspace/team") {
    return {
      title: "Team",
      subtitle: "Your Proxy team and the people on your account.",
    };
  }

  if (pathname === "/workspace/finances") {
    return {
      title: "Finances",
      subtitle: "Your finance and revenue summary.",
    };
  }

  if (pathname === "/workspace/inbox") {
    return {
      title: "Inbox",
      subtitle: "Conversations with the Proxy team and important updates.",
    };
  }

  if (pathname === "/workspace/notifications") {
    return {
      title: "Notifications",
      subtitle: "Recent activity and alerts from your portfolio.",
    };
  }

  if (pathname === "/workspace/hospitable") {
    return {
      title: "Hospitable",
      subtitle: "Bookings, revenue, calendar, and guest messages.",
    };
  }

  if (pathname === "/workspace/account") {
    return {
      title: "Account",
      subtitle: "Your profile, security, and preferences.",
    };
  }

  if (pathname.startsWith("/workspace/setup")) {
    return {
      title: "Setup",
      subtitle: "Get your property ready for guests.",
    };
  }

  return null;
}

export function WorkspaceAppBar({
  firstName,
  owners,
  viewingAsUserId,
}: {
  firstName: string;
  owners?: OwnerOption[];
  viewingAsUserId?: string | null;
}) {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const override = useWorkspaceHeaderOverride();
  const routeHeader = getWorkspaceHeader(pathname, firstName);
  // Override from a mounted page wins over the pathname-based lookup. This
  // lets dynamic pages (e.g. /portal/properties/[id]) set the bar title
  // with data the shell doesn't have. Route-specific actions (like the
  // "Add property" pill on /portal/properties) are kept from the route
  // lookup so overrides don't accidentally blow them away.
  const header: WorkspaceHeader | null = override
    ? {
        title: override.title,
        subtitle: override.subtitle,
        action: routeHeader?.action,
        copyable: override.copyable,
      }
    : routeHeader;
  const isDark = resolvedTheme === "dark";

  return (
    <header
      className="sticky top-0 z-20 border-b"
      style={{
        backgroundColor: isDark ? "#141414" : "#1b77be",
        borderColor: isDark
          ? "rgba(255, 255, 255, 0.08)"
          : "rgba(255, 255, 255, 0.18)",
      }}
    >
      <div
        className={
          header
            ? "mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6 sm:py-[18px] lg:px-10"
            : "mx-auto flex max-w-6xl items-center justify-end gap-6 px-4 py-2.5 sm:px-6 lg:px-10"
        }
      >
        {/* Left: title (+ optional copy button) + single-line subtitle */}
        {header ? (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1
                className="min-w-0 truncate text-[22px] font-semibold leading-tight tracking-[-0.012em]"
                style={{ color: "#ffffff" }}
              >
                {header.title}
              </h1>
              {header.copyable ? (
                <CopyButton text={header.title} />
              ) : null}
            </div>
            {header.subtitle ? (
              <div
                className="mt-1 hidden max-w-[640px] overflow-hidden text-[13px] leading-snug sm:block"
                style={{ color: "rgba(255, 255, 255, 0.82)" }}
              >
                {header.subtitle}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Right: action pill + stacked [clock / (search + eye + bell)] */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {header?.action ? (
            <Link
              href={header.action.href}
              className="hidden h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold shadow-[0_6px_18px_-8px_rgba(0,0,0,0.25)] transition-[opacity,transform] active:translate-y-px sm:inline-flex"
              style={{
                backgroundColor: "#ffffff",
                color: "#1b77be",
              }}
            >
              <Plus size={13} weight="bold" />
              {header.action.label}
            </Link>
          ) : null}
          {/* Clock sits above; search + eye + bell all share the bottom row */}
          <div className="flex flex-col items-end gap-1.5">
            <LiveClock />
            <div className="flex items-center gap-2">
              {owners && owners.length > 0 ? (
                <EyeButton
                  owners={owners}
                  viewingAsUserId={viewingAsUserId ?? null}
                />
              ) : null}
              <BellOnBrand />
              <SearchPill />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * Search trigger styled as a wide translucent pill on the brand-blue bar.
 * Click dispatches a synthetic ⌘K keydown that the global CommandPalette
 * listener catches and opens the modal.
 *
 * Uses inline `style` for all white-derived colors so dark mode does not
 * flip them to black via the `--color-white` redefinition.
 */
function SearchPill() {
  function handleClick() {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="hidden h-9 w-[200px] items-center gap-2 rounded-full border px-3.5 text-[12.5px] font-medium backdrop-blur-sm transition-colors lg:w-[240px] sm:flex"
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.15)",
        borderColor: "rgba(255, 255, 255, 0.28)",
        color: "rgba(255, 255, 255, 0.82)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.25)";
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.42)";
        e.currentTarget.style.color = "#ffffff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.28)";
        e.currentTarget.style.color = "rgba(255, 255, 255, 0.82)";
      }}
      aria-label="Open search"
    >
      <MagnifyingGlass size={14} weight="bold" />
      <span className="flex-1 text-left">Search</span>
      <span style={{ color: "rgba(255, 255, 255, 0.55)" }}>⌘K</span>
    </button>
  );
}

function ordinalSuffix(day: number): string {
  const rem100 = day % 100;
  if (rem100 >= 11 && rem100 <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

/**
 * Live clock for the portal app bar.
 *
 * Single row: date · divider · time, centered above the search+bell row.
 * Hidden below `md` — the mobile bar only has room for the bell.
 *
 * Renders at opacity 0 until mounted to avoid a hydration mismatch between
 * the server's "now" and the client's. The invisible skeleton reserves the
 * exact horizontal space so nothing shifts when the clock appears.
 *
 * White colors are hardcoded literals — not `text-white` — because
 * globals.css redefines `--color-white` in dark mode.
 */
function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
     
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  let dateAriaStr = "Sat, Apr 11th, 2026";
  let timeStr = "12:00:00 AM";
  let dateNode: ReactNode = "Sat, Apr 11th, 2026";

  if (now) {
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    timeStr = `${displayHours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} ${period}`;

    const day = now.getDate();
    const suffix = ordinalSuffix(day);
    const weekday = now.toLocaleDateString("en-US", { weekday: "short" });
    const month = now.toLocaleDateString("en-US", { month: "short" });
    const year = now.getFullYear();

    dateAriaStr = `${weekday}, ${month} ${day}${suffix}, ${year}`;
    dateNode = (
      <>
        {weekday}, {month} {day}
        <span
          style={{
            fontSize: "8.5px",
            verticalAlign: "baseline",
            fontWeight: 600,
            opacity: 0.65,
            letterSpacing: "0.03em",
          }}
        >
          {suffix}
        </span>
        , {year}
      </>
    );
  }

  return (
    <div
      className="hidden items-center gap-2 md:flex"
      style={{ opacity: now ? 1 : 0 }}
      aria-label={`${dateAriaStr}, ${timeStr}`}
      suppressHydrationWarning
    >
      <span
        className="text-[11px] font-semibold"
        style={{ color: "rgba(255, 255, 255, 0.82)" }}
      >
        {dateNode}
      </span>
      {/* Thin vertical divider */}
      <span
        className="h-[13px] w-px shrink-0"
        style={{ backgroundColor: "rgba(255, 255, 255, 0.35)" }}
        aria-hidden
      />
      <span
        className="text-[11px] font-bold tabular-nums"
        style={{ color: "#ffffff" }}
      >
        {timeStr}
      </span>
      {/* Pulsing live dot after the time */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
          style={{ backgroundColor: "#4ade80" }}
        />
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ backgroundColor: "#4ade80" }}
        />
      </span>
    </div>
  );
}

/**
 * NotificationBell wrapper that forces the trigger button to white and the
 * unread badge to white-on-brand-blue. Uses Tailwind arbitrary variants
 * with `[&_button[aria-label='Notifications']]` descendant selectors plus
 * `!important` so we override NotificationBell's inline styles without
 * editing NotificationBell itself (another agent owns that file).
 *
 * Color values are HARDCODED literals — not `text-white` / `bg-white` —
 * because the worktree redefines `--color-white` in dark mode.
 *
 * The dropdown panel (when you click the bell) is unaffected: its internal
 * selectors don't match the descendant pattern, so dropdown text stays
 * dark-on-light as designed.
 */
function BellOnBrand() {
  return (
    <div
      className="
        [&_button[aria-label='Notifications']]:![display:flex]
        [&_button[aria-label='Notifications']]:![align-items:center]
        [&_button[aria-label='Notifications']]:![justify-content:center]
        [&_button[aria-label='Notifications']]:![height:36px]
        [&_button[aria-label='Notifications']]:![width:36px]
        [&_button[aria-label='Notifications']]:![border-radius:9999px]
        [&_button[aria-label='Notifications']]:![border:1px_solid_rgba(255,255,255,0.28)]
        [&_button[aria-label='Notifications']]:![background-color:rgba(255,255,255,0.15)]
        [&_button[aria-label='Notifications']]:![backdrop-filter:blur(8px)]
        [&_button[aria-label='Notifications']]:![color:rgba(255,255,255,0.82)]
        [&_button[aria-label='Notifications']:hover]:![background-color:rgba(255,255,255,0.25)]
        [&_button[aria-label='Notifications']:hover]:![border-color:rgba(255,255,255,0.42)]
        [&_button[aria-label='Notifications']:hover]:![color:#ffffff]
        [&_button[aria-label='Notifications']>span]:![background-color:#ffffff]
        [&_button[aria-label='Notifications']>span]:![color:#1b77be]
      "
    >
      <NotificationBell align="right" />
    </div>
  );
}

/**
 * Small icon button that copies `text` to the clipboard on click.
 * Swaps the copy glyph to a check for ~1.5s after a successful copy to
 * confirm the action without a toast. Silent on clipboard-API failures
 * (older browsers, insecure contexts) since the user can still select
 * the visible title text as a fallback.
 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable; user can still select the title manually.
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${text}`}
        title="Copy address"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{
          color: "#ffffff",
          backgroundColor: copied
            ? "rgba(255, 255, 255, 0.22)"
            : "rgba(255, 255, 255, 0.12)",
          transition: "background-color 150ms ease-out",
        }}
        onMouseEnter={(e) => {
          if (!copied) {
            e.currentTarget.style.backgroundColor =
              "rgba(255, 255, 255, 0.22)";
          }
        }}
        onMouseLeave={(e) => {
          if (!copied) {
            e.currentTarget.style.backgroundColor =
              "rgba(255, 255, 255, 0.12)";
          }
        }}
      >
        <Copy size={13} weight="bold" />
      </button>

      {/* Floating toast that drops in on successful copy and fades out */}
      <div
        role="status"
        aria-live="polite"
        aria-hidden={!copied}
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold"
        style={{
          backgroundColor: "rgba(17, 17, 20, 0.96)",
          color: "#ffffff",
          boxShadow: "0 10px 28px -10px rgba(0, 0, 0, 0.45)",
          opacity: copied ? 1 : 0,
          transform: copied
            ? "translate(-50%, 0) scale(1)"
            : "translate(-50%, -4px) scale(0.96)",
          transition:
            "opacity 180ms ease-out, transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
        }}
      >
        <Check
          size={11}
          weight="bold"
          style={{ color: "#22c55e" }}
          aria-hidden
        />
        Copied
      </div>
    </div>
  );
}

/**
 * Eye button — admin-only, sits next to the bell in the top bar.
 *
 * Idle: translucent icon-only button with a tooltip. No text label so it
 * stays compact and doesn't clutter the bar.
 * Active (impersonating): the button gets an amber ring + a small amber dot
 * badge so it's instantly obvious admin mode is on. Clicking always opens
 * the ViewAsModal regardless of state.
 */
function EyeButton({
  owners,
  viewingAsUserId,
}: {
  owners: OwnerOption[];
  viewingAsUserId: string | null;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const isActive = !!viewingAsUserId;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        title="View portal as owner"
        aria-label="View portal as owner"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-sm transition-colors"
        style={
          isActive
            ? {
                backgroundColor: "rgba(245, 158, 11, 0.22)",
                borderColor: "rgba(245, 158, 11, 0.55)",
                color: "#ffffff",
              }
            : {
                backgroundColor: "rgba(255, 255, 255, 0.15)",
                borderColor: "rgba(255, 255, 255, 0.28)",
                color: "rgba(255, 255, 255, 0.82)",
              }
        }
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.25)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.42)";
            e.currentTarget.style.color = "#ffffff";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.28)";
            e.currentTarget.style.color = "rgba(255, 255, 255, 0.82)";
          }
        }}
      >
        <Eye size={16} weight="duotone" />
        {isActive ? (
          <span
            aria-hidden
            className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full"
            style={{
              backgroundColor: "#f59e0b",
              boxShadow: "0 0 0 1.5px #1b77be",
            }}
          />
        ) : null}
      </button>

      {modalOpen ? (
        <ViewAsModal
          owners={owners}
          viewingAsUserId={viewingAsUserId}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Command+K-style modal for switching the portal view to any owner.
 *
 * Structure:
 * - Full-screen backdrop (click to close)
 * - Centered card (max-w-lg)
 * - If impersonating: amber banner showing current owner + Exit button
 * - Search input filters by name or email in real time
 * - Scrollable owner list; click a row to switch
 */
function ViewAsModal({
  owners,
  viewingAsUserId,
  onClose,
}: {
  owners: OwnerOption[];
  viewingAsUserId: string | null;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const currentOwner = viewingAsUserId
    ? (owners.find((o) => o.id === viewingAsUserId) ?? null)
    : null;

  // Auto-focus the search input when modal opens
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = query.trim()
    ? owners.filter((o) => {
        const q = query.toLowerCase();
        return (
          o.full_name?.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q)
        );
      })
    : owners;

  function handleSelect(ownerId: string) {
    startTransition(() => {
      setViewingAs(ownerId);
      onClose();
    });
  }

  function handleExit() {
    startTransition(() => {
      clearViewingAs();
      onClose();
    });
  }

  function ownerInitials(o: OwnerOption) {
    return o.full_name
      ? o.full_name
          .split(" ")
          .filter(Boolean)
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : o.email.slice(0, 2).toUpperCase();
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh]"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.55)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="mx-4 w-full max-w-lg overflow-hidden rounded-2xl"
        style={{
          backgroundColor: "var(--color-white)",
          boxShadow:
            "0 24px 64px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0,0,0,0.06)",
        }}
      >
        {/* Active impersonation banner */}
        {currentOwner ? (
          <div
            className="flex items-center justify-between gap-3 px-4 py-3"
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.10)",
              borderBottom: "1px solid rgba(245, 158, 11, 0.22)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <Eye size={15} weight="duotone" style={{ color: "#d97706" }} />
              <span
                className="text-sm font-semibold"
                style={{ color: "#92400e" }}
              >
                Viewing{" "}
                {currentOwner.full_name?.trim() ||
                  currentOwner.email.split("@")[0]}
                &rsquo;s portal
              </span>
            </div>
            <button
              type="button"
              onClick={handleExit}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-amber-100 disabled:opacity-50"
              style={{ color: "#b45309" }}
            >
              <X size={11} weight="bold" />
              Exit
            </button>
          </div>
        ) : null}

        {/* Search input */}
        <div
          className="flex items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: "var(--color-warm-gray-100)" }}
        >
          <MagnifyingGlass
            size={16}
            weight="bold"
            style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
            style={{ color: "var(--color-text-primary)" }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-warm-gray-100)]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              <X size={10} weight="bold" />
            </button>
          ) : (
            <kbd
              className="inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none"
              style={{
                backgroundColor: "var(--color-warm-gray-50)",
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-tertiary)",
                fontFamily: "inherit",
              }}
            >
              Esc
            </kbd>
          )}
        </div>

        {/* Owner list */}
        <ul
          className="max-h-[340px] overflow-y-auto py-1"
          role="listbox"
          aria-label="Select an owner"
        >
          {filtered.length === 0 ? (
            <li
              className="px-4 py-8 text-center text-sm"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              No owners match &ldquo;{query}&rdquo;
            </li>
          ) : (
            filtered.map((owner) => {
              const isSelected = owner.id === viewingAsUserId;
              return (
                <li key={owner.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => handleSelect(owner.id)}
                    disabled={isPending}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-warm-gray-50)] disabled:opacity-50"
                    style={{
                      backgroundColor: isSelected
                        ? "rgba(2, 170, 235, 0.06)"
                        : undefined,
                    }}
                  >
                    {owner.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={owner.avatar_url}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                        style={{
                          backgroundColor: isSelected
                            ? "rgba(2, 170, 235, 0.15)"
                            : "var(--color-warm-gray-100)",
                          color: isSelected
                            ? "var(--color-brand)"
                            : "var(--color-text-secondary)",
                        }}
                      >
                        {ownerInitials(owner)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-sm font-semibold"
                        style={{
                          color: isSelected
                            ? "var(--color-brand)"
                            : "var(--color-text-primary)",
                        }}
                      >
                        {owner.full_name ?? owner.email}
                      </div>
                      <div
                        className="truncate text-xs"
                        style={{ color: "var(--color-text-tertiary)" }}
                      >
                        {owner.email}
                      </div>
                    </div>
                    {isSelected ? (
                      <span
                        className="text-xs font-semibold"
                        style={{ color: "var(--color-brand)" }}
                      >
                        Viewing
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {/* Footer hint */}
        <div
          className="flex items-center justify-between border-t px-4 py-2.5"
          style={{
            borderColor: "var(--color-warm-gray-100)",
            backgroundColor: "var(--color-warm-gray-50)",
          }}
        >
          <span
            className="text-[11px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {owners.length} {owners.length === 1 ? "owner" : "owners"} in your portfolio
          </span>
          <span
            className="text-[11px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Click to view their portal
          </span>
        </div>
      </div>
    </div>
  );
}

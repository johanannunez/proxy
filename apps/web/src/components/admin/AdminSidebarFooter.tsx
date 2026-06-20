"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition, useState, useRef, useEffect, type CSSProperties } from "react";
import {
  GearSix, UserSwitch, Power, Sun, Moon, Monitor, Question, CaretUp,
  CreditCard, Palette,
} from "@phosphor-icons/react";
import { useTheme } from "@/components/ThemeProvider";
import { signOut } from "@/app/(workspace)/workspace/actions";

function getWorkspaceUrl(pathname: string): string {
  const map: Array<[string, string]> = [
    ["/admin/properties", "/workspace/properties"],
    ["/admin/calendar", "/workspace/calendar"],
    ["/admin/meetings", "/workspace/meetings"],
    ["/admin/inbox", "/workspace/inbox"],
    ["/admin/tasks", "/workspace/tasks"],
    ["/admin/timeline", "/workspace/timeline"],
    ["/admin/account", "/workspace/account"],
    ["/admin/help", "/workspace/help"],
  ];
  for (const [prefix, dest] of map) {
    if (pathname.startsWith(prefix)) return dest;
  }
  return "/workspace/home";
}

const THEME_OPTIONS = [
  { value: "light" as const, icon: <Sun size={14} weight="regular" />, label: "Light" },
  { value: "dark" as const, icon: <Moon size={14} weight="regular" />, label: "Dark" },
  { value: "system" as const, icon: <Monitor size={14} weight="regular" />, label: "System" },
] as const;

function ThemeSegmented() {
  const { theme, setTheme } = useTheme();
  return (
    <div style={{
      display: "flex", gap: "2px", padding: "2px",
      background: "rgba(255,255,255,0.06)", borderRadius: "8px",
    }}>
      {THEME_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            gap: "5px", padding: "5px 4px", borderRadius: "6px", border: "none",
            background: theme === opt.value ? "rgba(255,255,255,0.12)" : "transparent",
            color: theme === opt.value ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
            fontSize: "11px", fontWeight: theme === opt.value ? 600 : 400,
            cursor: "pointer", fontFamily: "inherit",
            transition: "background 120ms ease, color 120ms ease",
          }}
        >
          {opt.icon}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

export function AdminSidebarFooter({
  userName,
  userEmail,
  initials,
  avatarUrl = null,
}: {
  userName: string;
  userEmail: string;
  initials: string;
  avatarUrl?: string | null;
}) {
  const pathname = usePathname();
  const workspaceHref = getWorkspaceUrl(pathname ?? "");
  const [open, setOpen] = useState(false);
  const [signOutPending, startSignOut] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const item: CSSProperties = {
    display: "flex", alignItems: "center", gap: "10px",
    width: "100%", padding: "8px 10px", borderRadius: "8px",
    background: "none", border: "none",
    color: "rgba(255,255,255,0.68)", fontSize: "13px", fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
    textDecoration: "none", transition: "background 120ms ease, color 120ms ease",
  };

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        margin: "0 12px 20px",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        paddingTop: "8px",
      }}
    >
      {/* Flyout panel */}
      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 0,
          background: "#0b1e30",
          border: "1px solid rgba(255,255,255,0.11)",
          borderRadius: "12px", padding: "5px",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 100,
        }}>
          <Link
            href="/admin/account"
            onClick={() => setOpen(false)}
            style={item}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.9)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.68)"; }}
          >
            <GearSix size={15} weight="duotone" style={{ color: "rgba(255,255,255,0.38)", flexShrink: 0 }} />
            Account settings
          </Link>

          <Link
            href="/admin/settings/billing"
            onClick={() => setOpen(false)}
            style={item}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.9)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.68)"; }}
          >
            <CreditCard size={15} weight="duotone" style={{ color: "rgba(255,255,255,0.38)", flexShrink: 0 }} />
            Billing
          </Link>

          <Link
            href="/admin/settings/branding"
            onClick={() => setOpen(false)}
            style={item}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.9)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.68)"; }}
          >
            <Palette size={15} weight="duotone" style={{ color: "rgba(255,255,255,0.38)", flexShrink: 0 }} />
            Branding
          </Link>

          <Link
            href={workspaceHref}
            onClick={() => setOpen(false)}
            style={{ ...item, color: "rgba(96,185,235,0.85)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(96,185,235,0.07)"; e.currentTarget.style.color = "rgba(96,185,235,1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(96,185,235,0.85)"; }}
          >
            <UserSwitch size={15} weight="duotone" style={{ color: "rgba(96,185,235,0.75)", flexShrink: 0 }} />
            Switch to Workspace
          </Link>

          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", margin: "4px 6px" }} />

          <button
            type="button"
            onClick={() => { window.dispatchEvent(new CustomEvent("admin:help-support")); setOpen(false); }}
            style={item}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.9)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.68)"; }}
          >
            <Question size={15} weight="regular" style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
            Help & Support
          </button>

          <div style={{ padding: "5px 4px" }}>
            <ThemeSegmented />
          </div>

          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", margin: "4px 6px" }} />

          <button
            type="button"
            disabled={signOutPending}
            onClick={() => { setOpen(false); startSignOut(() => signOut()); }}
            style={{ ...item, color: signOutPending ? "rgba(239,68,68,0.4)" : "rgba(239,68,68,0.78)", cursor: signOutPending ? "wait" : "pointer" }}
            onMouseEnter={(e) => { if (!signOutPending) { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "rgba(239,68,68,1)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = signOutPending ? "rgba(239,68,68,0.4)" : "rgba(239,68,68,0.78)"; }}
          >
            <Power size={15} weight="regular" style={{ flexShrink: 0 }} />
            {signOutPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}

      {/* Identity trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: "10px",
          width: "100%", padding: "7px 9px", borderRadius: "10px",
          background: open ? "rgba(255,255,255,0.06)" : "none",
          border: `1px solid ${open ? "rgba(255,255,255,0.10)" : "transparent"}`,
          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          transition: "background 120ms ease, border-color 120ms ease",
        }}
        onMouseEnter={(e) => { if (!open) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; } }}
        onMouseLeave={(e) => { if (!open) { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "transparent"; } }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={userName} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <span style={{
            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
            background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "11px", fontWeight: 600, color: "white", letterSpacing: "0.04em",
          }}>
            {initials}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#E0EDF8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.35 }}>
            {userName}
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.38)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.35 }}>
            {userEmail}
          </div>
        </div>
        <CaretUp
          size={11}
          weight="bold"
          style={{
            color: "rgba(255,255,255,0.28)", flexShrink: 0,
            transform: open ? "rotate(0deg)" : "rotate(180deg)",
            transition: "transform 180ms ease",
          }}
        />
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ShieldCheck,
  Devices,
  SignOut,
  Desktop,
  DeviceMobile,
  DeviceTablet,
  Globe,
  Clock,
  CaretDown,
  CaretUp,
} from "@phosphor-icons/react";
import { signOutOtherSessions, getSessionLog } from "../actions";

type SessionEntry = {
  id: string;
  ip_address: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  country: string | null;
  city: string | null;
  logged_in_at: string;
};

function DeviceIcon({ type, size = 16 }: { type: string | null; size?: number }) {
  const style = { color: "var(--color-text-tertiary)" };
  if (type === "Mobile") return <DeviceMobile size={size} weight="duotone" style={style} />;
  if (type === "Tablet") return <DeviceTablet size={size} weight="duotone" style={style} />;
  return <Desktop size={size} weight="duotone" style={style} />;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const mins = Math.floor((now - then) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTime(dateStr);
}

export function SessionsSection() {
  const [currentBrowser, setCurrentBrowser] = useState("Browser");
  const [currentOS, setCurrentOS] = useState("Unknown OS");
  const [signOutPending, startSignOut] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ua.includes("Edg/")) setCurrentBrowser("Edge");
    else if (ua.includes("Chrome/") && !ua.includes("Edg/")) setCurrentBrowser("Chrome");
    else if (ua.includes("Firefox/")) setCurrentBrowser("Firefox");
    else if (ua.includes("Safari/") && !ua.includes("Chrome/")) setCurrentBrowser("Safari");

    if (/iPhone|iPad|iPod/.test(ua)) setCurrentOS("iOS");
    else if (/Android/.test(ua)) setCurrentOS("Android");
    else if (/Mac/.test(ua)) setCurrentOS("macOS");
    else if (/Win/.test(ua)) setCurrentOS("Windows");
    else if (/Linux/.test(ua)) setCurrentOS("Linux");
  }, []);

  useEffect(() => {
    getSessionLog().then((result) => {
      if (result.ok) setSessions(result.sessions);
      setLoading(false);
    });
  }, []);

  function handleSignOutOthers() {
    setFeedback(null);
    startSignOut(async () => {
      const result = await signOutOtherSessions();
      setFeedback(result);
    });
  }

  const visibleSessions = showAll ? sessions : sessions.slice(0, 5);
  const hasMore = sessions.length > 5;

  return (
    <section id="sessions" className="scroll-mt-8">
      <h2
        className="text-xl font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        Sessions
      </h2>
      <p
        className="mb-6 text-sm"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Manage your active sessions and view login history.
      </p>

      <div
        className="rounded-2xl border"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Current Session */}
        <div className="p-7">
          <div className="flex items-center gap-4">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: "var(--color-warm-gray-100)" }}
            >
              <Devices size={20} weight="duotone" style={{ color: "var(--color-brand)" }} />
            </div>
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {currentBrowser} on {currentOS}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: "rgba(22, 163, 74, 0.1)", color: "var(--color-success)" }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: "var(--color-success)", animation: "pulse 2s ease-in-out infinite" }}
                  />
                  This device
                </span>
              </div>
              <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Currently active session
              </span>
            </div>
          </div>

          {/* Security badge */}
          <div
            className="mt-5 flex items-center gap-3 rounded-lg px-4 py-3"
            style={{ backgroundColor: "var(--color-warm-gray-50)" }}
          >
            <ShieldCheck size={18} weight="duotone" style={{ color: "var(--color-success)" }} />
            <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Your session is encrypted and secure.
            </span>
          </div>

          {/* Sign out other sessions */}
          {feedback && (
            <div
              className="mt-4 rounded-lg border px-4 py-3 text-sm font-medium"
              style={{
                backgroundColor: feedback.ok ? "rgba(22, 163, 74, 0.08)" : "rgba(220, 38, 38, 0.08)",
                borderColor: feedback.ok ? "rgba(22, 163, 74, 0.25)" : "rgba(220, 38, 38, 0.25)",
                color: feedback.ok ? "var(--color-success)" : "var(--color-error)",
              }}
            >
              {feedback.message}
            </div>
          )}

          <div
            className="mt-5 flex items-center justify-between border-t pt-5"
            style={{ borderColor: "var(--color-warm-gray-200)" }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                Other sessions
              </p>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Sign out of all sessions except this one.
              </p>
            </div>
            <button
              type="button"
              disabled={signOutPending}
              onClick={handleSignOutOthers}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-60"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-primary)",
                backgroundColor: "var(--color-white)",
              }}
            >
              <SignOut size={16} weight="bold" />
              {signOutPending ? "Signing out..." : "Sign out others"}
            </button>
          </div>
        </div>

        {/* Login History */}
        <div
          className="border-t"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <div className="px-7 pb-2 pt-5">
            <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Login history
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              Recent sign-in activity on your account.
            </p>
          </div>

          {loading ? (
            <div className="px-7 py-8 text-center text-sm" style={{ color: "var(--color-text-tertiary)" }}>
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-7 py-8 text-center text-sm" style={{ color: "var(--color-text-tertiary)" }}>
              No login history recorded yet. Future sign-ins will appear here.
            </div>
          ) : (
            <>
              <div className="px-4">
                <table className="w-full">
                  <thead>
                    <tr
                      className="text-left text-[10px] font-semibold uppercase tracking-[0.08em]"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      <th className="px-3 py-2">Device</th>
                      <th className="px-3 py-2">IP Address</th>
                      <th className="px-3 py-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSessions.map((s, i) => (
                      <tr
                        key={s.id}
                        className="border-t"
                        style={{ borderColor: "var(--color-warm-gray-100)" }}
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <DeviceIcon type={s.device_type} />
                            <div>
                              <div className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                                {s.browser ?? "Unknown"} on {s.os ?? "Unknown"}
                              </div>
                              <div className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                                {s.device_type ?? "Desktop"}
                                {s.city || s.country
                                  ? ` · ${[s.city, s.country].filter(Boolean).join(", ")}`
                                  : null}
                              </div>
                            </div>
                            {i === 0 ? (
                              <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                style={{ backgroundColor: "rgba(2, 170, 235, 0.08)", color: "var(--color-brand)" }}
                              >
                                Latest
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <Globe size={12} style={{ color: "var(--color-text-tertiary)" }} />
                            <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                              {s.ip_address ?? "Unknown"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} style={{ color: "var(--color-text-tertiary)" }} />
                            <span
                              className="text-sm"
                              style={{ color: "var(--color-text-secondary)" }}
                              title={formatDateTime(s.logged_in_at)}
                            >
                              {formatRelative(s.logged_in_at)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hasMore ? (
                <div className="px-7 pb-5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAll(!showAll)}
                    className="flex items-center gap-1 text-xs font-medium transition-colors"
                    style={{ color: "var(--color-brand)" }}
                  >
                    {showAll ? (
                      <>
                        Show less <CaretUp size={10} weight="bold" />
                      </>
                    ) : (
                      <>
                        Show all {sessions.length} sessions <CaretDown size={10} weight="bold" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="h-5" />
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </section>
  );
}

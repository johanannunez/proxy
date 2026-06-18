"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  PORTAL_NOTIFICATION_PREFS_EVENT,
  PORTAL_NOTIFICATION_PREFS_KEY,
  type WorkspaceNotificationPreferences,
} from "@/lib/workspace/notification-preferences";
import { updateWorkspaceNotificationPreferences } from "../notification-preferences-actions";

type Preferences = WorkspaceNotificationPreferences;

const TOGGLE_ITEMS: {
  key: keyof Preferences;
  label: string;
  description: string;
}[] = [
  {
    key: "portalMessages",
    label: "Workspace messages",
    description:
      "Get notified when Proxy sends you a new message.",
  },
  {
    key: "announcements",
    label: "Announcements",
    description:
      "Receive system-wide updates, policy changes, and important notices.",
  },
  {
    key: "accountAlerts",
    label: "Account alerts",
    description:
      "Security notifications like new sign-ins and password changes.",
  },
  {
    key: "financialDocuments",
    label: "Financial documents",
    description:
      "Get notified when a receipt or financial document is available.",
  },
];

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200"
      style={{
        backgroundColor: checked
          ? "var(--color-brand)"
          : "var(--color-warm-gray-200)",
      }}
    >
      <span
        className="pointer-events-none inline-block h-4.5 w-4.5 rounded-full shadow-sm transition-transform duration-200"
        style={{
          width: 18,
          height: 18,
          backgroundColor: "var(--color-white)",
          transform: checked ? "translateX(22px)" : "translateX(3px)",
        }}
      />
    </button>
  );
}

export function NotificationsSection({
  contactMethod,
  initialPreferences,
}: {
  contactMethod: string;
  initialPreferences: Preferences;
}) {
  const [prefs, setPrefs] = useState<Preferences>(initialPreferences);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    try {
      localStorage.setItem(PORTAL_NOTIFICATION_PREFS_KEY, JSON.stringify(initialPreferences));
      window.dispatchEvent(new Event(PORTAL_NOTIFICATION_PREFS_EVENT));
    } catch {
      // localStorage unavailable, server preferences still apply on load
    }
  }, [initialPreferences]);

  const updatePref = useCallback(
    (key: keyof Preferences, value: boolean) => {
      const next = { ...prefs, [key]: value };
      setPrefs(next);
      try {
        localStorage.setItem(PORTAL_NOTIFICATION_PREFS_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event(PORTAL_NOTIFICATION_PREFS_EVENT));
      } catch {
        // localStorage full or unavailable
      }
      setStatus(null);
      startTransition(async () => {
        const result = await updateWorkspaceNotificationPreferences(next);
        setStatus(result.ok ? "Notification preferences saved." : result.message);
      });
    },
    [prefs],
  );

  return (
    <section id="notifications" className="scroll-mt-8">
      <h2
        className="text-xl font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        Notifications
      </h2>
      <p
        className="mb-6 text-sm"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Choose how and when you hear from us.
      </p>

      <div
        className="rounded-2xl border p-7"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Contact method display */}
        <div
          className="mb-6 flex items-center gap-3 rounded-lg px-4 py-3"
          style={{ backgroundColor: "var(--color-warm-gray-50)" }}
        >
          <span
            className="text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Preferred contact method:{" "}
            <span
              className="font-medium capitalize"
              style={{ color: "var(--color-text-primary)" }}
            >
              {contactMethod}
            </span>
          </span>
        </div>

        {/* Toggle rows */}
        <div className="flex flex-col gap-0">
          {TOGGLE_ITEMS.map((item, index) => (
            <div
              key={item.key}
              className="flex items-center justify-between py-4"
              style={{
                borderTop:
                  index > 0
                    ? "1px solid var(--color-warm-gray-200)"
                    : undefined,
              }}
            >
              <div className="flex flex-col gap-0.5 pr-4">
                <label
                  htmlFor={`toggle-${item.key}`}
                  className="cursor-pointer text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {item.label}
                </label>
                <span
                  className="text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {item.description}
                </span>
              </div>
              <Toggle
                id={`toggle-${item.key}`}
                checked={prefs[item.key]}
                onChange={(v) => updatePref(item.key, v)}
              />
            </div>
          ))}
        </div>
        {status ? (
          <p
            className="mt-4 text-xs"
            aria-live="polite"
            style={{ color: status === "Notification preferences saved." ? "var(--color-success)" : "var(--color-error)" }}
          >
            {status}
          </p>
        ) : isPending ? (
          <p
            className="mt-4 text-xs"
            aria-live="polite"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Saving notification preferences...
          </p>
        ) : null}
      </div>
    </section>
  );
}

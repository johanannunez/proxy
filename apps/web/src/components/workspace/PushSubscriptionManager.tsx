"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, X } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";

/**
 * Creates a push subscription tied to the active service worker and
 * saves it to the push_subscriptions table. Shared between the explicit
 * "Enable" button click and the silent auto-re-subscribe effect.
 */
async function createAndSavePushSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.warn("[Push] VAPID public key not set");
    return false;
  }

  try {
    // Wait for the service worker to be ready (installed + activated)
    const registration = await navigator.serviceWorker.ready;

    // Check if there's already an active subscription on this SW
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Create a fresh one
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      });
    }

    // Save to the database
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const subJson = subscription.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: subJson.endpoint!,
        keys: subJson.keys as Record<string, string>,
        device_info: detectDevice(),
      },
      { onConflict: "user_id,endpoint" },
    );

    if (error) {
      console.error("[Push] Failed to save subscription:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Push] Subscription failed:", err);
    return false;
  }
}

/**
 * Manages push notification subscription.
 * Shows an inline card on the Messages page prompting the owner
 * to enable notifications if they haven't already.
 *
 * If permission is already granted but there's no active subscription
 * (e.g., after the service worker was replaced), this component
 * silently creates a fresh subscription on mount.
 */
export function PushPermissionCard() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [dismissed, setDismissed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);

    if (localStorage.getItem("proxy-push-dismissed") === "true") {
      setDismissed(true);
    }

    // Silent auto-re-subscribe when permission is already granted.
    // Handles the case where the service worker was replaced and the
    // existing database row is stale.
    if (Notification.permission === "granted") {
      createAndSavePushSubscription().catch((err) => {
        console.warn("[Push] Silent re-subscribe failed:", err);
      });
    }
  }, []);

  const handleEnable = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    setSubscribing(true);

    const perm = await Notification.requestPermission();
    setPermission(perm);

    if (perm === "granted") {
      await createAndSavePushSubscription();
    }

    setSubscribing(false);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("proxy-push-dismissed", "true");
  };

  // Don't show if: unsupported, already granted, denied, or dismissed
  if (permission === "unsupported" || permission === "granted" || permission === "denied" || dismissed) {
    return null;
  }

  return (
    <div
      className="relative flex items-center gap-3 rounded-xl border px-4 py-3"
      style={{
        borderColor: "rgba(2, 170, 235, 0.15)",
        backgroundColor: "rgba(2, 170, 235, 0.03)",
      }}
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full opacity-50 transition-opacity hover:opacity-100"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <X size={12} />
      </button>

      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: "rgba(2, 170, 235, 0.1)", color: "var(--color-brand)" }}
      >
        <Bell size={18} weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
          Never miss a message
        </p>
        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
          Turn on notifications to get alerted when Proxy sends you something.
        </p>
      </div>
      <button
        type="button"
        onClick={handleEnable}
        disabled={subscribing}
        className="shrink-0 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: "var(--color-brand)" }}
      >
        {subscribing ? "Enabling..." : "Enable"}
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

function detectDevice(): string {
  const ua = navigator.userAgent;
  let browser = "Browser";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";

  let os = "Unknown";
  if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Mac/.test(ua)) os = "macOS";
  else if (/Win/.test(ua)) os = "Windows";

  return `${browser} on ${os}`;
}

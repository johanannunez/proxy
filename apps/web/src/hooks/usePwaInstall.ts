"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Shared PWA install state hook.
 *
 * Consumers: the "Install web app" section on /portal/account and the
 * ⌘K command palette.
 *
 * The install action is always offered. There is no "installed",
 * "unsupported", or "manual" state — desktop browsers always render
 * the same install card and the same button regardless of whether the
 * `beforeinstallprompt` event has fired yet, so the user gets the
 * same experience every time and can install or reinstall at will.
 *
 * If the deferred prompt is available when the user clicks, the
 * native install dialog opens. If it isn't available (Chrome silently
 * skipped it because the PWA is already installed, or engagement is
 * too low), the call resolves as "dismissed" with no UI noise.
 *
 * iOS Safari is the one exception: it never fires the event, and the
 * user has to add Proxy via the Share sheet, so iOS gets a separate
 * state with three Safari-specific steps.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export type PwaInstallState =
  | { status: "checking" }
  | {
      status: "available";
      promptInstall: () => Promise<"accepted" | "dismissed">;
    }
  | { status: "ios" };

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIPad =
    /iPad/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isIPhoneOrIPod = /iPhone|iPod/.test(ua);
  const isMsStream = (window as unknown as { MSStream?: unknown }).MSStream;
  return (isIPhoneOrIPod || isIPad) && !isMsStream;
}

export function usePwaInstall(): PwaInstallState {
  const [state, setState] = useState<PwaInstallState>({ status: "checking" });
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  const promptInstall = useCallback(async () => {
    const deferred = deferredRef.current;
    if (!deferred) return "dismissed" as const;
    await deferred.prompt();
    const result = await deferred.userChoice;
    deferredRef.current = null;
    return result.outcome;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (detectIOS()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ status: "ios" });
      return;
    }

    // Always render the install card on non-iOS browsers.
    setState({ status: "available", promptInstall });

    // If the browser later fires `beforeinstallprompt`, capture the
    // deferred event so the button can open the native install dialog.
    const handler = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      deferredRef.current = event;
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, [promptInstall]);

  return state;
}

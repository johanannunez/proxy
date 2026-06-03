"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwise } from "@phosphor-icons/react";

const THRESHOLD = 80;
const MAX_PULL = 130;

/**
 * Pull-to-refresh for mobile / PWA standalone mode.
 * Wraps the scrollable content area. When the user pulls down
 * from the top of the page, a spinner appears and the page
 * reloads via Next.js router.refresh().
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const pulling = useRef(false);

  const getScrollEl = useCallback((): HTMLElement | null => {
    return containerRef.current?.closest("main") ?? null;
  }, []);

  const isAtTop = useCallback(() => {
    const el = getScrollEl();
    if (el) return el.scrollTop <= 0;
    return window.scrollY <= 0;
  }, [getScrollEl]);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (!isAtTop()) return;
      touchStartY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || refreshing) return;
      if (!isAtTop()) {
        pulling.current = false;
        setPullDistance(0);
        return;
      }

      const deltaY = e.touches[0].clientY - touchStartY.current;
      if (deltaY < 0) {
        pulling.current = false;
        setPullDistance(0);
        return;
      }

      // Rubber-band effect: diminishing returns past threshold
      const distance = Math.min(MAX_PULL, deltaY * 0.5);
      setPullDistance(distance);

      if (distance > 10) {
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;

      if (pullDistance >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        setPullDistance(THRESHOLD);

        // Refresh the page data
        router.refresh();

        // Also do a hard reload to fully refresh server components
        setTimeout(() => {
          window.location.reload();
        }, 300);
      } else {
        setPullDistance(0);
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullDistance, refreshing, isAtTop, router]);

  const progress = Math.min(1, pullDistance / THRESHOLD);
  const showIndicator = pullDistance > 10 || refreshing;

  return (
    <div ref={containerRef} className="relative flex min-h-full flex-col">
      {/* Pull indicator */}
      {showIndicator && (
        <div
          className="pointer-events-none absolute left-0 right-0 z-50 flex justify-center"
          style={{
            top: 0,
            transform: `translateY(${pullDistance - 44}px)`,
            // eslint-disable-next-line react-hooks/refs
            transition: pulling.current ? "none" : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full shadow-md"
            style={{
              backgroundColor: "var(--color-white)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
            }}
          >
            <ArrowClockwise
              size={20}
              weight="bold"
              style={{
                color: progress >= 1 || refreshing
                  ? "var(--color-brand)"
                  : "var(--color-text-tertiary)",
                transform: `rotate(${progress * 360}deg)`,
                // eslint-disable-next-line react-hooks/refs
                transition: pulling.current ? "none" : "transform 0.3s ease",
                animation: refreshing ? "spin 0.8s linear infinite" : "none",
              }}
            />
          </div>
        </div>
      )}

      {/* Content with pull offset */}
      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : "none",
          // eslint-disable-next-line react-hooks/refs
          transition: pulling.current ? "none" : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

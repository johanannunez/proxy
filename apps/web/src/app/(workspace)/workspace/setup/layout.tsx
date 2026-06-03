import type { ReactNode } from "react";

/**
 * Setup layout: the hub page uses a viewport-fit layout (no page scroll,
 * cards flex to fill). Sub-pages (individual form steps) use the normal
 * scrolling portal layout via the default <main> padding from the parent
 * portal layout.
 *
 * This layout is intentionally a pass-through. The hub page itself applies
 * the viewport-fit constraint via CSS classes on its own root element.
 * Sub-pages render normally with scroll.
 */
export default function SetupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

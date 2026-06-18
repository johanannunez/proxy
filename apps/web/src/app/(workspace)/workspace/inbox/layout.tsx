import type { ReactNode } from "react";

/**
 * Messages layout — full-bleed, full-height.
 *
 * WorkspaceMainContent detects /workspace/inbox and uses absolute positioning
 * to fill the parent <main> element completely. This layout simply passes
 * children through with flex layout so the inner panels handle their own
 * scrolling.
 */
export default function MessagesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );
}

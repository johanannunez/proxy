"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Lets a portal page dynamically override the title and subtitle that
 * WorkspaceAppBar would otherwise compute from the route path.
 *
 * Usage pattern:
 *
 *   1. portal/layout.tsx wraps its children in <WorkspaceHeaderProvider>.
 *   2. WorkspaceAppBar calls `useWorkspaceHeaderOverride()`. If the override is
 *      set, it renders that instead of the default `getWorkspaceHeader(path)`.
 *   3. A page that wants a dynamic header renders <SetWorkspaceHeader title=...
 *      subtitle=... /> anywhere inside its JSX. On mount the component
 *      writes into the context; on unmount (or route change) it clears
 *      the override so the next page falls back to the default lookup.
 *
 * Architecture: the state and the setter live in SEPARATE contexts so
 * readers (WorkspaceAppBar) and writers (SetWorkspaceHeader) are fully
 * isolated. A writer calling setOverride only re-renders readers, never
 * other writers. This prevents the class of infinite re-render bug where
 * a writer component consumes the full context just to read the setter,
 * sees a new wrapping value object on every override update, and
 * re-fires its useEffect because its deps changed. Splitting the
 * contexts makes the setter a permanently-stable reference that writers
 * can safely put in their effect deps.
 */

export type WorkspaceHeaderOverride = {
  title: string;
  subtitle?: ReactNode;
  /**
   * If true, the AppBar renders a small copy-to-clipboard button next to
   * the title that copies `title` verbatim on click. Use on pages where
   * the title is a meaningful piece of data the user often wants to paste
   * elsewhere (e.g. a property address).
   */
  copyable?: boolean;
};

type SetOverride = (value: WorkspaceHeaderOverride | null) => void;

const WorkspaceHeaderStateContext = createContext<WorkspaceHeaderOverride | null>(
  null,
);

const WorkspaceHeaderSetterContext = createContext<SetOverride>(() => {
  // Noop fallback so SetWorkspaceHeader rendered outside a provider doesn't
  // crash. In practice portal/layout.tsx always mounts the provider above
  // any consumer, so this branch never executes at runtime.
});

export function WorkspaceHeaderProvider({ children }: { children: ReactNode }) {
  const [override, setOverrideState] = useState<WorkspaceHeaderOverride | null>(
    null,
  );

  // Stable function reference. Empty dep array -> same reference for the
  // lifetime of the provider, which means writer components can safely
  // list it in their useEffect deps without retriggering on every state
  // update.
  const setOverride = useCallback<SetOverride>((value) => {
    setOverrideState(value);
  }, []);

  return (
    <WorkspaceHeaderSetterContext.Provider value={setOverride}>
      <WorkspaceHeaderStateContext.Provider value={override}>
        {children}
      </WorkspaceHeaderStateContext.Provider>
    </WorkspaceHeaderSetterContext.Provider>
  );
}

/**
 * Read the current override. Returns `null` if no page has set one.
 * Consumers re-render when the override changes (WorkspaceAppBar).
 */
export function useWorkspaceHeaderOverride(): WorkspaceHeaderOverride | null {
  return useContext(WorkspaceHeaderStateContext);
}

/**
 * Get the stable setter to write the override. Consumers of this hook do
 * NOT re-render when the override changes because the setter context
 * never updates after mount.
 */
export function useSetWorkspaceHeaderOverride(): SetOverride {
  return useContext(WorkspaceHeaderSetterContext);
}

/**
 * Render this inside a page to set the AppBar title + subtitle for the
 * duration that the page is mounted. Clears the override when the page
 * unmounts so the next route falls back to the default lookup.
 *
 * Safe to render as a child of a server component because this is a
 * client component marked `"use client"`.
 */
export function SetWorkspaceHeader({
  title,
  subtitle,
  copyable,
}: {
  title: string;
  subtitle?: ReactNode;
  copyable?: boolean;
}) {
  const setOverride = useSetWorkspaceHeaderOverride();

  // Keep the latest subtitle (a ReactNode, so a fresh object every render)
  // in a ref so the effect below can read it without depending on it.
  // Listing subtitle as a dep would cause an infinite loop since each
  // render produces a new ReactNode reference.
  const subtitleRef = useRef(subtitle);
  // eslint-disable-next-line react-hooks/refs
  subtitleRef.current = subtitle;

  useEffect(() => {
    setOverride({ title, subtitle: subtitleRef.current, copyable });
    return () => setOverride(null);
    // title + copyable are the stability signals. When title changes
    // (e.g. navigating between property detail pages) the effect re-runs
    // and picks up the fresh subtitle from the ref. setOverride is a
    // permanently-stable reference from a non-updating setter context,
    // so including it in deps is safe.
  }, [setOverride, title, copyable]);

  return null;
}

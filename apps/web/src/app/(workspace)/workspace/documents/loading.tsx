/**
 * Documents hub skeleton — mirrors the loaded layout (progress header, two
 * card sections) so the page does not jump when data arrives. Opacity-only
 * pulse keeps the animation compositor-friendly.
 */

function SkeletonBlock({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className ?? ""}`}
      style={{ backgroundColor: "var(--color-warm-gray-100)", ...style }}
      aria-hidden="true"
    />
  );
}

function SkeletonPacketCard() {
  return (
    <div
      className="rounded-2xl border p-5 sm:p-6"
      style={{
        borderColor: "var(--color-warm-gray-200)",
        backgroundColor: "var(--color-white)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start gap-4">
        <SkeletonBlock className="h-14 w-14 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <SkeletonBlock className="h-4 w-2/5" />
          <SkeletonBlock className="mt-2.5 h-3.5 w-full" />
          <SkeletonBlock className="mt-1.5 h-3.5 w-3/4" />
          <div className="mt-3.5 flex items-center justify-between gap-2">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="h-3 w-20" />
          </div>
        </div>
      </div>
      <div
        className="mt-4 flex items-center justify-between border-t pt-4"
        style={{ borderColor: "var(--color-warm-gray-100)" }}
      >
        <SkeletonBlock className="h-4 w-20" />
        <SkeletonBlock className="h-1.5 w-20 rounded-full" />
      </div>
    </div>
  );
}

export default function DocumentsLoading() {
  return (
    <div
      className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8"
      role="status"
      aria-label="Loading your documents"
    >
      {/* Progress header skeleton */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-5 py-4"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-1.5 min-w-32 flex-1 rounded-full" />
        <SkeletonBlock className="h-4 w-10" />
      </div>

      {/* Section skeletons */}
      <div className="mt-8 flex flex-col gap-10">
        {[0, 1].map((section) => (
          <section key={section} aria-hidden="true">
            <SkeletonBlock className="h-3.5 w-36" />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SkeletonPacketCard />
              <SkeletonPacketCard />
            </div>
          </section>
        ))}
      </div>
      <span className="sr-only">Loading your documents…</span>
    </div>
  );
}

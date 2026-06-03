export default function WorkspaceLoading() {
  return (
    <div className="flex flex-col gap-10">
      <header>
        <div
          className="h-3 w-32 rounded animate-pulse"
          style={{ backgroundColor: "var(--color-warm-gray-100)" }}
        />
        <div
          className="mt-3 h-9 w-full max-w-72 rounded animate-pulse"
          style={{ backgroundColor: "var(--color-warm-gray-100)" }}
        />
        <div
          className="mt-3 h-4 w-full max-w-96 rounded animate-pulse"
          style={{ backgroundColor: "var(--color-warm-gray-100)" }}
        />
      </header>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[148px] rounded-2xl border animate-pulse"
            style={{
              backgroundColor: "var(--color-white)",
              borderColor: "var(--color-warm-gray-200)",
            }}
          />
        ))}
      </section>
    </div>
  );
}

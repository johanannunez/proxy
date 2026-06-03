const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Build a Set of ISO date strings (YYYY-MM-DD) that fall within
 * any of the given booking ranges for the specified month.
 */
function buildBookedSet(
  bookings: { check_in: string; check_out: string }[],
  year: number,
  month: number,
): Set<string> {
  const booked = new Set<string>();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  for (const b of bookings) {
    const ci = new Date(b.check_in);
    const co = new Date(b.check_out);
    const start = ci < monthStart ? monthStart : ci;
    const end = co > monthEnd ? monthEnd : co;
    const cursor = new Date(start);
    while (cursor <= end) {
      const iso = cursor.toISOString().slice(0, 10);
      booked.add(iso);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return booked;
}

export function OccupancyCalendar({
  bookings,
  year,
  month,
}: {
  bookings: { check_in: string; check_out: string }[];
  /** 4-digit year */
  year: number;
  /** 0-indexed month (0 = January) */
  month: number;
}) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = firstDay.getDay();
  const today = new Date().toISOString().slice(0, 10);

  const booked = buildBookedSet(bookings, year, month);

  const monthLabel = firstDay.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <section
      className="rounded-2xl border p-5"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      <h3
        className="mb-4 text-[15px] font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        {monthLabel} occupancy
      </h3>

      {/* Day-of-week header */}
      <div
        className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`blank-${i}`} />;
          }
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isBooked = booked.has(iso);
          const isToday = iso === today;

          return (
            <div
              key={iso}
              className="flex h-9 items-center justify-center rounded-lg text-xs font-medium tabular-nums transition-colors duration-150"
              style={{
                backgroundColor: isBooked
                  ? "var(--color-brand)"
                  : "transparent",
                color: isBooked
                  ? "var(--color-white)"
                  : isToday
                    ? "var(--color-brand)"
                    : "var(--color-text-secondary)",
                fontWeight: isToday ? 700 : 500,
                outline:
                  isToday && !isBooked
                    ? "2px solid var(--color-brand)"
                    : undefined,
                outlineOffset:
                  isToday && !isBooked ? "-2px" : undefined,
              }}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div
        className="mt-4 flex items-center gap-4 text-[11px]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded"
            style={{ backgroundColor: "var(--color-brand)" }}
          />
          Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded"
            style={{ backgroundColor: "var(--color-warm-gray-100)" }}
          />
          Available
        </span>
      </div>
    </section>
  );
}

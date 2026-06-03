import { currency0 } from "@/lib/format";

export type PropertyRow = {
  id: string;
  name: string;
  revenue: number;
  occupancyPct: number | null;
  nights: number;
  avgNightly: number | null;
};

export function PropertyBreakdown({
  rows,
  periodLabel,
}: {
  rows: PropertyRow[];
  periodLabel: string;
}) {
  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      <header
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: "var(--color-warm-gray-100)" }}
      >
        <h2
          className="text-[15px] font-semibold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          Property breakdown
        </h2>
        <span
          className="text-xs font-medium"
          style={{ color: "var(--color-brand)" }}
        >
          {periodLabel}
        </span>
      </header>

      {rows.length === 0 ? (
        <div
          className="px-6 py-10 text-center text-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          No properties to show.
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <ul className="flex flex-col md:hidden">
            {rows.map((r, i) => (
              <li
                key={r.id}
                className="px-5 py-4"
                style={{
                  borderTop:
                    i === 0
                      ? undefined
                      : "1px solid var(--color-warm-gray-100)",
                }}
              >
                <div
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {r.name}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div>
                    <span style={{ color: "var(--color-text-tertiary)" }}>
                      Revenue
                    </span>
                    <div
                      className="font-semibold tabular-nums"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {currency0.format(r.revenue)}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "var(--color-text-tertiary)" }}>
                      Occupancy
                    </span>
                    <div style={{ color: "var(--color-text-secondary)" }}>
                      {r.occupancyPct !== null ? `${r.occupancyPct}%` : "\u2014"}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "var(--color-text-tertiary)" }}>
                      Nights
                    </span>
                    <div style={{ color: "var(--color-text-secondary)" }}>
                      {r.nights}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "var(--color-text-tertiary)" }}>
                      Avg/night
                    </span>
                    <div style={{ color: "var(--color-text-secondary)" }}>
                      {r.avgNightly !== null
                        ? currency0.format(r.avgNightly)
                        : "\u2014"}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Tablet+: full table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-[10px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  <th className="px-6 py-3 font-semibold">Property</th>
                  <th className="px-6 py-3 text-right font-semibold">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-right font-semibold">
                    Occupancy
                  </th>
                  <th className="px-6 py-3 text-right font-semibold">
                    Nights
                  </th>
                  <th className="px-6 py-3 text-right font-semibold">
                    Avg/night
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.id}
                    className="transition-colors hover:bg-[var(--color-warm-gray-50)]"
                    style={{
                      borderTop:
                        i === 0
                          ? undefined
                          : "1px solid var(--color-warm-gray-100)",
                    }}
                  >
                    <td
                      className="px-6 py-3.5 font-medium"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {r.name}
                    </td>
                    <td
                      className="px-6 py-3.5 text-right font-semibold tabular-nums"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {currency0.format(r.revenue)}
                    </td>
                    <td
                      className="px-6 py-3.5 text-right tabular-nums"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {r.occupancyPct !== null ? `${r.occupancyPct}%` : "\u2014"}
                    </td>
                    <td
                      className="px-6 py-3.5 text-right tabular-nums"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {r.nights}
                    </td>
                    <td
                      className="px-6 py-3.5 text-right tabular-nums"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {r.avgNightly !== null
                        ? currency0.format(r.avgNightly)
                        : "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

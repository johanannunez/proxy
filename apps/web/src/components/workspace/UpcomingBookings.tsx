import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { bookingSourceLabels } from "@/lib/labels";
import { formatShort } from "@/lib/format";

export type UpcomingBookingRow = {
  id: string;
  guestName: string | null;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  source: string;
  status: string;
};

const statusStyles: Record<string, { bg: string; fg: string }> = {
  confirmed: { bg: "rgba(22, 163, 74, 0.12)", fg: "#15803d" },
  pending: { bg: "rgba(245, 158, 11, 0.14)", fg: "#b45309" },
  cancelled: { bg: "rgba(220, 38, 38, 0.10)", fg: "#b91c1c" },
};

function initials(name: string | null) {
  if (!name) return "G";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatRange(checkIn: string, checkOut: string) {
  return `${formatShort(checkIn)} to ${formatShort(checkOut)}`;
}

export function UpcomingBookings({ rows }: { rows: UpcomingBookingRow[] }) {
  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      <header
        className="flex items-center justify-between border-b px-6 py-5"
        style={{ borderColor: "var(--color-warm-gray-100)" }}
      >
        <div>
          <h2
            className="text-lg font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Upcoming bookings
          </h2>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            The next five reservations across your portfolio.
          </p>
        </div>
        <Link
          href="/workspace/reserve"
          className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 transition-opacity hover:opacity-80 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          style={{ color: "var(--color-brand)" }}
        >
          View reserve
          <ArrowUpRight size={14} weight="bold" aria-hidden="true" />
        </Link>
      </header>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Mobile: stacked card list */}
          <ul className="flex flex-col sm:hidden">
            {rows.map((b, i) => {
              const status = statusStyles[b.status] ?? statusStyles.confirmed;
              return (
                <li
                  key={b.id}
                  className="flex items-center gap-4 px-5 py-4"
                  style={{
                    borderTop:
                      i === 0
                        ? undefined
                        : "1px solid var(--color-warm-gray-100)",
                  }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: "var(--color-warm-gray-100)",
                      color: "var(--color-text-primary)",
                    }}
                    aria-hidden="true"
                  >
                    {initials(b.guestName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="truncate text-sm font-semibold"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {b.guestName ?? "Guest"}
                      </span>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                        style={{
                          backgroundColor: status.bg,
                          color: status.fg,
                        }}
                      >
                        {b.status}
                      </span>
                    </div>
                    <div
                      className="mt-0.5 truncate text-xs"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {b.propertyName}
                    </div>
                    <div
                      className="mt-0.5 text-xs tabular-nums"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {formatRange(b.checkIn, b.checkOut)} ·{" "}
                      {bookingSourceLabels[b.source] ?? b.source}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Tablet+ : full table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-[11px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  <th className="px-6 py-3 font-semibold">Guest</th>
                  <th className="px-6 py-3 font-semibold">Property</th>
                  <th className="px-6 py-3 font-semibold">Stay</th>
                  <th className="px-6 py-3 font-semibold">Source</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b, i) => {
                  const status =
                    statusStyles[b.status] ?? statusStyles.confirmed;
                  return (
                    <tr
                      key={b.id}
                      className="transition-colors hover:bg-[var(--color-warm-gray-50)]"
                      style={{
                        borderTop:
                          i === 0
                            ? undefined
                            : "1px solid var(--color-warm-gray-100)",
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor: "var(--color-warm-gray-100)",
                              color: "var(--color-text-primary)",
                            }}
                            aria-hidden="true"
                          >
                            {initials(b.guestName)}
                          </span>
                          <span
                            className="font-medium"
                            style={{ color: "var(--color-text-primary)" }}
                          >
                            {b.guestName ?? "Guest"}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-6 py-4"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {b.propertyName}
                      </td>
                      <td
                        className="px-6 py-4 tabular-nums"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {formatRange(b.checkIn, b.checkOut)}
                      </td>
                      <td
                        className="px-6 py-4"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {bookingSourceLabels[b.source] ?? b.source}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                          style={{
                            backgroundColor: status.bg,
                            color: status.fg,
                          }}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        No upcoming bookings yet. New reservations will appear here as soon as
        they sync.
      </p>
    </div>
  );
}

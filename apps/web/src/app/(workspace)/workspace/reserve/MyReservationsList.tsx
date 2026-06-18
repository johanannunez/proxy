"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  CaretDown,
  CircleDashed,
  Pulse,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  blockStatusVisual,
  labelForBlockStatus,
  type BlockRequestStatus,
} from "@/lib/labels";
import { BlockDetailModal } from "./BlockDetailModal";
import { cancelBlockRequest } from "./actions";
import type { BlockRequest } from "./types";
import ConfirmModal from "@/components/admin/ConfirmModal";

/**
 * Three-group accordion for the owner's own reservations. Rendered
 * below the form on /portal/reserve.
 *
 * Groups:
 *   - Under review — pending requests the admin has not verified yet.
 *     Row includes a Cancel button that soft-cancels via
 *     `cancelBlockRequest`.
 *   - Upcoming — confirmed (approved) blocks in the future.
 *   - History — past confirmed blocks + any with a conflict + cancelled.
 *     Collapsed by default.
 *
 * Clicking any row opens BlockDetailModal for the full detail view.
 */

type Property = { id: string; name: string };

export function MyReservationsList({
  requests,
  properties,
}: {
  requests: BlockRequest[];
  properties: Property[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const propertyMap = useMemo(() => {
    const m = new Map<string, string>();
    properties.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [properties]);

  const { pending, upcoming, history } = useMemo(() => {
    const pending: BlockRequest[] = [];
    const upcoming: BlockRequest[] = [];
    const history: BlockRequest[] = [];
    for (const r of requests) {
      if (r.status === "pending") {
        pending.push(r);
      } else if (r.status === "approved" && r.end_date >= today) {
        upcoming.push(r);
      } else {
        history.push(r);
      }
    }
    const sortFuture = (a: BlockRequest, b: BlockRequest) =>
      a.start_date.localeCompare(b.start_date);
    const sortRecent = (a: BlockRequest, b: BlockRequest) =>
      b.created_at.localeCompare(a.created_at);
    return {
      pending: pending.sort(sortRecent),
      upcoming: upcoming.sort(sortFuture),
      history: history.sort(sortRecent),
    };
  }, [requests, today]);

  const router = useRouter();
  const [selected, setSelected] = useState<BlockRequest | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const isEmpty =
    pending.length === 0 && upcoming.length === 0 && history.length === 0;

  if (isEmpty) {
    return (
      <div
        className="flex flex-col items-center gap-2 rounded-2xl border px-6 py-10 text-center"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
        }}
      >
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{
            backgroundColor: "rgba(2, 170, 235, 0.08)",
            color: "var(--color-brand)",
          }}
        >
          <CalendarCheck size={22} weight="duotone" />
        </span>
        <h3
          className="text-[15px] font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          No reservations yet
        </h3>
        <p
          className="max-w-xs text-[12.5px]"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Every block you send lives here, grouped by status.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {pending.length > 0 ? (
        <Group
          title="Under review"
          count={pending.length}
          icon={
            <Pulse size={14} weight="duotone" style={{ color: "#b45309" }} />
          }
        >
          <div className="flex flex-col gap-3">
            {pending.map((r) => (
              <Row
                key={r.id}
                request={r}
                propertyName={propertyMap.get(r.property_id) ?? "Property"}
                onOpen={() => setSelected(r)}
                showCancel
              />
            ))}
          </div>
        </Group>
      ) : null}

      {upcoming.length > 0 ? (
        <Group
          title="Upcoming"
          count={upcoming.length}
          icon={
            <CalendarCheck
              size={14}
              weight="duotone"
              style={{ color: "#15803d" }}
            />
          }
        >
          <div className="flex flex-col gap-3">
            {upcoming.map((r) => (
              <Row
                key={r.id}
                request={r}
                propertyName={propertyMap.get(r.property_id) ?? "Property"}
                onOpen={() => setSelected(r)}
              />
            ))}
          </div>
        </Group>
      ) : null}

      {history.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-xl px-4 py-3 transition-colors hover:bg-[var(--color-warm-gray-50)]"
            aria-expanded={historyOpen}
          >
            <span className="flex items-center gap-2">
              <CircleDashed
                size={14}
                weight="duotone"
                style={{ color: "var(--color-text-tertiary)" }}
              />
              <span
                className="text-xs font-semibold uppercase tracking-[0.12em]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                History ({history.length})
              </span>
            </span>
            <CaretDown
              size={14}
              weight="bold"
              style={{
                color: "var(--color-text-tertiary)",
                transform: historyOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            />
          </button>
          {historyOpen ? (
            <div className="mt-3 flex flex-col gap-3">
              {history.map((r) => (
                <Row
                  key={r.id}
                  request={r}
                  propertyName={propertyMap.get(r.property_id) ?? "Property"}
                  onOpen={() => setSelected(r)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <BlockDetailModal
          block={selected}
          propertyName={
            propertyMap.get(selected.property_id) ?? "Property"
          }
          onClose={() => setSelected(null)}
          onEdit={() => {
            setSelected(null);
            router.push("/workspace/reserve/new");
          }}
        />
      ) : null}
    </div>
  );
}

/* ───── Group wrapper ───── */

function Group({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2 px-1">
        {icon}
        <h3
          className="text-xs font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {title} ({count})
        </h3>
      </div>
      {children}
    </section>
  );
}

/* ───── Row ───── */

function Row({
  request,
  propertyName,
  onOpen,
  showCancel = false,
}: {
  request: BlockRequest;
  propertyName: string;
  onOpen: () => void;
  showCancel?: boolean;
}) {
  const status = request.status as BlockRequestStatus;
  const visual = blockStatusVisual[status] ?? blockStatusVisual.pending;
  const label = labelForBlockStatus(status);
  const [pending, startTransition] = useTransition();
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const range = formatRange(request.start_date, request.end_date);
  const nights = calcNights(request.start_date, request.end_date);

  const handleCancel = () => {
    setShowCancelConfirm(true);
  };

  const doCancelRequest = () => {
    setCancelError(null);
    startTransition(async () => {
      const result = await cancelBlockRequest({ id: request.id });
      if (!result.ok) {
        setCancelError(result.error ?? "Cancel failed.");
      }
    });
  };

  return (
    <div
      className="group flex flex-col gap-2 rounded-2xl border p-4 transition-colors hover:bg-[var(--color-warm-gray-50)]"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      <div className="flex items-start gap-4">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: "rgba(2, 170, 235, 0.08)",
            color: "var(--color-brand)",
          }}
        >
          <CalendarCheck size={16} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {range}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: visual.bg, color: visual.fg }}
            >
              {label}
            </span>
          </div>
          <p
            className="mt-0.5 truncate text-xs"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {propertyName}
          </p>
          <p
            className="mt-0.5 text-[11px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {nights} {nights === 1 ? "night" : "nights"}
            {request.reason ? ` · ${request.reason}` : ""}
          </p>
        </div>
      </button>

      {showCancel ? (
        <button
          type="button"
          disabled={pending}
          onClick={handleCancel}
          className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:opacity-80 disabled:opacity-40"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            color: "var(--color-text-tertiary)",
          }}
          aria-label="Cancel reservation"
          title="Cancel reservation"
        >
          <X size={13} weight="bold" />
        </button>
      ) : null}
      </div>

      {cancelError ? (
        <div
          className="flex items-center gap-1 text-[11px]"
          style={{ color: "#b91c1c" }}
        >
          <WarningCircle size={12} weight="fill" />
          {cancelError}
        </div>
      ) : null}

      <ConfirmModal
        open={showCancelConfirm}
        title="Cancel reservation?"
        description="This will cancel your block request. This cannot be undone."
        confirmLabel="Cancel reservation"
        variant="danger"
        onConfirm={() => { setShowCancelConfirm(false); doCancelRequest(); }}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </div>
  );
}

function formatRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  const yearOpts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  const sameYear = s.getFullYear() === e.getFullYear();
  if (sameYear) {
    return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString(
      "en-US",
      yearOpts,
    )}`;
  }
  return `${s.toLocaleDateString("en-US", yearOpts)} – ${e.toLocaleDateString(
    "en-US",
    yearOpts,
  )}`;
}

function calcNights(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  return Math.max(
    0,
    Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

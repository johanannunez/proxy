"use client";

/**
 * DocumentTimeline — vertical activity history for one document. Shared by the
 * workspace portal and the admin panel. Events render chronologically with a
 * colored dot per outcome, relative timestamps, and absolute time on hover.
 */
import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import type { TimelineEvent, TimelineEventKind } from "./packet-types";

export interface DocumentTimelineProps {
  events: TimelineEvent[];
  collapsed?: boolean;
}

type Tone = "positive" | "pending" | "negative";

const EVENT_META: Record<TimelineEventKind, { label: string; tone: Tone }> = {
  created: { label: "Created", tone: "pending" },
  sent: { label: "Sent", tone: "pending" },
  viewed: { label: "Viewed", tone: "pending" },
  signed: { label: "Signed", tone: "positive" },
  countersigned: { label: "Countersigned", tone: "positive" },
  on_file: { label: "On file", tone: "positive" },
  declined: { label: "Declined", tone: "negative" },
  expired: { label: "Expired", tone: "negative" },
};

const TONE_COLOR: Record<Tone, string> = {
  positive: "var(--color-success)",
  pending: "#d97706",
  negative: "var(--color-error)",
};

function relativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = now - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`;
  const years = Math.round(months / 12);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

function absoluteTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function eventLabel(event: TimelineEvent): string {
  const base = EVENT_META[event.event].label;
  if (event.actor) {
    if (event.event === "viewed") return `Viewed by ${event.actor}`;
    if (event.event === "signed") return `Signed by ${event.actor}`;
    if (event.event === "countersigned") return `Countersigned by ${event.actor}`;
    if (event.event === "sent") return `Sent by ${event.actor}`;
  }
  return base;
}

export function DocumentTimeline({ events, collapsed = false }: DocumentTimelineProps) {
  const [open, setOpen] = useState(!collapsed);

  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (sorted.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors duration-150 hover:text-[var(--color-text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] active:opacity-80"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        Activity
        <CaretDown
          size={11}
          weight="bold"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms var(--ease-spring)",
          }}
        />
      </button>

      {open && (
        <ol className="mt-3 flex flex-col" aria-label="Document activity">
          {sorted.map((event, i) => {
            const meta = EVENT_META[event.event];
            const isLast = i === sorted.length - 1;
            return (
              <li key={`${event.event}-${event.timestamp}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                {/* Rail */}
                <div className="flex flex-col items-center">
                  <span
                    className="mt-1 block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: TONE_COLOR[meta.tone],
                      boxShadow: `0 0 0 3px color-mix(in srgb, ${TONE_COLOR[meta.tone]} 15%, transparent)`,
                    }}
                    aria-hidden="true"
                  />
                  {!isLast && (
                    <span
                      className="mt-1 w-px flex-1"
                      style={{ backgroundColor: "var(--color-warm-gray-200)" }}
                      aria-hidden="true"
                    />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 pb-0.5">
                  <p
                    className="text-[13px] font-medium leading-snug"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {eventLabel(event)}
                  </p>
                  <time
                    dateTime={event.timestamp}
                    title={absoluteTime(event.timestamp)}
                    className="text-xs"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {relativeTime(event.timestamp)}
                  </time>
                  {event.note && (
                    <p
                      className="mt-0.5 text-xs leading-relaxed"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {event.note}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

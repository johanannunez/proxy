"use client";

/**
 * DocumentPacket — one packet card in the owner documents hub. Shows the packet
 * icon, an animated completion ring, urgency copy, and a single CTA. Clicking
 * anywhere on the card (or the CTA) opens the packet stepper.
 */
import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  CheckCircle,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import {
  packetAttentionCount,
  packetCompletion,
  type PacketItem,
} from "./packet-types";

export interface DocumentPacketProps {
  title: string;
  description: string;
  items: PacketItem[];
  onOpen: () => void;
  icon?: PhosphorIcon;
}

const RING_SIZE = 56;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function CompletionRing({
  complete,
  total,
  allDone,
}: {
  complete: number;
  total: number;
  allDone: boolean;
}) {
  const gradientId = useId();
  const reduceMotion = useReducedMotion();
  const fraction = total > 0 ? complete / total : 0;
  const targetOffset = RING_CIRCUMFERENCE * (1 - fraction);

  return (
    <div
      className="relative shrink-0"
      style={{ width: RING_SIZE, height: RING_SIZE }}
      role="img"
      aria-label={`${complete} of ${total} documents complete`}
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-brand-light)" />
            <stop offset="100%" stopColor="var(--color-brand)" />
          </linearGradient>
        </defs>
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="var(--color-warm-gray-100)"
          strokeWidth={RING_STROKE}
        />
        <motion.circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={allDone ? "var(--color-success)" : `url(#${gradientId})`}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          initial={
            reduceMotion
              ? { strokeDashoffset: targetOffset }
              : { strokeDashoffset: RING_CIRCUMFERENCE }
          }
          animate={{ strokeDashoffset: targetOffset }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {allDone ? (
          <CheckCircle
            size={22}
            weight="fill"
            style={{ color: "var(--color-success)" }}
          />
        ) : (
          <span
            className="text-[13px] font-bold tabular-nums"
            style={{ color: "var(--color-text-primary)" }}
          >
            {complete}/{total}
          </span>
        )}
      </div>
    </div>
  );
}

export function DocumentPacket({
  title,
  description,
  items,
  onOpen,
  icon: Icon,
}: DocumentPacketProps) {
  const { complete, total } = packetCompletion(items);
  const allDone = total > 0 && complete === total;
  const attention = packetAttentionCount(items);

  const statusLabel = allDone
    ? "Complete"
    : attention > 0
      ? `${attention} ${attention === 1 ? "item needs" : "items need"} your attention`
      : "In progress";

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="group relative w-full cursor-pointer overflow-hidden rounded-2xl border p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] sm:p-6"
      style={{
        borderColor: allDone
          ? "rgba(22, 163, 74, 0.22)"
          : "var(--color-warm-gray-200)",
        backgroundColor: "var(--color-white)",
        boxShadow:
          "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(27, 119, 190, 0.07)",
      }}
      aria-label={`${title}: ${statusLabel}. ${complete} of ${total} complete.`}
    >
      {/* Brand gradient wash — deepens slightly on hover */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: allDone
            ? "radial-gradient(120% 90% at 100% 0%, rgba(22, 163, 74, 0.06), transparent 55%)"
            : "radial-gradient(120% 90% at 100% 0%, rgba(2, 170, 235, 0.08), transparent 55%)",
        }}
      />

      <div className="relative flex items-start gap-4">
        <CompletionRing complete={complete} total={total} allDone={allDone} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {Icon && (
              <Icon
                size={18}
                weight="duotone"
                style={{
                  color: allDone ? "var(--color-success)" : "var(--color-brand)",
                  flexShrink: 0,
                }}
              />
            )}
            <h3
              className="truncate text-[15px] font-semibold tracking-tight"
              style={{
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-sora)",
              }}
            >
              {title}
            </h3>
          </div>
          <p
            className="mt-1 line-clamp-2 text-[13px] leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {description}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span
              className="text-xs font-semibold"
              style={{
                color: allDone
                  ? "var(--color-success)"
                  : attention > 0
                    ? "#b45309"
                    : "var(--color-text-tertiary)",
              }}
            >
              {statusLabel}
            </span>
            <span
              className="text-xs font-medium tabular-nums"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {complete} of {total} complete
            </span>
          </div>
        </div>
      </div>

      {/* CTA row */}
      <div
        className="relative mt-4 flex items-center justify-between border-t pt-4"
        style={{ borderColor: "var(--color-warm-gray-100)" }}
      >
        <span
          className="inline-flex items-center gap-1.5 text-sm font-semibold transition-transform duration-200 group-hover:translate-x-0.5 group-active:translate-x-0"
          style={{ color: allDone ? "var(--color-success)" : "var(--color-brand)" }}
        >
          {allDone ? "Review" : "Continue"}
          <ArrowRight size={15} weight="bold" />
        </span>
        {!allDone && total > 0 && (
          <div
            className="h-1.5 w-20 overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--color-warm-gray-100)" }}
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round((complete / total) * 100)}%`,
                background: "var(--color-brand-gradient)",
              }}
            />
          </div>
        )}
      </div>
    </motion.button>
  );
}

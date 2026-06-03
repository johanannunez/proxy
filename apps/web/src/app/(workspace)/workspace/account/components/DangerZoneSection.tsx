"use client";

import { useActionState, useCallback, useState } from "react";
import type { ComponentType } from "react";
import {
  WarningIcon,
  TrashIcon,
  XIcon,
  ArrowCounterClockwiseIcon,
  HouseIcon,
  FileArrowDownIcon,
  CalendarXIcon,
  ChatCircleIcon,
  FilesIcon,
  HeartIcon,
  type Icon,
} from "@phosphor-icons/react";
import { requestAccountDeletion } from "../actions";

const LOSSES: {
  Icon: ComponentType<React.ComponentProps<Icon>>;
  title: string;
  detail: string;
}[] = [
  {
    Icon: FilesIcon,
    title: "Delete all documents",
    detail: "Host agreements, W-9 forms, and any files you've uploaded.",
  },
  {
    Icon: HouseIcon,
    title: "Delete every property",
    detail: "Addresses, beds, baths, photos, and specs — all of it.",
  },
  {
    Icon: ChatCircleIcon,
    title: "Delete your message history",
    detail: "Every message you've exchanged with your host in the portal.",
  },
  {
    Icon: FileArrowDownIcon,
    title: "Delete your ability to export data",
    detail: "No more CSV exports for your records or your accountant.",
  },
  {
    Icon: CalendarXIcon,
    title: "Delete your calendar block history",
    detail: "Every stay block and maintenance hold, approved or pending.",
  },
];

export function DangerZoneSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteState, deleteFormAction, isDeleting] = useActionState(
    requestAccountDeletion,
    null,
  );
  const [confirmText, setConfirmText] = useState("");

  const openModal = useCallback(() => {
    setConfirmText("");
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setConfirmText("");
  }, []);

  return (
    <section id="danger-zone" className="scroll-mt-8">
      <h2
        className="text-xl font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        Danger Zone
      </h2>
      <p
        className="mb-6 text-sm"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Irreversible actions for your Proxy account.
      </p>

      <div className="proxy-danger-card relative overflow-hidden rounded-2xl p-7">
        {/* Drifting radial shimmer */}
        <div aria-hidden="true" className="proxy-danger-shimmer" />
        {/* Fractal noise texture */}
        <div aria-hidden="true" className="proxy-danger-noise" />

        {/* Loss items */}
        <div className="relative flex flex-col gap-2.5">
          {LOSSES.map((loss) => {
            const LossIcon = loss.Icon;
            return (
              <div
                key={loss.title}
                className="flex items-start gap-3 rounded-xl px-3.5 py-3"
                style={{
                  backgroundColor: "var(--color-white)",
                  border: "1px solid rgba(220, 38, 38, 0.16)",
                }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: "rgba(220, 38, 38, 0.10)",
                    border: "1px solid rgba(220, 38, 38, 0.18)",
                  }}
                >
                  <LossIcon
                    size={15}
                    weight="duotone"
                    style={{ color: "var(--color-error)" }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-semibold leading-tight"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {loss.title}
                  </p>
                  <p
                    className="mt-0.5 text-xs leading-snug"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {loss.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Warm farewell note */}
        <div
          className="relative mt-3 flex items-start gap-3 rounded-xl px-3.5 py-3"
          style={{
            backgroundColor: "var(--color-white)",
            border: "1px solid rgba(2, 170, 235, 0.22)",
          }}
        >
          <HeartIcon
            size={15}
            weight="duotone"
            className="mt-0.5 shrink-0"
            style={{ color: "var(--color-brand)" }}
          />
          <div>
            <p
              className="text-sm font-semibold leading-tight"
              style={{ color: "var(--color-text-primary)" }}
            >
              And honestly, we&apos;ll miss you
            </p>
            <p
              className="mt-0.5 text-xs leading-snug"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Hosting is a relationship. We built Proxy to take care of yours.
            </p>
          </div>
        </div>

        {/* 30-day recovery callout */}
        <div
          className="relative mt-3 flex items-start gap-2.5 rounded-xl px-3.5 py-2.5"
          style={{
            backgroundColor: "var(--color-white)",
            border: "1px solid rgba(2, 170, 235, 0.22)",
          }}
        >
          <ArrowCounterClockwiseIcon
            size={15}
            weight="bold"
            className="mt-0.5 shrink-0"
            style={{ color: "var(--color-brand)" }}
          />
          <p
            className="text-xs"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Account deletion is reversible for 30 days. Sign back in and
            everything is restored. After that, it is permanently gone.
          </p>
        </div>

        {/* Delete button */}
        <div className="relative mt-6">
          <button
            type="button"
            onClick={openModal}
            className="proxy-danger-delete-btn inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
          >
            <TrashIcon size={15} weight="bold" />
            Delete my account
          </button>
        </div>
      </div>

      {/* Confirmation modal — lean final check, no repeat of the loss list */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl p-7"
            style={{
              backgroundColor: "var(--color-white)",
              boxShadow:
                "0 20px 60px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
            }}
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-warm-gray-100)]"
              style={{ color: "var(--color-text-tertiary)" }}
              aria-label="Close"
            >
              <XIcon size={18} weight="bold" />
            </button>

            <div
              className="mb-5 flex h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(220, 38, 38, 0.08)" }}
            >
              <WarningIcon
                size={22}
                weight="duotone"
                style={{ color: "var(--color-error)" }}
              />
            </div>

            <h3
              className="text-lg font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Last chance. Are you sure?
            </h3>
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Your account will be deactivated immediately. You have 30 days to
              sign back in and recover everything. After that, it is gone for
              good.
            </p>

            <form action={deleteFormAction}>
              <div className="mt-5">
                <label
                  htmlFor="delete-confirmation"
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Type{" "}
                  <span
                    className="font-bold"
                    style={{ color: "var(--color-error)" }}
                  >
                    DELETE
                  </span>{" "}
                  to confirm
                </label>
                <input
                  id="delete-confirmation"
                  name="confirmation"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-error)]"
                  style={{
                    borderColor: "var(--color-warm-gray-200)",
                    color: "var(--color-text-primary)",
                    backgroundColor: "var(--color-white)",
                  }}
                  placeholder='Type "DELETE"'
                />
              </div>

              {deleteState && !deleteState.ok && (
                <div
                  className="mt-3 rounded-lg border px-4 py-3 text-sm font-medium"
                  style={{
                    backgroundColor: "rgba(220, 38, 38, 0.08)",
                    borderColor: "rgba(220, 38, 38, 0.25)",
                    color: "var(--color-error)",
                  }}
                >
                  {deleteState.message}
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{
                    borderColor: "var(--color-warm-gray-200)",
                    color: "var(--color-text-primary)",
                    backgroundColor: "var(--color-white)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeleting || confirmText !== "DELETE"}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: "var(--color-error)" }}
                >
                  <TrashIcon size={15} weight="bold" />
                  {isDeleting ? "Deleting..." : "Delete my account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dangerShimmer {
          0% { background-position: 0% 0%; }
          25% { background-position: 100% 30%; }
          50% { background-position: 60% 100%; }
          75% { background-position: 10% 60%; }
          100% { background-position: 0% 0%; }
        }
        .proxy-danger-card {
          background: rgba(220, 38, 38, 0.08);
          backdrop-filter: blur(24px) saturate(1.2);
          -webkit-backdrop-filter: blur(24px) saturate(1.2);
          border: 1px solid rgba(220, 38, 38, 0.25);
          box-shadow:
            0 2px 16px rgba(0, 0, 0, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          transition: box-shadow 0.6s ease, border-color 0.6s ease;
        }
        .proxy-danger-card:hover {
          box-shadow:
            0 0 24px rgba(220, 38, 38, 0.20),
            0 0 60px rgba(220, 38, 38, 0.10),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          border-color: rgba(220, 38, 38, 0.45);
        }
        .proxy-danger-shimmer {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 50% 50%, rgba(220, 38, 38, 0.14) 0%, transparent 70%);
          background-size: 200% 200%;
          animation: dangerShimmer 8s linear infinite;
          pointer-events: none;
          z-index: 0;
        }
        .proxy-danger-noise {
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 256px 256px;
          opacity: 0.025;
          pointer-events: none;
          z-index: 0;
        }
        .proxy-danger-delete-btn {
          background: rgba(220, 38, 38, 0.10);
          color: #E05252;
          border: 1px solid rgba(220, 38, 38, 0.28);
          transition:
            background 0.2s ease,
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }
        .proxy-danger-delete-btn:hover {
          background: rgba(220, 38, 38, 0.18);
          border-color: rgba(220, 38, 38, 0.45);
          box-shadow: 0 2px 10px rgba(220, 38, 38, 0.14);
        }
        .proxy-danger-delete-btn:active {
          background: rgba(220, 38, 38, 0.25);
        }
        .proxy-danger-delete-btn:focus-visible {
          outline: 2px solid var(--color-error);
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .proxy-danger-shimmer { animation: none; }
          .proxy-danger-card,
          .proxy-danger-delete-btn { transition: none; }
        }
        @media (max-width: 768px) {
          .proxy-danger-card { padding: 20px; }
        }
      `}</style>
    </section>
  );
}

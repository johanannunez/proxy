"use client";

/**
 * ActionCenterDrawer — the on-demand paperwork command surface (2026-06-14
 * redesign). Replaces the always-on "Needs Action" queue that used to sit
 * pinned atop the Documents tab. A right-side slide-over, toggled by a
 * CustomEvent from the Status Board header, lazy-fetching three sections:
 *   1. Needs Attention — the action queue, with inline Remind / Resend.
 *   2. Expiring Soon   — renewal-window items (populated in Phase 3).
 *   3. Lapsed          — past-expiry items (populated in Phase 3).
 *
 * Portal + event-toggle pattern mirrors NotificationPopover so it coexists with
 * the other admin chrome portals (CommandPalette, NotificationPopover, etc.).
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Lightning, X, CheckCircle, Clock, WarningOctagon } from "@phosphor-icons/react";
import { ActionQueue } from "@/app/(admin)/admin/paperwork/ActionQueue";
import {
  sendDocumentToOwner,
  sendDocumentReminder,
} from "@/app/(admin)/admin/paperwork/document-actions";
import {
  SECURE_DOC_TYPES,
  type SecureDocKey,
  type SignedDocRow,
} from "@/lib/admin/documents-hub-shared";
import type { ActionQueueItem } from "@/lib/admin/action-queue-types";
import type {
  ActionCenterItem,
  ActionCenterResponse,
} from "@/app/api/admin/action-center/route";
import styles from "./ActionCenterDrawer.module.css";

function isSecureKey(key: string): key is SecureDocKey {
  return key in SECURE_DOC_TYPES;
}

export function ActionCenterDrawer() {
  const router = useRouter();
  const prefersReduced = useReducedMotion();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ActionCenterResponse | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => setMounted(true), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/action-center");
      if (res.ok) setData((await res.json()) as ActionCenterResponse);
    } finally {
      setLoading(false);
    }
  }, []);

  /* Toggle from the Status Board header pill. */
  useEffect(() => {
    const toggle = () => {
      setOpen((prev) => {
        if (!prev) {
          setNotice(null);
          fetchData();
        }
        return !prev;
      });
    };
    window.addEventListener("admin:action-center-toggle", toggle);
    return () => window.removeEventListener("admin:action-center-toggle", toggle);
  }, [fetchData]);

  /* Escape closes. */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const handleView = useCallback(
    (item: ActionCenterItem) => {
      setOpen(false);
      router.push(item.deepLink);
    },
    [router],
  );

  /* Remind / Resend run inline; review / countersign deep-link into Signatures. */
  const handleAction = useCallback(
    (base: ActionQueueItem) => {
      const item = data?.needsAttention.find((i) => i.id === base.id);
      if (!item) return;

      if (item.primary_action === "review" || item.primary_action === "countersign") {
        handleView(item);
        return;
      }

      setNotice(null);
      setBusyId(item.id);
      startTransition(async () => {
        try {
          if (item.primary_action === "resend") {
            if (!item.profileId || !item.ownerEmail || !isSecureKey(item.document_key)) {
              handleView(item);
              return;
            }
            const res = await sendDocumentToOwner(
              item.profileId,
              item.ownerEmail,
              item.owner_name,
              item.document_key,
            );
            setNotice(
              res.ok
                ? { tone: "success", text: `Resent ${item.document_title} to ${item.owner_name}.` }
                : { tone: "error", text: res.error ?? "Resend failed." },
            );
            if (res.ok) fetchData();
            return;
          }

          /* remind */
          if (!item.latestDocumentId || !item.latestSubmissionId || !item.ownerEmail) {
            handleView(item);
            return;
          }
          const res = await sendDocumentReminder(
            item.latestDocumentId,
            item.latestSubmissionId,
            item.ownerEmail,
          );
          setNotice(
            res.ok
              ? { tone: "success", text: `Reminder sent to ${item.owner_name}.` }
              : { tone: "error", text: res.error ?? "Reminder failed." },
          );
          if (res.ok) fetchData();
        } finally {
          setBusyId(null);
        }
      });
    },
    [data, fetchData, handleView],
  );

  if (!mounted) return null;

  const needsAttention = data?.needsAttention ?? [];
  const expiring = data?.expiring ?? [];
  const lapsed = data?.lapsed ?? [];
  const totalCount = needsAttention.length + expiring.length + lapsed.length;
  const allClear = !loading && totalCount === 0;

  const rowsByDocumentId = new Map<string, SignedDocRow>(
    (data?.rows ?? []).map((r) => [r.id, r]),
  );

  const content = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ac-scrim"
            className={styles.scrim}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.18 }}
            onMouseDown={close}
            aria-hidden
          />
          <motion.aside
            key="ac-panel"
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label="Action Center"
            initial={{ x: prefersReduced ? 0 : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: prefersReduced ? 0 : "100%" }}
            transition={{ duration: prefersReduced ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className={styles.header}>
              <div className={styles.headerTitleWrap}>
                <span className={styles.headerIcon} aria-hidden>
                  <Lightning size={16} weight="duotone" />
                </span>
                <div>
                  <h2 className={styles.headerTitle}>Action Center</h2>
                  <p className={styles.headerSub}>
                    {loading
                      ? "Loading…"
                      : totalCount === 0
                      ? "Nothing needs you"
                      : `${totalCount} ${totalCount === 1 ? "item" : "items"} to handle`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={close}
                aria-label="Close Action Center"
              >
                <X size={16} weight="bold" />
              </button>
            </header>

            {notice && (
              <div
                className={notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}
                role="status"
              >
                {notice.text}
              </div>
            )}

            <div className={styles.body}>
              {loading ? (
                <div className={styles.section}>
                  <div className={styles.shimmer} />
                  <div className={styles.shimmer} />
                  <div className={styles.shimmer} />
                </div>
              ) : allClear ? (
                <div className={styles.allClear}>
                  <span className={styles.allClearIcon}>
                    <CheckCircle size={26} weight="duotone" />
                  </span>
                  <p className={styles.allClearTitle}>All clear</p>
                  <p className={styles.allClearBody}>
                    No signatures need chasing, nothing is expiring, nothing has
                    lapsed. We&apos;ll surface anything here the moment it needs you.
                  </p>
                </div>
              ) : (
                <>
                  {/* Needs Attention */}
                  {needsAttention.length > 0 && (
                    <section className={styles.section}>
                      <div className={styles.sectionHead}>
                        <span className={styles.sectionLabel}>Needs attention</span>
                        <span className={styles.sectionCount}>{needsAttention.length}</span>
                      </div>
                      <ActionQueue
                        items={needsAttention}
                        onAction={handleAction}
                        onView={(item) =>
                          handleView(
                            data!.needsAttention.find((i) => i.id === item.id) ?? (item as ActionCenterItem),
                          )
                        }
                        busyId={busyId}
                        rowsByDocumentId={rowsByDocumentId}
                      />
                    </section>
                  )}

                  {/* Expiring Soon */}
                  <section className={styles.section}>
                    <div className={styles.sectionHead}>
                      <span className={styles.sectionLabel}>
                        <Clock size={13} weight="duotone" aria-hidden /> Expiring soon
                      </span>
                      {expiring.length > 0 && (
                        <span className={styles.sectionCount}>{expiring.length}</span>
                      )}
                    </div>
                    {expiring.length === 0 ? (
                      <p className={styles.sectionEmpty}>
                        Nothing inside its renewal window. Cards, insurance, permits,
                        and IDs will appear here before they lapse.
                      </p>
                    ) : (
                      <ul className={styles.expiryList}>
                        {expiring.map((it) => (
                          <li key={it.id}>
                            <button
                              type="button"
                              className={styles.expiryRow}
                              onClick={() => {
                                setOpen(false);
                                router.push(it.deepLink);
                              }}
                            >
                              <span className={styles.expiryName}>{it.ownerName}</span>
                              <span className={styles.expiryDoc}>{it.documentTitle}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {/* Lapsed */}
                  <section className={styles.section}>
                    <div className={styles.sectionHead}>
                      <span className={`${styles.sectionLabel} ${styles.sectionLabelDanger}`}>
                        <WarningOctagon size={13} weight="duotone" aria-hidden /> Lapsed
                      </span>
                      {lapsed.length > 0 && (
                        <span className={`${styles.sectionCount} ${styles.sectionCountDanger}`}>
                          {lapsed.length}
                        </span>
                      )}
                    </div>
                    {lapsed.length === 0 ? (
                      <p className={styles.sectionEmpty}>Nothing has lapsed. Good.</p>
                    ) : (
                      <ul className={styles.expiryList}>
                        {lapsed.map((it) => (
                          <li key={it.id}>
                            <button
                              type="button"
                              className={`${styles.expiryRow} ${styles.expiryRowDanger}`}
                              onClick={() => {
                                setOpen(false);
                                router.push(it.deepLink);
                              }}
                            >
                              <span className={styles.expiryName}>{it.ownerName}</span>
                              <span className={styles.expiryDoc}>{it.documentTitle}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

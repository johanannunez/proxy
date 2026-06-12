"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence } from "motion/react";
import {
  Files,
  FileText,
  ShieldCheck,
  HouseSimple,
  Lightning,
} from "@phosphor-icons/react";
import {
  SECURE_DOC_TYPES,
  FORM_TYPES,
  SETUP_SECTION_KEYS,
  SETUP_SECTION_LABELS,
  avatarColor,
  type DocHubOwner,
  type DocHubStats,
  type SecureDocKey,
  type FormKey,
  type SetupSectionKey,
} from "@/lib/admin/documents-hub-shared";
import type { ActionQueueItem } from "@/lib/admin/action-queue-types";
import { BulkActionBar } from "@/components/admin/documents/BulkActionBar";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { DocumentDrawer } from "./DocumentDrawer";
import { ActionQueue } from "./ActionQueue";
import { DocumentSearch } from "./DocumentSearch";
import type { DocumentSearchResult } from "./search-actions";
import { sendDocumentToOwner, sendDocumentReminder } from "./document-actions";
import {
  bulkRemindOwners,
  bulkRequestDocuments,
  bulkSendDocuments,
  bulkWaiveDocuments,
} from "./bulk-actions";
import styles from "./DocumentsHub.module.css";

type FilterKind = "needs_action" | "all" | "secure" | "forms";
type DocKey = SecureDocKey | FormKey;

function isSecureKey(key: DocKey): key is SecureDocKey {
  return key in SECURE_DOC_TYPES;
}

const secureKeys = Object.keys(SECURE_DOC_TYPES) as SecureDocKey[];
const formKeys = Object.keys(FORM_TYPES) as FormKey[];

/* Only these 3 form types appear as matrix columns. The rest show in cards only. */
const matrixFormKeys: FormKey[] = ["property_setup", "wifi_info", "guidebook"];

/* ─── Variant 4 status dot ─── */
function StatusDot({
  status,
  label,
}: {
  status: "completed" | "pending" | "not_sent" | "submitted" | "not_submitted";
  label: string;
}) {
  const dotStyle: React.CSSProperties =
    status === "completed" || status === "submitted"
      ? { width: 9, height: 9, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }
      : status === "pending"
      ? {
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: "transparent",
          border: "2px solid #d97706",
          boxSizing: "border-box",
          flexShrink: 0,
        }
      : { width: 9, height: 9, borderRadius: "50%", background: "#e5e7eb", flexShrink: 0 };

  const labelColor =
    status === "completed" || status === "submitted"
      ? "#15803d"
      : status === "pending"
      ? "#b45309"
      : "#d1d5db";

  return (
    <div className={styles.statusDotCell}>
      <div style={dotStyle} />
      <span className={styles.statusDotLabel} style={{ color: labelColor }}>
        {label}
      </span>
    </div>
  );
}

/* ─── Setup section mini dots ─── */
function SetupSectionDots({
  sections,
  completionPct,
}: {
  sections: Partial<Record<SetupSectionKey, boolean>> | undefined;
  completionPct: number | undefined;
}) {
  const pct = completionPct ?? 0;
  return (
    <div className={styles.setupDots}>
      <div className={styles.setupDotsGrid}>
        {SETUP_SECTION_KEYS.map((key) => (
          <div
            key={key}
            title={SETUP_SECTION_LABELS[key]}
            className={`${styles.setupDot} ${sections?.[key] ? styles.setupDotDone : ""}`}
          />
        ))}
      </div>
      <span className={styles.setupDotsPct}>{pct > 0 ? `${pct}%` : "—"}</span>
    </div>
  );
}

/* ─── Avatar ─── */
function OwnerAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <img src={url} alt={name} className={styles.avatar} style={{ objectFit: "cover" }} />
    );
  }
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <div className={styles.avatar} style={{ background: avatarColor(name) }}>
      {initials}
    </div>
  );
}

/* ─── Doc type card ─── */
function DocCard({
  docKey,
  cardStats,
  active,
  onClick,
}: {
  docKey: DocKey;
  cardStats: { completed: number; pending: number; notSent: number; total: number };
  active: boolean;
  onClick: () => void;
}) {
  const isSecure = isSecureKey(docKey);
  const def = isSecure
    ? SECURE_DOC_TYPES[docKey as SecureDocKey]
    : FORM_TYPES[docKey as FormKey];
  return (
    <button
      className={`${styles.docCard} ${active ? styles.docCardActive : ""}`}
      onClick={onClick}
      type="button"
    >
      <div
        className={styles.docCardIcon}
        style={{ background: `${def.color}18`, color: def.color }}
      >
        {isSecure ? (
          <ShieldCheck size={15} weight="duotone" />
        ) : (
          <FileText size={15} weight="duotone" />
        )}
      </div>
      <div className={styles.docCardName}>{def.shortLabel}</div>
      <div className={styles.docCardCount}>{cardStats.completed}</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {cardStats.pending > 0 && (
          <div className={styles.docCardPending}>{cardStats.pending} pending</div>
        )}
        {cardStats.notSent > 0 && (
          <div className={styles.docCardNotSent}>{cardStats.notSent} not sent</div>
        )}
      </div>
    </button>
  );
}

/* ─── Owner matrix row ─── */
function OwnerMatrixRow({
  owner,
  activeDocKey,
  selected,
  onToggleSelect,
  onOpen,
}: {
  owner: DocHubOwner;
  activeDocKey: DocKey | null;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: (docKey: DocKey) => void;
}) {
  const secureCompleted = secureKeys.filter((k) => owner.secureDocs[k].status === "completed").length;
  const setupSections = owner.forms.property_setup.sections ?? {};
  const setupCompleted = SETUP_SECTION_KEYS.filter((k) => setupSections[k] === true).length;
  const otherFormsCompleted = matrixFormKeys
    .filter((k) => k !== "property_setup")
    .filter((k) => owner.forms[k].submitted).length;
  const completedCount = secureCompleted + setupCompleted + otherFormsCompleted;
  const totalDocs = secureKeys.length + SETUP_SECTION_KEYS.length + (matrixFormKeys.length - 1);

  function handleRowClick() {
    onOpen(activeDocKey ?? secureKeys[0]);
  }

  return (
    <div
      className={`${styles.matrixRow} ${selected ? styles.matrixRowSelected : ""}`}
      onClick={handleRowClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleRowClick()}
    >
      {/* Select checkbox */}
      <div
        className={styles.checkCell}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          className={styles.rowCheckbox}
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${owner.fullName}`}
        />
      </div>

      {/* Owner */}
      <div className={styles.ownerCell}>
        <OwnerAvatar name={owner.fullName} url={owner.avatarUrl} />
        <div style={{ minWidth: 0 }}>
          <div className={styles.ownerName}>{owner.fullName}</div>
          <div className={styles.ownerSub}>
            {owner.propertyCount} {owner.propertyCount === 1 ? "property" : "properties"}
          </div>
        </div>
      </div>

      {/* SecureDoc dots */}
      {secureKeys.map((k) => {
        const s = owner.secureDocs[k].status;
        const isActive = activeDocKey === k;
        const dotLabel = s === "completed" ? "Done" : s === "pending" ? "Sent" : "—";
        return (
          <div
            key={k}
            className={`${styles.matrixCell} ${styles.secureColData} ${isActive ? styles.matrixCellActive : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(k);
            }}
          >
            <StatusDot status={s} label={dotLabel} />
          </div>
        );
      })}

      {/* Divider */}
      <div className={styles.matrixDivider} />

      {/* Form dots — only the 3 matrix columns */}
      {matrixFormKeys.map((k) => {
        const isActive = activeDocKey === k;
        const isSetup = k === "property_setup";
        return (
          <div
            key={k}
            className={`${styles.matrixCell} ${styles.formColData} ${isActive ? styles.matrixCellActive : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(k);
            }}
          >
            {isSetup ? (
              <SetupSectionDots
                sections={owner.forms.property_setup.sections}
                completionPct={owner.forms.property_setup.completionPct}
              />
            ) : (
              <StatusDot
                status={owner.forms[k].submitted ? "submitted" : "not_submitted"}
                label={owner.forms[k].submitted ? "Done" : "—"}
              />
            )}
          </div>
        );
      })}

      {/* Count */}
      <div className={styles.matrixCount}>
        <span className={styles.matrixCountNum}>{completedCount}</span>
        <span className={styles.matrixCountTotal}>/{totalDocs}</span>
      </div>
    </div>
  );
}

/* ─── Main hub ─── */
export function DocumentsHub({
  owners,
  stats,
  actionQueue,
}: {
  owners: DocHubOwner[];
  stats: DocHubStats;
  actionQueue: ActionQueueItem[];
}) {
  const [filter, setFilter] = useState<FilterKind>(
    actionQueue.length > 0 ? "needs_action" : "all",
  );
  const [selectedDocKey, setSelectedDocKey] = useState<DocKey | null>(null);
  const [drawerEntry, setDrawerEntry] = useState<{
    owner: DocHubOwner;
    docKey: DocKey;
  } | null>(null);

  /* Bulk selection (keyed by contactId) */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [waiveConfirmOpen, setWaiveConfirmOpen] = useState(false);
  const [bulkBusy, startBulkTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  /* Action queue primary-action progress */
  const [queueBusyId, setQueueBusyId] = useState<string | null>(null);
  const [, startQueueTransition] = useTransition();

  const ownersByProfileId = useMemo(() => {
    const map = new Map<string, DocHubOwner>();
    for (const owner of owners) {
      if (owner.profileId) map.set(owner.profileId, owner);
    }
    return map;
  }, [owners]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ownerParam = params.get("owner");
    const docParam = params.get("doc");
    if (!ownerParam || !docParam) return;
    if (![...secureKeys, ...formKeys].includes(docParam as DocKey)) return;

    const owner = owners.find((entry) =>
      entry.profileId === ownerParam || entry.contactId === ownerParam
    );
    if (!owner) return;

    const docKey = docParam as DocKey;
    setSelectedDocKey(docKey);
    setFilter(isSecureKey(docKey) ? "secure" : "forms");
    setDrawerEntry({ owner, docKey });
  }, [owners]);

  const visibleCards: DocKey[] = [
    ...(filter !== "forms" ? secureKeys : []),
    ...(filter !== "secure" ? formKeys : []),
  ];

  /* Stats strip totals (SecureDocs only for now) */
  let totalCompleted = 0;
  let totalPending = 0;
  let totalNotSent = 0;
  for (const o of owners) {
    for (const k of secureKeys) {
      const s = o.secureDocs[k].status;
      if (s === "completed") totalCompleted++;
      else if (s === "pending") totalPending++;
      else totalNotSent++;
    }
  }

  function handleFilterChange(f: FilterKind) {
    setFilter(f);
    if (f === "secure") setSelectedDocKey(secureKeys[0]);
    else if (f === "forms") setSelectedDocKey(formKeys[0]);
    else setSelectedDocKey(null);
  }

  function handleCardClick(key: DocKey) {
    setSelectedDocKey((prev) => (prev === key ? null : key));
  }

  /* ─── Selection helpers ─── */

  function toggleOwner(contactId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }

  const allSelected = owners.length > 0 && selectedIds.size === owners.length;

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(owners.map((o) => o.contactId)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const selectedOwners = useMemo(
    () => owners.filter((o) => selectedIds.has(o.contactId)),
    [owners, selectedIds],
  );

  /* The doc type targeted by Request/Send: the active SecureDoc card. */
  const activeSecureKey: SecureDocKey | null =
    selectedDocKey && isSecureKey(selectedDocKey) ? selectedDocKey : null;

  /* ─── Bulk actions ─── */

  function runBulk(run: () => Promise<{ tone: "success" | "error"; text: string }>) {
    setNotice(null);
    startBulkTransition(async () => {
      const result = await run();
      setNotice(result);
      if (result.tone === "success") clearSelection();
    });
  }

  function handleBulkRemind() {
    const profileIds = selectedOwners
      .map((o) => o.profileId)
      .filter((id): id is string => Boolean(id));
    runBulk(async () => {
      const res = await bulkRemindOwners(profileIds);
      if (!res.ok) return { tone: "error", text: res.error ?? "Reminders failed." };
      return {
        tone: "success",
        text: res.sent === 0
          ? "No awaiting-signature documents found for that selection."
          : `Sent ${res.sent} ${res.sent === 1 ? "reminder" : "reminders"}.`,
      };
    });
  }

  function handleBulkRequest() {
    if (!activeSecureKey) return;
    const profileIds = selectedOwners
      .map((o) => o.profileId)
      .filter((id): id is string => Boolean(id));
    runBulk(async () => {
      const res = await bulkRequestDocuments(profileIds, activeSecureKey);
      if (!res.ok) return { tone: "error", text: res.error ?? "Request failed." };
      return {
        tone: "success",
        text: `Requested ${SECURE_DOC_TYPES[activeSecureKey].label} from ${res.affected} ${res.affected === 1 ? "owner" : "owners"}.`,
      };
    });
  }

  function handleBulkSend() {
    if (!activeSecureKey) return;
    const targets = selectedOwners
      .filter((o) => o.profileId && o.secureDocs[activeSecureKey].status === "not_sent")
      .map((o) => ({ profileId: o.profileId!, email: o.email, fullName: o.fullName }));
    runBulk(async () => {
      if (targets.length === 0) {
        return {
          tone: "error",
          text: `Every selected owner already received ${SECURE_DOC_TYPES[activeSecureKey].label}.`,
        };
      }
      const res = await bulkSendDocuments(targets, activeSecureKey);
      if (!res.ok) return { tone: "error", text: res.error ?? "Send failed." };
      return {
        tone: "success",
        text: `Sent ${SECURE_DOC_TYPES[activeSecureKey].label} to ${res.affected} ${res.affected === 1 ? "owner" : "owners"}.`,
      };
    });
  }

  /* Waive: every pending/sent signature document of the selected owners,
     narrowed to the active doc type card when one is selected. */
  const waiveTargetIds = useMemo(() => {
    const ids: string[] = [];
    for (const owner of selectedOwners) {
      const keys = activeSecureKey ? [activeSecureKey] : secureKeys;
      for (const key of keys) {
        const entry = owner.secureDocs[key];
        if (entry.status === "pending" && entry.latest) ids.push(entry.latest.id);
      }
    }
    return ids;
  }, [selectedOwners, activeSecureKey]);

  function handleBulkWaive() {
    setWaiveConfirmOpen(false);
    runBulk(async () => {
      const res = await bulkWaiveDocuments(waiveTargetIds);
      if (!res.ok) return { tone: "error", text: res.error ?? "Waive failed." };
      return {
        tone: "success",
        text: `Waived ${res.affected} ${res.affected === 1 ? "document" : "documents"}.`,
      };
    });
  }

  /* ─── Action queue handlers ─── */

  function openDrawerFor(profileId: string, documentKey: string | null) {
    const owner = ownersByProfileId.get(profileId);
    if (!owner) return;
    const docKey: DocKey =
      documentKey && [...secureKeys, ...formKeys].includes(documentKey as DocKey)
        ? (documentKey as DocKey)
        : secureKeys[0];
    setDrawerEntry({ owner, docKey });
  }

  function handleQueueAction(item: ActionQueueItem) {
    const owner = ownersByProfileId.get(item.owner_id);

    /* Review and countersign are human steps: jump into the document. */
    if (item.primary_action === "review" || item.primary_action === "countersign") {
      openDrawerFor(item.owner_id, item.document_key);
      return;
    }

    if (!owner) {
      setNotice({ tone: "error", text: "Owner not found in the matrix. Refresh and retry." });
      return;
    }

    const docKey = item.document_key as SecureDocKey;
    const entry = secureKeys.includes(docKey) ? owner.secureDocs[docKey] : null;

    setNotice(null);
    setQueueBusyId(item.id);
    startQueueTransition(async () => {
      try {
        if (item.primary_action === "resend") {
          if (!owner.profileId || !secureKeys.includes(docKey)) {
            openDrawerFor(item.owner_id, item.document_key);
            return;
          }
          const res = await sendDocumentToOwner(
            owner.profileId,
            owner.email,
            owner.fullName,
            docKey,
          );
          setNotice(
            res.ok
              ? { tone: "success", text: `Resent ${item.document_title} to ${owner.fullName}.` }
              : { tone: "error", text: res.error ?? "Resend failed." },
          );
          return;
        }

        /* remind */
        const latest = entry?.latest;
        if (!latest || !latest.boldsignDocumentId) {
          openDrawerFor(item.owner_id, item.document_key);
          return;
        }
        const res = await sendDocumentReminder(
          latest.id,
          latest.boldsignDocumentId,
          owner.email,
        );
        setNotice(
          res.ok
            ? { tone: "success", text: `Reminder sent to ${owner.fullName}.` }
            : { tone: "error", text: res.error ?? "Reminder failed." },
        );
      } finally {
        setQueueBusyId(null);
      }
    });
  }

  function handleSearchSelect(result: DocumentSearchResult) {
    openDrawerFor(result.owner_id, result.document_key);
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Documents</h1>
          <div className={styles.statsStrip}>
            <span className={styles.statChip}>
              <span className={styles.statDot} style={{ background: "#64748b" }} />
              {owners.length} owners
            </span>
            <span className={styles.statSep}>·</span>
            <span className={styles.statChip}>
              <span className={styles.statDot} style={{ background: "#16a34a" }} />
              {totalCompleted} completed
            </span>
            <span className={styles.statSep}>·</span>
            <span className={styles.statChip}>
              <span className={styles.statDot} style={{ background: "#d97706" }} />
              {totalPending} pending
            </span>
            <span className={styles.statSep}>·</span>
            <span className={styles.statChip}>
              <span className={styles.statDot} style={{ background: "#9ca3af" }} />
              {totalNotSent} not sent
            </span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <DocumentSearch onSelect={handleSearchSelect} />

          <div className={styles.filterChips}>
            {(["needs_action", "all", "secure", "forms"] as FilterKind[]).map((f) => (
              <button
                key={f}
                className={`${styles.chip} ${filter === f ? styles.chipActive : ""} ${
                  f === "needs_action" && actionQueue.length > 0 && filter !== f
                    ? styles.chipAttention
                    : ""
                }`}
                onClick={() => handleFilterChange(f)}
                type="button"
              >
                {f === "needs_action" && <Lightning size={13} weight="duotone" />}
                {f === "all" && <Files size={13} weight="duotone" />}
                {f === "secure" && <ShieldCheck size={13} weight="duotone" />}
                {f === "forms" && <HouseSimple size={13} weight="duotone" />}
                {f === "needs_action"
                  ? "Needs Action"
                  : f === "all"
                  ? "All"
                  : f === "secure"
                  ? "SecureDocs"
                  : "Setup"}
                <span className={styles.chipCount}>
                  {f === "needs_action"
                    ? actionQueue.length
                    : f === "all"
                    ? secureKeys.length + formKeys.length
                    : f === "secure"
                    ? secureKeys.length
                    : formKeys.length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result / error banner for bulk + queue actions */}
      {notice && (
        <div
          className={notice.tone === "success" ? styles.successBanner : styles.errorBanner}
          role="status"
        >
          {notice.text}
        </div>
      )}

      {filter === "needs_action" ? (
        <ActionQueue
          items={actionQueue}
          onAction={handleQueueAction}
          onView={(item) => openDrawerFor(item.owner_id, item.document_key)}
          busyId={queueBusyId}
        />
      ) : (
        <>
          {/* Cards row */}
          <div className={styles.cardsRow}>
            {visibleCards.map((key) => {
              const isSecure = isSecureKey(key);
              const s = isSecure
                ? stats.secureDocs[key as SecureDocKey]
                : stats.forms[key as FormKey];
              return (
                <DocCard
                  key={key}
                  docKey={key}
                  cardStats={s}
                  active={selectedDocKey === key}
                  onClick={() => handleCardClick(key)}
                />
              );
            })}
          </div>

          {/* Matrix table */}
          <div className={styles.tableSection}>
            {owners.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <Files size={22} />
                </div>
                <p className={styles.emptyTitle}>No owners found</p>
                <p className={styles.emptyBody}>
                  There are no active owners to display.
                </p>
              </div>
            ) : (
              <div className={styles.table}>
                {/* Group header row */}
                <div className={styles.matrixGroupHeader}>
                  <div />
                  <div />
                  <div className={styles.thSecure}>
                    <ShieldCheck size={12} weight="fill" />
                    SecureDocs
                  </div>
                  <div />
                  <div className={styles.thForms}>
                    <HouseSimple size={12} weight="fill" />
                    Setup
                  </div>
                  <div />
                </div>

                {/* Sub-header: individual column names */}
                <div className={styles.matrixSubHeader}>
                  <div className={styles.checkCell}>
                    <input
                      type="checkbox"
                      className={styles.rowCheckbox}
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label={allSelected ? "Deselect all owners" : "Select all owners"}
                    />
                  </div>
                  <div className={styles.tableHeaderCell}>Owner</div>
                  {secureKeys.map((k) => (
                    <div
                      key={k}
                      className={`${styles.tableHeaderCellCenter} ${styles.secureColHeader} ${selectedDocKey === k ? styles.headerCellActive : ""}`}
                    >
                      {SECURE_DOC_TYPES[k].rowLabel}
                    </div>
                  ))}
                  <div />
                  {matrixFormKeys.map((k) => (
                    <div
                      key={k}
                      className={`${styles.tableHeaderCellCenter} ${styles.formColHeader} ${selectedDocKey === k ? styles.headerCellActive : ""}`}
                    >
                      {FORM_TYPES[k].rowLabel}
                    </div>
                  ))}
                  <div className={styles.tableHeaderCellRight}>Done</div>
                </div>

                {/* Data rows */}
                {owners.map((owner) => (
                  <OwnerMatrixRow
                    key={owner.contactId}
                    owner={owner}
                    activeDocKey={selectedDocKey}
                    selected={selectedIds.has(owner.contactId)}
                    onToggleSelect={() => toggleOwner(owner.contactId)}
                    onOpen={(dk) => setDrawerEntry({ owner, docKey: dk })}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && filter !== "needs_action" && (
          <BulkActionBar
            selectedCount={selectedIds.size}
            onRemind={handleBulkRemind}
            onRequest={handleBulkRequest}
            onWaive={() => setWaiveConfirmOpen(true)}
            onSend={handleBulkSend}
            onClear={clearSelection}
            busy={bulkBusy}
            docTypeHint={
              activeSecureKey ? null : "Select a SecureDoc card first to choose the document type"
            }
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        open={waiveConfirmOpen}
        title="Waive selected documents?"
        description={
          waiveTargetIds.length === 0
            ? "No awaiting-signature documents exist for this selection, so there is nothing to waive."
            : `This waives ${waiveTargetIds.length} awaiting-signature ${
                waiveTargetIds.length === 1 ? "document" : "documents"
              }${activeSecureKey ? ` (${SECURE_DOC_TYPES[activeSecureKey].label})` : ""}. Waived documents stop counting against owners.`
        }
        confirmLabel="Waive"
        variant="danger"
        onConfirm={handleBulkWaive}
        onCancel={() => setWaiveConfirmOpen(false)}
      />

      <AnimatePresence>
        {drawerEntry && (
          <DocumentDrawer
            key={drawerEntry.owner.contactId}
            owner={drawerEntry.owner}
            initialDocKey={drawerEntry.docKey}
            onClose={() => setDrawerEntry(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

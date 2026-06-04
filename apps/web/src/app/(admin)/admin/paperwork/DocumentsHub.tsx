"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  Files,
  FileText,
  ShieldCheck,
  CheckCircle,
  Clock,
  Circle,
  HouseSimple,
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
import { DocumentDrawer } from "./DocumentDrawer";
import styles from "./DocumentsHub.module.css";

type FilterKind = "all" | "secure" | "forms";
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
  onOpen,
}: {
  owner: DocHubOwner;
  activeDocKey: DocKey | null;
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
      className={styles.matrixRow}
      onClick={handleRowClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleRowClick()}
    >
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
}: {
  owners: DocHubOwner[];
  stats: DocHubStats;
}) {
  const [filter, setFilter] = useState<FilterKind>("all");
  const [selectedDocKey, setSelectedDocKey] = useState<DocKey | null>(null);
  const [drawerEntry, setDrawerEntry] = useState<{
    owner: DocHubOwner;
    docKey: DocKey;
  } | null>(null);

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

        <div className={styles.filterChips}>
          {(["all", "secure", "forms"] as FilterKind[]).map((f) => (
            <button
              key={f}
              className={`${styles.chip} ${filter === f ? styles.chipActive : ""}`}
              onClick={() => handleFilterChange(f)}
              type="button"
            >
              {f === "all" && <Files size={13} weight="duotone" />}
              {f === "secure" && <ShieldCheck size={13} weight="duotone" />}
              {f === "forms" && <HouseSimple size={13} weight="duotone" />}
              {f === "all" ? "All" : f === "secure" ? "SecureDocs" : "Setup"}
              <span className={styles.chipCount}>
                {f === "all"
                  ? secureKeys.length + formKeys.length
                  : f === "secure"
                  ? secureKeys.length
                  : formKeys.length}
              </span>
            </button>
          ))}
        </div>
      </div>

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
                onOpen={(dk) => setDrawerEntry({ owner, docKey: dk })}
              />
            ))}
          </div>
        )}
      </div>

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

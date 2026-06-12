"use client";

/**
 * CoverageView — the owner-by-template matrix behind the List | Coverage
 * switch (2026-06-12 IA amendment). Columns derive only from tracked
 * masters, grouped by category. Every cell is actionable: an empty cell
 * opens a "Send [template] to [owner]" popover; a sent-unsigned cell offers
 * Remind. Scales past small orgs with owner search, most-missing sort, and
 * pagination past 50 owners.
 */

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  GridNine,
  PaperPlaneTilt,
  BellRinging,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import {
  SECURE_DOC_TYPES,
  FORM_TYPES,
  avatarColor,
  type DocHubOwner,
  type SecureDocKey,
  type FormKey,
  type SignedDocRow,
} from "@/lib/admin/documents-hub-shared";
import type { CoverageColumn, CoverageColumnGroup } from "@/lib/admin/coverage-shared";
import { sendTemplateToOwners } from "./templates/template-send-actions";
import { sendDocumentReminder } from "./document-actions";
import styles from "./CoverageView.module.css";

const PAGE_SIZE = 50;

type DocKey = SecureDocKey | FormKey;
type CellStatus = "completed" | "pending" | "not_sent";

type Notice = { tone: "success" | "error"; text: string };

function isSecureKey(key: string): key is SecureDocKey {
  return key in SECURE_DOC_TYPES;
}

function isFormKey(key: string): key is FormKey {
  return key in FORM_TYPES;
}

function cellStatus(
  owner: DocHubOwner,
  column: CoverageColumn,
): { status: CellStatus; latest: SignedDocRow | null } {
  const key = column.documentKey;
  if (key && isSecureKey(key)) {
    const entry = owner.secureDocs[key];
    return { status: entry.status, latest: entry.latest };
  }
  if (key && isFormKey(key)) {
    return { status: owner.forms[key].submitted ? "completed" : "not_sent", latest: null };
  }
  /* No instance data for this master yet (e.g. tracked org form): treat as
     not sent so the cell stays actionable. */
  return { status: "not_sent", latest: null };
}

function missingCount(owner: DocHubOwner, columns: CoverageColumn[]): number {
  return columns.filter((c) => cellStatus(owner, c).status !== "completed").length;
}

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

function CoverageCell({
  owner,
  column,
  popoverOpen,
  onTogglePopover,
  onOpenDrawer,
  onNotice,
}: {
  owner: DocHubOwner;
  column: CoverageColumn;
  popoverOpen: boolean;
  onTogglePopover: (open: boolean) => void;
  onOpenDrawer: () => void;
  onNotice: (notice: Notice) => void;
}) {
  const [busy, startTransition] = useTransition();
  const { status, latest } = cellStatus(owner, column);

  const canSend = column.source === "document_template" && owner.profileId !== null;
  const canRemind = latest !== null && Boolean(latest.boldsignDocumentId);

  function handleSend() {
    startTransition(async () => {
      const profileId = owner.profileId;
      if (!profileId) return;
      const res = await sendTemplateToOwners(column.templateId, [profileId]);
      onTogglePopover(false);
      onNotice(
        res.ok
          ? { tone: "success", text: `Sent ${column.name} to ${owner.fullName}.` }
          : { tone: "error", text: res.error ?? "Send failed." },
      );
    });
  }

  function handleRemind() {
    if (!latest) return;
    startTransition(async () => {
      const res = await sendDocumentReminder(latest.id, latest.boldsignDocumentId, owner.email);
      onTogglePopover(false);
      onNotice(
        res.ok
          ? { tone: "success", text: `Reminder sent to ${owner.fullName}.` }
          : { tone: "error", text: res.error ?? "Reminder failed." },
      );
    });
  }

  function handleCellClick() {
    if (status === "completed") {
      onOpenDrawer();
      return;
    }
    onTogglePopover(!popoverOpen);
  }

  const pillLabel = status === "completed" ? "Done" : status === "pending" ? "Sent" : "—";
  const pillTone =
    status === "completed"
      ? styles.pillDone
      : status === "pending"
      ? styles.pillPending
      : styles.pillIdle;

  return (
    <div className={styles.cell}>
      <button
        type="button"
        className={styles.cellBtn}
        onClick={handleCellClick}
        aria-label={`${column.name} for ${owner.fullName}: ${pillLabel === "—" ? "not sent" : pillLabel}`}
      >
        <span className={`${styles.pill} ${pillTone}`}>{pillLabel}</span>
      </button>

      {popoverOpen && (
        <div className={styles.popover} role="dialog" aria-label="Cell actions">
          <div className={styles.popoverHead}>
            <span className={styles.popoverTitle}>{column.name}</span>
            <button
              type="button"
              className={styles.popoverClose}
              onClick={() => onTogglePopover(false)}
              aria-label="Close"
            >
              <X size={11} weight="bold" />
            </button>
          </div>
          {status === "pending" ? (
            canRemind ? (
              <button
                type="button"
                className={styles.popoverAction}
                onClick={handleRemind}
                disabled={busy}
              >
                {busy ? <SpinnerGap size={13} weight="bold" /> : <BellRinging size={13} weight="bold" />}
                Remind {owner.fullName.split(" ")[0]}
              </button>
            ) : (
              <p className={styles.popoverNote}>
                Waiting on {owner.fullName}. Open the document for details.
              </p>
            )
          ) : canSend ? (
            <button
              type="button"
              className={styles.popoverAction}
              onClick={handleSend}
              disabled={busy}
            >
              {busy ? <SpinnerGap size={13} weight="bold" /> : <PaperPlaneTilt size={13} weight="bold" />}
              Send {column.name} to {owner.fullName.split(" ")[0]}
            </button>
          ) : column.source === "form" ? (
            <p className={styles.popoverNote}>
              Forms are link-based.{" "}
              <Link
                href={`/admin/paperwork/templates/${column.templateId}`}
                className={styles.popoverLink}
              >
                Open the form
              </Link>{" "}
              to copy its share link.
            </p>
          ) : (
            <p className={styles.popoverNote}>
              {owner.fullName} has no portal account yet, so this cannot be sent.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function CoverageView({
  owners,
  groups,
  onOpen,
  onNotice,
}: {
  owners: DocHubOwner[];
  groups: CoverageColumnGroup[];
  onOpen: (owner: DocHubOwner, docKey: DocKey) => void;
  onNotice: (notice: Notice) => void;
}) {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [openPopover, setOpenPopover] = useState<string | null>(null);

  const columns = useMemo(() => groups.flatMap((g) => g.columns), [groups]);

  /* Owner search scoped to the matrix, then sort by most-missing. */
  const sortedOwners = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? owners.filter(
          (o) =>
            o.fullName.toLowerCase().includes(term) ||
            o.email.toLowerCase().includes(term),
        )
      : owners;
    return [...filtered].sort((a, b) => {
      const diff = missingCount(b, columns) - missingCount(a, columns);
      if (diff !== 0) return diff;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [owners, columns, search]);

  const pageOwners = sortedOwners.slice(0, visibleCount);

  if (columns.length === 0) {
    return (
      <div className={styles.emptyState}>
        <GridNine size={40} weight="duotone" />
        <p className={styles.emptyTitle}>Track a template to see coverage across owners</p>
        <p className={styles.emptyBody}>
          Coverage columns come from the masters you mark as tracked. Open a
          template&apos;s Settings and switch on Track in coverage.
        </p>
        <Link href="/admin/paperwork/templates" className={styles.emptyCta}>
          Go to Templates
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search owners…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          aria-label="Search owners in the coverage matrix"
        />
        <span className={styles.toolbarMeta}>
          {sortedOwners.length} {sortedOwners.length === 1 ? "owner" : "owners"} · sorted by
          most missing
        </span>
      </div>

      <div className={styles.tableScroll}>
        <div
          className={styles.table}
          style={{
            // Owner column + one column per tracked master.
            gridTemplateColumns: `minmax(190px, 1.4fr) repeat(${columns.length}, minmax(86px, 1fr))`,
          }}
        >
          {/* Group header row */}
          <div className={styles.groupSpacer} />
          {groups.map((group) => (
            <div
              key={group.category || "tracked"}
              className={styles.groupHeader}
              style={{ gridColumn: `span ${group.columns.length}` }}
            >
              {group.label}
            </div>
          ))}

          {/* Column header row */}
          <div className={styles.colHeaderOwner}>Owner</div>
          {columns.map((column) => (
            <div key={column.templateId} className={styles.colHeader} title={column.name}>
              {column.name}
            </div>
          ))}

          {/* Owner rows */}
          {pageOwners.map((owner) => (
            <div key={owner.contactId} className={styles.rowContents}>
              <div className={styles.ownerCell}>
                <OwnerAvatar name={owner.fullName} url={owner.avatarUrl} />
                <div className={styles.ownerMeta}>
                  <span className={styles.ownerName}>{owner.fullName}</span>
                  <span className={styles.ownerSub}>
                    {missingCount(owner, columns) === 0
                      ? "All covered"
                      : `${missingCount(owner, columns)} missing`}
                  </span>
                </div>
              </div>
              {columns.map((column) => {
                const popoverKey = `${owner.contactId}:${column.templateId}`;
                return (
                  <CoverageCell
                    key={popoverKey}
                    owner={owner}
                    column={column}
                    popoverOpen={openPopover === popoverKey}
                    onTogglePopover={(open) => setOpenPopover(open ? popoverKey : null)}
                    onOpenDrawer={() => {
                      const key = column.documentKey;
                      if (key && (isSecureKey(key) || isFormKey(key))) {
                        onOpen(owner, key);
                      }
                    }}
                    onNotice={onNotice}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {sortedOwners.length > visibleCount && (
        <button
          type="button"
          className={styles.showMore}
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
        >
          Show {Math.min(PAGE_SIZE, sortedOwners.length - visibleCount)} more owners
        </button>
      )}
    </div>
  );
}

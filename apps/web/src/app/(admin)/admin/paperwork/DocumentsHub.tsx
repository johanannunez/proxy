"use client";

/**
 * Documents tab — tracked instances only (2026-06-12 IA amendment). The page
 * opens directly onto the Needs Action queue, then the instance list with
 * kind chips (All · Signatures · Forms · Files). The owner-by-template
 * matrix lives behind the List | Coverage view switch. No page-local search
 * (the global command palette covers it), no stats pills, no per-kind cards.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence } from "motion/react";
import {
  Files,
  HouseSimple,
  PenNib,
  FileArrowUp,
  ListBullets,
  GridNine,
} from "@phosphor-icons/react";
import {
  SECURE_DOC_TYPES,
  FORM_TYPES,
  avatarColor,
  stageOfSignedDoc,
  fmtRelativeTime,
  type DocHubOwner,
  type SecureDocKey,
  type FormKey,
  type SignedDocRow,
  type DocumentStage,
} from "@/lib/admin/documents-hub-shared";
import type { ActionQueueItem } from "@/lib/admin/action-queue-types";
import type { CoverageColumnGroup } from "@/lib/admin/coverage-shared";
import { StageMeter } from "./StageMeter";
import { DocumentDrawer } from "./DocumentDrawer";
import { ActionQueue } from "./ActionQueue";
import { CoverageView } from "./CoverageView";
import { sendDocumentToOwner, sendDocumentReminder } from "./document-actions";
import styles from "./DocumentsHub.module.css";

type FilterKind = "all" | "signatures" | "forms" | "files";
type DocKey = SecureDocKey | FormKey;

function isSecureKey(key: DocKey): key is SecureDocKey {
  return key in SECURE_DOC_TYPES;
}

const secureKeys = Object.keys(SECURE_DOC_TYPES) as SecureDocKey[];
const formKeys = Object.keys(FORM_TYPES) as FormKey[];

/* ─── Kind taxonomy (design doc: "Kind, Not Place") ───
   A document's kind is what it is, not where it lives:
   signatures = e-sign documents, files = uploads we collect, forms = data forms. */
const signatureKeys: SecureDocKey[] = [
  "host_rental_agreement",
  "card_authorization",
  "ach_authorization",
];

const fileFormKeys: FormKey[] = ["str_permit", "insurance_certificate"];

function kindOfDocKey(key: DocKey): "signatures" | "files" | "forms" {
  if (isSecureKey(key)) {
    return signatureKeys.includes(key) ? "signatures" : "files";
  }
  return fileFormKeys.includes(key) ? "files" : "forms";
}

/* ─── Avatar ─── */
function OwnerAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- dynamic owner avatar URL from Supabase, dimensions unknown at render time
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

/* ─── Instance flattening ─── */

type DocInstance = {
  owner: DocHubOwner;
  docKey: DocKey;
  title: string;
  kind: FilterKind;
  /** Signature documents only — powers the stage meter. */
  stage: DocumentStage | null;
  statusLabel: string;
  statusTone: "done" | "pending" | "idle";
  updatedAt: string | null;
};

function buildInstances(owners: DocHubOwner[]): DocInstance[] {
  const instances: DocInstance[] = [];
  for (const owner of owners) {
    for (const key of secureKeys) {
      const entry = owner.secureDocs[key];
      if (!entry.latest) continue;
      const row = entry.latest;
      instances.push({
        owner,
        docKey: key,
        title: SECURE_DOC_TYPES[key].label,
        kind: kindOfDocKey(key),
        stage: stageOfSignedDoc(row),
        statusLabel: entry.status === "completed" ? "Done" : "Waiting",
        statusTone: entry.status === "completed" ? "done" : "pending",
        updatedAt: row.signedAt ?? row.sentAt ?? row.createdAt,
      });
    }
    for (const key of formKeys) {
      const entry = owner.forms[key];
      if (!entry.submitted) continue;
      instances.push({
        owner,
        docKey: key,
        title: FORM_TYPES[key].label,
        kind: kindOfDocKey(key),
        stage: null,
        statusLabel: "Submitted",
        statusTone: "done",
        updatedAt: null,
      });
    }
  }
  return instances.sort((a, b) => {
    if (a.updatedAt && b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
    if (a.updatedAt) return -1;
    if (b.updatedAt) return 1;
    return a.owner.fullName.localeCompare(b.owner.fullName);
  });
}

/* ─── Main hub ─── */
export function DocumentsHub({
  owners,
  actionQueue,
  coverageGroups,
}: {
  owners: DocHubOwner[];
  actionQueue: ActionQueueItem[];
  coverageGroups: CoverageColumnGroup[];
}) {
  const [filter, setFilter] = useState<FilterKind>("all");
  const [view, setView] = useState<"list" | "coverage">("list");
  const [drawerEntry, setDrawerEntry] = useState<{
    owner: DocHubOwner;
    docKey: DocKey;
  } | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  /* Action queue primary-action progress */
  const [queueBusyId, setQueueBusyId] = useState<string | null>(null);
  const [, startQueueTransition] = useTransition();

  /* Signature rows by document id — powers the queue's stage meters + chips */
  const rowsByDocumentId = useMemo(() => {
    const map = new Map<string, SignedDocRow>();
    for (const owner of owners) {
      for (const key of secureKeys) {
        for (const version of owner.secureDocs[key].versions) {
          map.set(version.id, version);
        }
      }
    }
    return map;
  }, [owners]);

  const ownersByProfileId = useMemo(() => {
    const map = new Map<string, DocHubOwner>();
    for (const owner of owners) {
      if (owner.profileId) map.set(owner.profileId, owner);
    }
    return map;
  }, [owners]);

  const instances = useMemo(() => buildInstances(owners), [owners]);

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
    setFilter(kindOfDocKey(docKey));
    setDrawerEntry({ owner, docKey });
  }, [owners]);

  const visibleInstances = useMemo(
    () => (filter === "all" ? instances : instances.filter((i) => i.kind === filter)),
    [instances, filter],
  );

  const kindCounts = useMemo(() => {
    const counts: Record<FilterKind, number> = {
      all: instances.length,
      signatures: 0,
      forms: 0,
      files: 0,
    };
    for (const instance of instances) counts[instance.kind]++;
    return counts;
  }, [instances]);

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
      setNotice({ tone: "error", text: "Owner not found. Refresh and retry." });
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

  return (
    <div className={styles.page}>
      {/* Result / error banner for queue + coverage actions */}
      {notice && (
        <div
          className={notice.tone === "success" ? styles.successBanner : styles.errorBanner}
          role="status"
        >
          {notice.text}
        </div>
      )}

      {/* Needs Action queue — the hero, always first */}
      {actionQueue.length > 0 && (
        <ActionQueue
          items={actionQueue}
          onAction={handleQueueAction}
          onView={(item) => openDrawerFor(item.owner_id, item.document_key)}
          busyId={queueBusyId}
          rowsByDocumentId={rowsByDocumentId}
        />
      )}

      {/* View switch + kind chips */}
      <div className={styles.listControls}>
        <div className={styles.viewSwitch} role="group" aria-label="Documents view">
          <button
            type="button"
            className={`${styles.viewBtn} ${view === "list" ? styles.viewBtnActive : ""}`}
            onClick={() => setView("list")}
          >
            <ListBullets size={13} weight="bold" />
            List
          </button>
          <button
            type="button"
            className={`${styles.viewBtn} ${view === "coverage" ? styles.viewBtnActive : ""}`}
            onClick={() => setView("coverage")}
          >
            <GridNine size={13} weight="bold" />
            Coverage
          </button>
        </div>

        {view === "list" && (
          <div className={styles.filterChips}>
            {(["all", "signatures", "forms", "files"] as FilterKind[]).map((f) => (
              <button
                key={f}
                className={`${styles.chip} ${filter === f ? styles.chipActive : ""}`}
                onClick={() => setFilter(f)}
                type="button"
              >
                {f === "all" && <Files size={13} weight="duotone" />}
                {f === "signatures" && <PenNib size={13} weight="duotone" />}
                {f === "forms" && <HouseSimple size={13} weight="duotone" />}
                {f === "files" && <FileArrowUp size={13} weight="duotone" />}
                {f === "all"
                  ? "All"
                  : f === "signatures"
                  ? "Signatures"
                  : f === "forms"
                  ? "Forms"
                  : "Files"}
                <span className={styles.chipCount}>{kindCounts[f]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "coverage" ? (
        <CoverageView
          owners={owners}
          groups={coverageGroups}
          onOpen={(owner, docKey) => setDrawerEntry({ owner, docKey })}
          onNotice={setNotice}
        />
      ) : visibleInstances.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Files size={48} weight="duotone" />
          </div>
          <p className={styles.emptyTitle}>
            {instances.length === 0 ? "No documents yet" : "Nothing in this kind yet"}
          </p>
          <p className={styles.emptyBody}>
            {instances.length === 0
              ? "Documents appear here when you send a template or a form to an owner."
              : "Try another kind chip, or send something new from the Templates or Forms tab."}
          </p>
        </div>
      ) : (
        <div className={styles.instanceList} role="list">
          {visibleInstances.map((instance) => (
            <div
              key={`${instance.owner.contactId}-${instance.docKey}`}
              className={styles.instanceRow}
              role="button"
              tabIndex={0}
              onClick={() => setDrawerEntry({ owner: instance.owner, docKey: instance.docKey })}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                setDrawerEntry({ owner: instance.owner, docKey: instance.docKey })
              }
            >
              <OwnerAvatar name={instance.owner.fullName} url={instance.owner.avatarUrl} />
              <span className={styles.instanceMeta}>
                <span className={styles.instanceTitle}>{instance.title}</span>
                <span className={styles.instanceOwner}>{instance.owner.fullName}</span>
              </span>
              {instance.stage ? (
                <span className={styles.instanceStage}>
                  <StageMeter stage={instance.stage} compact />
                </span>
              ) : (
                <span
                  className={`${styles.statusPill} ${
                    instance.statusTone === "done"
                      ? styles.pillDone
                      : instance.statusTone === "pending"
                      ? styles.pillPending
                      : styles.pillIdle
                  }`}
                >
                  {instance.statusLabel}
                </span>
              )}
              <span className={styles.instanceTime}>
                {instance.updatedAt ? fmtRelativeTime(instance.updatedAt) : ""}
              </span>
            </div>
          ))}
        </div>
      )}

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

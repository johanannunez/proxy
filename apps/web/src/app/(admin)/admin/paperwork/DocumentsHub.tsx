"use client";

/**
 * Documents tab. Opens onto the Needs Action triage queue, then the workspace
 * Status Board: a completion matrix of every workspace against the documents,
 * forms, and files it requires (grouped Signatures / Forms / Files), wired to
 * real data. The owner-centric Needs Action queue keeps its detail drawer; the
 * old List / Coverage views were replaced by the Status Board.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence } from "motion/react";
import {
  SECURE_DOC_TYPES,
  FORM_TYPES,
  type DocHubOwner,
  type SecureDocKey,
  type FormKey,
  type SignedDocRow,
} from "@/lib/admin/documents-hub-shared";
import type { ActionQueueItem } from "@/lib/admin/action-queue-types";
import type { StatusBoard } from "@/lib/admin/status-board-types";
import { StatusBoardView } from "@/components/admin/status-board/StatusBoardView";
import { DocumentDrawer } from "./DocumentDrawer";
import { ActionQueue } from "./ActionQueue";
import { sendDocumentToOwner, sendDocumentReminder } from "./document-actions";
import styles from "./DocumentsHub.module.css";

type DocKey = SecureDocKey | FormKey;

const secureKeys = Object.keys(SECURE_DOC_TYPES) as SecureDocKey[];
const formKeys = Object.keys(FORM_TYPES) as FormKey[];

/* ─── Main hub ─── */
export function DocumentsHub({
  owners,
  actionQueue,
  statusBoard,
}: {
  owners: DocHubOwner[];
  actionQueue: ActionQueueItem[];
  statusBoard: StatusBoard;
}) {
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

  /* Deep link: ?owner=<id>&doc=<key> opens that document's drawer directly. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ownerParam = params.get("owner");
    const docParam = params.get("doc");
    if (!ownerParam || !docParam) return;
    if (![...secureKeys, ...formKeys].includes(docParam as DocKey)) return;

    const owner = owners.find(
      (entry) => entry.profileId === ownerParam || entry.contactId === ownerParam,
    );
    if (!owner) return;
    setDrawerEntry({ owner, docKey: docParam as DocKey });
  }, [owners]);

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
      {/* Result / error banner for queue actions */}
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

      {/* Workspace Status Board — the completion matrix */}
      <StatusBoardView board={statusBoard} />

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

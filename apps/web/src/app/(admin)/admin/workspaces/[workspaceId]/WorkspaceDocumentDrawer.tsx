"use client";

import { useTransition, type CSSProperties } from "react";
import {
  ArrowSquareOut,
  Bell,
  CalendarBlank,
  CheckCircle,
  Clock,
  DownloadSimple,
  FileText,
  PaperPlaneTilt,
  X,
  XCircle,
} from "@phosphor-icons/react";
import type { WorkspaceDocument } from "@/lib/admin/workspace-documents";
import type { DocumentLifecycleDefinition } from "@/lib/admin/documents-hub-shared";
import { sendWorkspaceDocumentReminderAction } from "./workspace-document-actions";
import styles from "./DocumentsTab.module.css";

export type WorkspaceDocumentCard = {
  definition: DocumentLifecycleDefinition;
  document: WorkspaceDocument | undefined;
  versions: WorkspaceDocument[];
  state: "needed" | "requested" | "ready" | "expiring" | "expired";
};

type WorkspaceDocumentDrawerProps = {
  card: WorkspaceDocumentCard;
  owner: {
    profileId: string;
    fullName: string;
    email: string;
  };
  workspaceId: string;
  pending: boolean;
  onClose: () => void;
  onSend: () => void;
  onMessage: (message: string | null) => void;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Not captured";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabel(state: WorkspaceDocumentCard["state"]): string {
  if (state === "requested") return "Requested";
  if (state === "ready") return "Ready";
  if (state === "expiring") return "Expiring";
  if (state === "expired") return "Expired";
  return "Needed";
}

function statusIcon(state: WorkspaceDocumentCard["state"]) {
  if (state === "ready") return <CheckCircle size={16} weight="fill" />;
  if (state === "requested") return <Clock size={16} weight="fill" />;
  if (state === "expired" || state === "expiring") return <XCircle size={16} weight="fill" />;
  return <FileText size={16} weight="duotone" />;
}

export function WorkspaceDocumentDrawer({
  card,
  owner,
  workspaceId,
  pending,
  onClose,
  onSend,
  onMessage,
}: WorkspaceDocumentDrawerProps) {
  const [reminderPending, startReminderTransition] = useTransition();
  const { definition, document, versions, state } = card;
  const archivedVersions = versions.filter((version) => version.id !== document?.id);

  function sendReminder() {
    if (!document?.id || !document.boldsignDocumentId) {
      onMessage("This document does not have a reminder link yet.");
      return;
    }
    const boldsignDocumentId = document.boldsignDocumentId;

    startReminderTransition(async () => {
      const result = await sendWorkspaceDocumentReminderAction({
        workspaceId,
        documentId: document.id,
        boldsignDocumentId,
        email: owner.email,
      });
      onMessage(result.ok ? `${definition.label} reminder sent.` : result.error ?? "Could not send reminder.");
    });
  }

  return (
    <div className={styles.drawerLayer}>
      <button className={styles.drawerBackdrop} onClick={onClose} type="button" />
      <aside
        className={styles.drawer}
        style={{ "--document-accent": definition.color } as CSSProperties}
        aria-label={`${definition.label} details`}
      >
        <div className={styles.drawerHeader}>
          <div>
            <div className={`${styles.drawerStatus} ${styles[`drawerStatus_${state}`]}`}>
              {statusIcon(state)}
              {statusLabel(state)}
            </div>
            <h3 className={styles.drawerTitle}>{definition.label}</h3>
            <p className={styles.drawerSubtitle}>{definition.description}</p>
          </div>
          <button className={styles.iconButton} onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>

        <div className={styles.drawerSection}>
          <h4 className={styles.drawerSectionTitle}>Current status</h4>
          <div className={styles.drawerGrid}>
            <div>
              <span>Owner</span>
              <strong>{owner.fullName}</strong>
            </div>
            <div>
              <span>Type</span>
              <strong>{definition.kind === "secure_doc" ? "SecureDoc" : definition.kind}</strong>
            </div>
            <div>
              <span>Sent</span>
              <strong>{formatDate(document?.createdAt)}</strong>
            </div>
            <div>
              <span>Signed or received</span>
              <strong>{formatDate(document?.signedAt)}</strong>
            </div>
          </div>
        </div>

        {definition.expiration.expires ? (
          <div className={styles.drawerSection}>
            <h4 className={styles.drawerSectionTitle}>Expiration and renewal</h4>
            <div className={styles.expirationPanel}>
              <CalendarBlank size={18} weight="duotone" />
              <div>
                <strong>
                  {document?.expiresAt ? `Expires ${formatDate(document.expiresAt)}` : "Expiration date not captured yet"}
                </strong>
                <span>
                  {document?.renewalDueAt
                    ? `Renewal should be requested by ${formatDate(document.renewalDueAt)}.`
                    : `Renewal should be requested ${definition.expiration.renewalLeadDays ?? 60} days before this expires.`}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <div className={styles.drawerSection}>
          <h4 className={styles.drawerSectionTitle}>Actions</h4>
          <div className={styles.drawerActions}>
            {state === "needed" && definition.sendable ? (
              <button className={styles.primaryButton} disabled={pending} onClick={onSend} type="button">
                <PaperPlaneTilt size={14} weight="bold" />
                {pending ? "Sending..." : "Send document"}
              </button>
            ) : null}
            {state === "requested" ? (
              <button
                className={styles.primaryButton}
                disabled={reminderPending}
                onClick={sendReminder}
                type="button"
              >
                <Bell size={14} weight="duotone" />
                {reminderPending ? "Sending..." : "Send reminder"}
              </button>
            ) : null}
            {definition.requestable && state === "needed" ? (
              <button className={styles.secondaryButton} disabled type="button">
                Request workflow pending
              </button>
            ) : null}
            {document?.signedPdfUrl ? (
              <a
                className={styles.secondaryLinkButton}
                href={document.signedPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ArrowSquareOut size={14} />
                View document
              </a>
            ) : null}
            {document?.signedPdfUrl ? (
              <a
                className={styles.secondaryLinkButton}
                href={document.signedPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <DownloadSimple size={14} />
                Download
              </a>
            ) : null}
          </div>
        </div>

        <div className={styles.drawerSection}>
          <h4 className={styles.drawerSectionTitle}>Archive</h4>
          {archivedVersions.length === 0 ? (
            <p className={styles.drawerEmptyText}>
              No previous versions yet. When this document is replaced or renewed, older versions will stay here.
            </p>
          ) : (
            <div className={styles.versionList}>
              {archivedVersions.map((version) => (
                <div key={version.id} className={styles.versionRow}>
                  <FileText size={15} weight="duotone" />
                  <div>
                    <strong>{version.templateName}</strong>
                    <span>{version.signedAt ? `Signed ${formatDate(version.signedAt)}` : `Sent ${formatDate(version.createdAt)}`}</span>
                  </div>
                  {version.signedPdfUrl ? (
                    <a href={version.signedPdfUrl} target="_blank" rel="noopener noreferrer">
                      View
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

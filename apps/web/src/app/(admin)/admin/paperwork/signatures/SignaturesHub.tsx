"use client";

/**
 * SignaturesHub — the Signatures tab body (2026-06-14 redesign). Two jobs,
 * deliberately kept distinct from the workspace-centric Status Board:
 *   1. Sent signatures — an owner-centric management list. Each owner shows
 *      their true e-sign documents as status pills; clicking one opens the
 *      DocumentDrawer (audit trail, resend, remind, certificate, mute, reset).
 *   2. Signature library — the reusable signature masters + send sheet.
 * Form masters live on the Forms tab; W-9 + Identity are uploads today and
 * convert to real signatures in Phase 2, so they are not listed here yet.
 */

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  SECURE_DOC_TYPES,
  avatarColor,
  type DocHubOwner,
  type SecureDocKey,
} from "@/lib/admin/documents-hub-shared";
import type { SendRecipient, UnifiedTemplate } from "../templates/unified-types";
import { TemplatesTab } from "../templates/TemplatesTab";
import { DocumentDrawer } from "../DocumentDrawer";
import styles from "./SignaturesHub.module.css";

/** True e-sign instruments (DocuSeal-backed). Order = how they read in a row. */
const SIGNATURE_DOC_KEYS: SecureDocKey[] = [
  "host_rental_agreement",
  "ach_authorization",
  "card_authorization",
];

type SecureStatus = DocHubOwner["secureDocs"][SecureDocKey]["status"];

function statusTone(status: SecureStatus): "complete" | "pending" | "notSent" {
  return status === "completed" ? "complete" : status === "pending" ? "pending" : "notSent";
}

function statusLabel(status: SecureStatus): string {
  return status === "completed" ? "On file" : status === "pending" ? "Awaiting" : "Not sent";
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

export function SignaturesHub({
  owners,
  templates,
  recipients,
}: {
  owners: DocHubOwner[];
  templates: UnifiedTemplate[];
  recipients: SendRecipient[];
}) {
  const [drawerEntry, setDrawerEntry] = useState<{
    owner: DocHubOwner;
    docKey: SecureDocKey;
  } | null>(null);

  /* Deep link from the Action Center (and elsewhere):
     /admin/paperwork/signatures?owner=<profileId|contactId>&doc=<secureDocKey> */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ownerParam = params.get("owner");
    const docParam = params.get("doc");
    if (!ownerParam || !docParam || !(docParam in SECURE_DOC_TYPES)) return;
    const owner = owners.find(
      (o) => o.profileId === ownerParam || o.contactId === ownerParam,
    );
    if (owner) setDrawerEntry({ owner, docKey: docParam as SecureDocKey });
  }, [owners]);

  /* Only owners with at least one signature in flight: the library below is
     where you start a brand-new send. Keeps this list calm and meaningful. */
  const tracked = owners
    .filter((o) => SIGNATURE_DOC_KEYS.some((k) => o.secureDocs[k].status !== "not_sent"))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return (
    <div className={styles.hub}>
      {/* ─── Sent signatures: owner-centric management ─── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Sent signatures</h2>
          <p className={styles.sectionSub}>
            Every owner with a signature in flight. Open one to see its audit
            trail, resend, remind, or download the completed certificate.
          </p>
        </div>

        {tracked.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No signatures sent yet</p>
            <p className={styles.emptyBody}>
              Send a document from the library below and it will appear here so
              you can track it through to completion.
            </p>
          </div>
        ) : (
          <ul className={styles.ownerList}>
            {tracked.map((owner) => (
              <li key={owner.contactId} className={styles.ownerRow}>
                <div className={styles.ownerIdentity}>
                  {owner.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase avatar URL, dimensions unknown
                    <img
                      src={owner.avatarUrl}
                      alt={owner.fullName}
                      className={styles.ownerAvatar}
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <span
                      className={styles.ownerAvatar}
                      style={{ background: avatarColor(owner.fullName) }}
                      aria-hidden
                    >
                      {initialsOf(owner.fullName)}
                    </span>
                  )}
                  <div className={styles.ownerMeta}>
                    <span className={styles.ownerName}>{owner.fullName}</span>
                    <span className={styles.ownerSub}>
                      {owner.propertyCount}{" "}
                      {owner.propertyCount === 1 ? "property" : "properties"}
                    </span>
                  </div>
                </div>

                <div className={styles.docPills}>
                  {SIGNATURE_DOC_KEYS.map((key) => {
                    const entry = owner.secureDocs[key];
                    const def = SECURE_DOC_TYPES[key];
                    const tone = statusTone(entry.status);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`${styles.docPill} ${styles[`docPill_${tone}`]}`}
                        onClick={() => setDrawerEntry({ owner, docKey: key })}
                        aria-label={`${owner.fullName}: ${def.label} — ${statusLabel(entry.status)}. Open to manage.`}
                      >
                        <span className={styles.docPillDot} aria-hidden />
                        <span className={styles.docPillLabel}>{def.rowLabel}</span>
                        <span className={styles.docPillStatus}>
                          {statusLabel(entry.status)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ─── Signature library: masters + send ─── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Signature library</h2>
          <p className={styles.sectionSub}>
            Your reusable signature templates. Send one to an owner, or open it
            to edit its fields and sending settings.
          </p>
        </div>
        <TemplatesTab templates={templates} recipients={recipients} />
      </section>

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

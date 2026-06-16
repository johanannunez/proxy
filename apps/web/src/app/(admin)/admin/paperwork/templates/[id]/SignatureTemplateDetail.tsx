"use client";

/**
 * SignatureTemplateDetail — Fields (DocuSeal field placement) | Settings.
 * Same shape as the form template detail minus responses: signature templates
 * collect signatures, not form data.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  FilePdf,
  PencilSimple,
  Check,
  X,
  Lock,
  Plus,
} from "@phosphor-icons/react";
import ConfirmModal from "@/components/admin/ConfirmModal";
import type { DocumentTemplate } from "@/lib/admin/document-templates-types";
import { DocuSealBuilderView } from "../DocuSealBuilderView";
import { TemplateEditor } from "./TemplateEditor";
import {
  activateTemplate,
  deactivateTemplate,
  updateTemplateTracking,
  updateTemplateMeta,
} from "../template-actions";
import type { MetaEditInput } from "../template-meta";
import { CoverageSettingsCard } from "./CoverageSettingsCard";
import { SendingSettings } from "./SendingSettings";
import { signerRolesLabel } from "../signer-roles";
import styles from "./TemplateDetail.module.css";

type TabKey = "write" | "fields" | "settings";

// Client-side signer parties. "You" (stored as "Proxy") is the final
// countersigner, handled separately, so it is not in this list.
const CLIENT_ROLES = ["Owner", "Tenant", "Co-owner"];

/**
 * One inline-editable text row. Idle shows the value with a pencil that appears
 * on hover; editing swaps in an input (or textarea) with Save + Cancel. Saves
 * optimistically through a transition and refreshes the route on success.
 */
function EditableTextRow({
  label,
  value,
  placeholder,
  multiline,
  mono,
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  mono?: boolean;
  onSave: (next: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function begin() {
    setDraft(value);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await onSave(draft);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className={`${styles.fieldRow} ${styles.editRowFull}`}>
        <span className={styles.fieldLabel}>{label}</span>
        <div className={styles.editForm}>
          {multiline ? (
            <textarea
              className={`${styles.editInput} ${styles.editTextarea}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              autoFocus
            />
          ) : (
            <input
              type="text"
              className={`${styles.editInput} ${mono ? styles.editInputMono : ""}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancel();
                }
              }}
            />
          )}
          {error && <span className={styles.editError}>{error}</span>}
          <div className={styles.editActions}>
            <button type="button" className={styles.editSave} onClick={save} disabled={pending}>
              <Check size={13} weight="bold" />
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" className={styles.editCancel} onClick={cancel} disabled={pending}>
              <X size={13} weight="bold" />
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.fieldValueWrap}>
        <span
          className={`${styles.fieldValue} ${mono ? styles.fieldValueMono : ""} ${
            value ? "" : styles.fieldValueMuted
          }`}
        >
          {value || placeholder || "Not set"}
        </span>
        <button type="button" className={styles.editBtn} onClick={begin} aria-label={`Edit ${label}`}>
          <PencilSimple size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}

/**
 * Locked read-only row: shows the value with a lock icon and an explanatory
 * hint. Used for document key and signer roles once documents have been sent.
 */
function LockedRow({
  label,
  value,
  mono,
  hint,
}: {
  label: string;
  value: string;
  mono?: boolean;
  hint: string;
}) {
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.editForm}>
        <div className={styles.fieldValueWrap}>
          <span className={`${styles.fieldValue} ${mono ? styles.fieldValueMono : ""}`}>{value}</span>
          <Lock size={13} weight="fill" className={styles.lockIcon} />
        </div>
        <span className={styles.lockedHint}>{hint}</span>
      </div>
    </div>
  );
}

/**
 * Inline signer-roles editor. Mirrors the CreateTemplateModal signing-order
 * pattern: client signers as numbered rows, "You" (stored as "Proxy") pinned
 * last as the countersigner. Reconstructs signer_roles with Proxy last on save.
 */
function SignerRolesEditor({
  signerRoles,
  onSave,
}: {
  signerRoles: string[];
  onSave: (roles: string[]) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const youSignsInitial = signerRoles.includes("Proxy");
  const clientInitial = signerRoles.filter((r) => r !== "Proxy");

  const [editing, setEditing] = useState(false);
  const [clientSigners, setClientSigners] = useState<string[]>(clientInitial);
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [youSigns, setYouSigns] = useState(youSignsInitial);
  const [newRole, setNewRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function begin() {
    setClientSigners(signerRoles.filter((r) => r !== "Proxy"));
    setYouSigns(signerRoles.includes("Proxy"));
    setCustomRoles([]);
    setNewRole("");
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  const availableToAdd = [...CLIENT_ROLES, ...customRoles].filter((r) => !clientSigners.includes(r));

  function addSigner(role: string) {
    if (!clientSigners.includes(role)) setClientSigners((prev) => [...prev, role]);
  }

  function removeSigner(role: string) {
    setClientSigners((prev) => prev.filter((r) => r !== role));
  }

  function addCustomRole() {
    const role = newRole.trim();
    if (!role) return;
    if (![...CLIENT_ROLES, ...customRoles].some((r) => r.toLowerCase() === role.toLowerCase())) {
      setCustomRoles((prev) => [...prev, role]);
    }
    addSigner(role);
    setNewRole("");
  }

  function save() {
    setError(null);
    const roles = [...clientSigners, ...(youSigns ? ["Proxy"] : [])];
    startTransition(async () => {
      const res = await onSave(roles);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>Signer roles</span>
        <div className={styles.fieldValueWrap}>
          <span className={styles.fieldValue}>{signerRolesLabel(signerRoles)}</span>
          <button
            type="button"
            className={styles.editBtn}
            onClick={begin}
            aria-label="Edit signer roles"
          >
            <PencilSimple size={14} weight="bold" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.fieldRow} ${styles.editRowFull}`}>
      <span className={styles.fieldLabel}>Signer roles</span>
      <div className={styles.signerEditor}>
        <div className={styles.signerList}>
          {clientSigners.map((role, i) => (
            <div key={role} className={styles.signerRow}>
              <span className={styles.signerNum}>{i + 1}</span>
              <span className={styles.signerName}>{role}</span>
              <span className={styles.signerMeta}>signs first</span>
              <button
                type="button"
                className={styles.signerRemove}
                onClick={() => removeSigner(role)}
                aria-label={`Remove ${role}`}
                disabled={clientSigners.length === 1}
              >
                <X size={13} weight="bold" />
              </button>
            </div>
          ))}
          <div
            className={`${styles.signerRow} ${styles.signerYou} ${
              youSigns ? "" : styles.signerYouOff
            }`}
          >
            <span className={styles.signerNum}>
              {youSigns ? clientSigners.length + 1 : "—"}
            </span>
            <span className={styles.signerName}>You</span>
            <span className={styles.signerMeta}>{youSigns ? "sign last" : "not signing"}</span>
            <button
              type="button"
              role="switch"
              aria-checked={youSigns}
              aria-label="You countersign"
              className={`${styles.signerToggle} ${youSigns ? styles.signerToggleOn : ""}`}
              onClick={() => setYouSigns((v) => !v)}
            >
              <span className={styles.signerToggleThumb} />
            </button>
          </div>
        </div>
        <div className={styles.addSignerRow}>
          {availableToAdd.map((role) => (
            <button
              key={role}
              type="button"
              className={styles.addSignerChip}
              onClick={() => addSigner(role)}
            >
              <Plus size={12} weight="bold" /> {role}
            </button>
          ))}
          <input
            type="text"
            className={styles.addRoleInput}
            placeholder="Add a signer (e.g. Guarantor)"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomRole();
              }
            }}
          />
        </div>
        {error && <span className={styles.editError}>{error}</span>}
        <div className={styles.editActions}>
          <button
            type="button"
            className={styles.editSave}
            onClick={save}
            disabled={pending || clientSigners.length === 0}
          >
            <Check size={13} weight="bold" />
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" className={styles.editCancel} onClick={cancel} disabled={pending}>
            <X size={13} weight="bold" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function SignatureSettings({
  template,
  missingRoles,
  hasBeenSent,
  onGoToFields,
}: {
  template: DocumentTemplate;
  missingRoles: string[] | null;
  hasBeenSent: boolean;
  onGoToFields: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // When coverage is known and a signer still lacks a field, the template can't
  // be sent regardless of is_active. Surface that first and route to Fields.
  const needsFields = missingRoles !== null && missingRoles.length > 0;

  function saveMeta(input: MetaEditInput) {
    return updateTemplateMeta(template.id, input);
  }

  function handleDeactivate() {
    setConfirmRemove(false);
    setError(null);
    startTransition(async () => {
      const res = await deactivateTemplate(template.id);
      if (!res.ok) {
        setError(res.error ?? "Could not remove the template.");
        return;
      }
      router.push("/admin/paperwork/templates");
      router.refresh();
    });
  }

  return (
    <div className={styles.settingsWrap}>
      <div className={styles.settingsCol}>
      <div className={styles.settingsCard}>
        <h3 className={styles.settingsTitle}>About this template</h3>
        <EditableTextRow
          label="Name"
          value={template.display_name}
          placeholder="Template name"
          onSave={(next) => saveMeta({ display_name: next })}
        />
        <EditableTextRow
          label="Description"
          value={template.description ?? ""}
          placeholder="What is this document for?"
          multiline
          onSave={(next) => saveMeta({ description: next })}
        />
        {hasBeenSent ? (
          <LockedRow
            label="Document key"
            value={template.document_key}
            mono
            hint="Locked because documents have been sent under this key."
          />
        ) : (
          <EditableTextRow
            label="Document key"
            value={template.document_key}
            placeholder="document_key"
            mono
            onSave={(next) => saveMeta({ document_key: next })}
          />
        )}
        {hasBeenSent ? (
          <LockedRow
            label="Signer roles"
            value={signerRolesLabel(template.signer_roles)}
            hint="Locked after first send."
          />
        ) : (
          <SignerRolesEditor
            signerRoles={template.signer_roles}
            onSave={(roles) => saveMeta({ signer_roles: roles })}
          />
        )}
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Countersignature</span>
          <span className={styles.fieldValue}>
            {template.requires_countersignature
              ? "You countersign after the client"
              : "Not required"}
          </span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Status</span>
          <span className={styles.fieldValue}>
            {needsFields ? (
              <span className={styles.statusFieldsNeeded}>
                <span className={`${styles.statusPill} ${styles.statusDraft}`}>
                  Needs fields for: {signerRolesLabel(missingRoles)}
                </span>
                <button
                  type="button"
                  className={styles.toggleBtn}
                  onClick={onGoToFields}
                >
                  Add fields
                </button>
              </span>
            ) : (
              <span
                className={`${styles.statusPill} ${
                  template.is_active && template.docuseal_template_id
                    ? styles.statusLive
                    : styles.statusDraft
                }`}
              >
                {template.is_active && template.docuseal_template_id
                  ? "Ready to send"
                  : "Draft: finish the field layout"}
              </span>
            )}
          </span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Source</span>
          <span className={styles.fieldValue}>
            {template.is_system ? "Proxy library template" : "Your custom template"}
          </span>
        </div>
      </div>

      <CoverageSettingsCard
        tracked={template.tracked}
        category={template.category}
        onSave={(updates) => updateTemplateTracking(template.id, updates)}
      />

      {!template.is_system && (
        <div className={styles.settingsCard}>
          <h3 className={styles.settingsTitle}>Danger zone</h3>
          <div className={styles.settingRow}>
            <div className={styles.settingMeta}>
              <span className={styles.settingLabel}>Remove this template</span>
              <span className={styles.settingDesc}>
                Deactivates the template so it can no longer be sent. Documents
                already out for signature are unaffected.
              </span>
            </div>
            <button
              type="button"
              className={`${styles.toggleBtn} ${styles.toggleBtnDanger}`}
              onClick={() => setConfirmRemove(true)}
              disabled={pending}
            >
              {pending ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      )}

      {error && <p className={styles.errorNote}>{error}</p>}
      </div>

      <div className={styles.settingsCol}>
        <SendingSettings templateId={template.id} settings={template.settings} />
      </div>

      <ConfirmModal
        open={confirmRemove}
        title="Remove this template?"
        description={`"${template.display_name}" will no longer be sendable. Documents already out for signature keep working.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleDeactivate}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}

export function SignatureTemplateDetail({
  template,
  initialTab,
  missingRoles,
  hasBeenSent,
}: {
  template: DocumentTemplate;
  initialTab: TabKey;
  missingRoles: string[] | null;
  hasBeenSent: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [name, setName] = useState(template.display_name);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(template.display_name);
  const [savingName, setSavingName] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  // The document name is the single source of truth (display_name). Editing it
  // here pushes the new name into DocuSeal so the document name matches.
  async function saveName() {
    const next = draftName.trim();
    if (!next || next === name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    const res = await updateTemplateMeta(template.id, { display_name: next });
    setSavingName(false);
    if (res.ok) {
      setName(next);
      setEditingName(false);
      router.refresh();
    }
  }

  async function handleDone() {
    setFinishing(true);
    setFinishError(null);
    // The readiness gate can refuse activation (a signer has no field). Do NOT
    // call router.refresh() after push: it races the navigation. The library is
    // force-dynamic and refetches itself.
    const result = await activateTemplate(template.id);
    if (!result.ok) {
      setFinishError(result.error ?? "Could not finish. Try again.");
      setFinishing(false);
      return;
    }
    router.push("/admin/paperwork/templates");
  }

  // HTML-authored templates (source_html is non-null) get a Write tab for
  // editing content in Proxy. PDF templates (source_html null) do not.
  const tabs: Array<{ key: TabKey; label: string }> = [
    ...(template.source_html !== null
      ? [{ key: "write" as const, label: "Write" }]
      : []),
    { key: "fields", label: "Fields" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className={styles.root}>
      <div
        className={styles.tabBar}
        role="tablist"
        aria-label={`${template.display_name} sections`}
      >
        <Link href="/admin/paperwork/templates" className={styles.crumb}>
          <ArrowLeft size={13} weight="bold" />
          Templates
        </Link>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {tab === t.key && (
              <motion.span
                layoutId="template-detail-tab"
                className={styles.tabIndicator}
                aria-hidden
              />
            )}
          </button>
        ))}

        {tab === "fields" && template.docuseal_template_id && (
          <div className={styles.builderTools}>
            {editingName ? (
              <span className={styles.nameEdit}>
                <input
                  className={styles.nameInput}
                  value={draftName}
                  autoFocus
                  disabled={savingName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") {
                      setDraftName(name);
                      setEditingName(false);
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.nameAction}
                  onClick={saveName}
                  disabled={savingName}
                  aria-label="Save name"
                >
                  <Check size={14} weight="bold" />
                </button>
                <button
                  type="button"
                  className={styles.nameAction}
                  onClick={() => {
                    setDraftName(name);
                    setEditingName(false);
                  }}
                  aria-label="Cancel"
                >
                  <X size={14} weight="bold" />
                </button>
              </span>
            ) : (
              <button
                type="button"
                className={styles.nameButton}
                onClick={() => {
                  setDraftName(name);
                  setEditingName(true);
                }}
                title="Rename document"
              >
                <span className={styles.nameText}>{name}</span>
                <PencilSimple size={13} weight="bold" className={styles.namePencil} />
              </button>
            )}
            <button
              type="button"
              className={styles.doneBtn}
              onClick={handleDone}
              disabled={finishing}
            >
              {finishing ? "Finishing…" : "Done"}
            </button>
          </div>
        )}
      </div>

      {finishError && tab === "fields" && (
        <p className={styles.builderError}>{finishError}</p>
      )}

      <div className={styles.content}>
        {tab === "write" && (
          <TemplateEditor
            templateId={template.id}
            initialHtml={template.source_html ?? ""}
            hasExistingDocusealId={template.docuseal_template_id !== null}
          />
        )}
        {tab === "fields" &&
          (template.docuseal_template_id ? (
            <DocuSealBuilderView
              templateId={template.docuseal_template_id}
              dbTemplateId={template.id}
            />
          ) : template.source_html !== null ? (
            <div className={styles.builderEmpty}>
              <PencilSimple size={40} weight="duotone" />
              <p className={styles.builderEmptyTitle}>Write the document first</p>
              <p className={styles.builderEmptyBody}>
                Save your content on the Write tab. Field placement opens here
                automatically once the document has been saved.
              </p>
            </div>
          ) : (
            <div className={styles.builderEmpty}>
              <FilePdf size={40} weight="duotone" />
              <p className={styles.builderEmptyTitle}>No PDF uploaded yet</p>
              <p className={styles.builderEmptyBody}>
                This template has no document behind it. Use the New document
                button and choose Upload a PDF to create a fresh template with
                a field layout.
              </p>
            </div>
          ))}
        {tab === "settings" && (
          <SignatureSettings
            template={template}
            missingRoles={missingRoles}
            hasBeenSent={hasBeenSent}
            onGoToFields={() => setTab("fields")}
          />
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { CustomSelect } from "@/components/admin/CustomSelect";
import s from "./PersonalInfoSection.module.css";
import x from "./SettingsShared.module.css";
import { updateWorkspaceBusinessEntity } from "@/lib/admin/settings-actions";

// Values mirror the workspaces.type values written on creation (WorkspaceForm)
// and the admin display maps (WorkspaceDetailShell). Storing the display string
// here is the bug this list fixes: "LLC" never matched the lowercase "llc" the
// rest of the app keys on, so the entity type rendered without a label.
const BUSINESS_ENTITY_TYPE_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "individual", label: "Individual" },
  { value: "llc", label: "LLC" },
  { value: "partnership", label: "Partnership" },
  { value: "trust", label: "Trust" },
  { value: "s_corp", label: "S Corporation" },
  { value: "c_corp", label: "C Corporation" },
] as const;

type BusinessEntityType = (typeof BUSINESS_ENTITY_TYPE_OPTIONS)[number]["value"];

export type CoOwner = {
  id: string;
  fullName: string;
  email: string;
  role: "primary" | "member";
};

type Props = {
  workspace: {
    id: string;
    name: string;
    type: string | null;
    ein: string | null;
    notes: string | null;
  };
  coOwners: CoOwner[];
};

export function BusinessEntitySection({ workspace, coOwners }: Props) {
  const [name, setName] = useState(workspace.name);
  const [type, setType] = useState<string>(workspace.type ?? "");
  const [ein, setEin] = useState(workspace.ein ?? "");
  const [notes, setNotes] = useState(workspace.notes ?? "");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<null | { ok: boolean; msg: string }>(null);

  const dirty =
    name.trim() !== workspace.name ||
    (type || "") !== (workspace.type ?? "") ||
    ein.trim() !== (workspace.ein ?? "") ||
    notes.trim() !== (workspace.notes ?? "");

  function onSave() {
    setStatus(null);
    startTransition(async () => {
      const res = await updateWorkspaceBusinessEntity({
        workspaceId: workspace.id,
        name: name.trim(),
        type: type as BusinessEntityType,
        ein: ein.trim(),
        notes: notes.trim(),
      });
      setStatus(
        res.ok
          ? { ok: true, msg: "Workspace details saved." }
          : { ok: false, msg: res.error },
      );
    });
  }

  return (
    <div>
      <header className={s.sectionHeader}>
        <h2 className={s.sectionTitle}>Business entity</h2>
        <p className={s.sectionSubtitle}>
          Legal entity that holds this owner&rsquo;s properties on paper.
        </p>
      </header>

      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Business entity information</span>
          <span className={s.adminPill}>Admin edit</span>
        </div>
        <div className={s.cardBody}>
          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>Legal name</label>
              <span className={s.labelHint}>
                Exactly as it appears on formation docs.
              </span>
            </div>
            <div className={s.fieldCell}>
              <input
                className={s.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Cascade House Holdings LLC"
              />
            </div>
          </div>

          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>Entity type</label>
              <span className={s.labelHint}>Determines tax reporting.</span>
            </div>
            <div className={s.fieldCell}>
              <CustomSelect
                value={type}
                onChange={setType}
                options={[...BUSINESS_ENTITY_TYPE_OPTIONS]}
              />
            </div>
          </div>

          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>EIN</label>
              <span className={s.labelHint}>Federal tax ID. Format 12-3456789.</span>
            </div>
            <div className={s.fieldCell}>
              <input
                className={s.input}
                value={ein}
                onChange={(e) => setEin(e.target.value)}
                placeholder="12-3456789"
              />
            </div>
          </div>

          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>Admin notes</label>
              <span className={s.labelHint}>
                Structure, filings, beneficial owners.
              </span>
            </div>
            <div className={s.fieldCell}>
              <textarea
                className={s.textarea}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Single-member LLC. Beneficial owner: …"
              />
            </div>
          </div>

          {status && !status.ok && (
            <div className={s.inlineError}>{status.msg}</div>
          )}
          {status && status.ok && (
            <div className={s.inlineSuccess}>{status.msg}</div>
          )}
        </div>
        <div className={s.cardFooter}>
          <p className={s.cardFooterHint}>
            Saved changes appear in admin activity.
          </p>
          <div className={s.cardFooterActions}>
            <button
              type="button"
              className={s.btnGhost}
              disabled={!dirty || pending}
              onClick={() => {
                setName(workspace.name);
                setType(workspace.type ?? "");
                setEin(workspace.ein ?? "");
                setNotes(workspace.notes ?? "");
                setStatus(null);
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className={s.btnPrimary}
              disabled={!dirty || pending}
              onClick={onSave}
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </section>

      {/* Co-owners */}
      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Co-owners</span>
        </div>
        <p className={s.cardHeaderSub}>
          Profiles linked to this workspace. The primary member is the legal owner of record.
        </p>
        <ul className={x.list}>
          {coOwners.map((p) => (
            <li key={p.id} className={x.listItem}>
              <div className={x.listItemIcon}>
                {initials(p.fullName)}
              </div>
              <div className={x.listItemMain}>
                <div className={x.listItemTitle}>{p.fullName}</div>
                <div className={x.listItemSub}>
                  <span>{p.email}</span>
                  <span aria-hidden>·</span>
                  <span className={`${x.pill} ${p.role === "primary" ? x.pillBlue : x.pillSlate}`}>
                    {p.role === "primary" ? "Primary" : "Member"}
                  </span>
                </div>
              </div>
              <div className={x.listItemAction}>
                <button type="button" className={s.btnGhost}>
                  Manage
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className={s.cardFooter}>
          <p className={s.cardFooterHint}>
            Add a member to grant them access to this workspace&rsquo;s portal.
          </p>
          <button type="button" className={s.btnSecondary}>
            <CheckCircle size={14} weight="duotone" /> Invite co-owner
          </button>
        </div>
      </section>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "—";
}

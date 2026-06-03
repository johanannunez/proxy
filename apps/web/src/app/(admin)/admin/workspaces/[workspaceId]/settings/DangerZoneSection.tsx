"use client";

import { useState } from "react";
import { Warning, Prohibit, Trash } from "@phosphor-icons/react";
import s from "./PersonalInfoSection.module.css";
import x from "./SettingsShared.module.css";

type Props = {
  ownerName: string;
};

type ModalKind = null | "deactivate" | "delete";

export function DangerZoneSection({ ownerName }: Props) {
  const [modal, setModal] = useState<ModalKind>(null);
  const [confirmText, setConfirmText] = useState("");

  function close() {
    setModal(null);
    setConfirmText("");
  }

  return (
    <div>
      <header className={s.sectionHeader}>
        <h2 className={s.sectionTitle}>Danger zone</h2>
        <p className={s.sectionSubtitle}>
          Destructive actions. Both require re-confirmation by typing the owner&rsquo;s name.
        </p>
      </header>

      <section className={x.dangerCard}>
        <div className={x.dangerHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(154, 91, 16, 0.12)",
                color: "#9A5B10",
              }}
            >
              <Prohibit size={16} weight="duotone" />
            </div>
            <div className={x.dangerTitle}>Deactivate owner</div>
          </div>
          <button
            type="button"
            className={x.btnDanger}
            onClick={() => setModal("deactivate")}
          >
            Deactivate
          </button>
        </div>
        <div className={x.dangerBody}>
          Hides the owner workspace, pauses payouts, and suspends finance activity. Data is preserved and can be reactivated later.
        </div>
      </section>

      <section className={x.dangerCard}>
        <div className={x.dangerHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(179, 38, 30, 0.1)",
                color: "#B3261E",
              }}
            >
              <Trash size={16} weight="duotone" />
            </div>
            <div className={x.dangerTitle}>Delete owner</div>
          </div>
          <button
            type="button"
            className={x.btnDanger}
            onClick={() => setModal("delete")}
          >
            Delete permanently
          </button>
        </div>
        <div className={x.dangerBody}>
          Removes the owner profile, workspace, properties, and all history. Irreversible. Must be preceded by payout reconciliation.
        </div>
      </section>

      {modal ? (
        <ConfirmModal
          kind={modal}
          ownerName={ownerName}
          confirmText={confirmText}
          onChange={setConfirmText}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

function ConfirmModal({
  kind,
  ownerName,
  confirmText,
  onChange,
  onClose,
}: {
  kind: "deactivate" | "delete";
  ownerName: string;
  confirmText: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const isDelete = kind === "delete";
  const match = confirmText.trim().toLowerCase() === ownerName.trim().toLowerCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11, 27, 43, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#FFFFFF",
          borderRadius: 16,
          boxShadow: "0 32px 80px -18px rgba(11, 27, 43, 0.45)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 22px 14px",
            borderBottom: "1px solid #E6ECF2",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Warning size={20} weight="duotone" color="#B3261E" />
          <div style={{ fontSize: 15, fontWeight: 600, color: "#0B1B2B" }}>
            {isDelete ? "Delete owner permanently" : "Deactivate this owner"}
          </div>
        </div>

        <div style={{ padding: "16px 22px", color: "#3C5266", fontSize: 13, lineHeight: 1.55 }}>
          <p style={{ margin: 0 }}>
            {isDelete
              ? "This removes the owner profile, workspace, properties, and all records. This cannot be undone."
              : "This hides the owner workspace, pauses payouts, and suspends finance activity. You can reactivate later."}
          </p>
          <p style={{ margin: "10px 0 8px", fontSize: 12.5, color: "#647689" }}>
            Type <strong>{ownerName}</strong> to confirm.
          </p>
          <input
            style={{
              width: "100%",
              padding: "9px 12px",
              border: "1px solid #D7DFE8",
              borderRadius: 8,
              fontSize: 13,
              fontFamily: "inherit",
              color: "#0B1B2B",
            }}
            value={confirmText}
            onChange={(e) => onChange(e.target.value)}
            placeholder={ownerName}
            autoFocus
          />
        </div>

        <div
          style={{
            padding: "14px 22px",
            background: "#F9FBFD",
            borderTop: "1px solid #E6ECF2",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #D7DFE8",
              background: "#FFFFFF",
              color: "#0B1B2B",
              fontWeight: 500,
              fontSize: 12.5,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!match}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "0",
              background: match ? "#B3261E" : "#E6ECF2",
              color: match ? "#FFFFFF" : "#8A9AAB",
              fontWeight: 600,
              fontSize: 12.5,
              cursor: match ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}
          >
            {isDelete ? "Delete permanently" : "Deactivate owner"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Copy, CheckCircle, DownloadSimple } from "@phosphor-icons/react";
import styles from "./BackupCodesDisplay.module.css";

export interface BackupCodesDisplayProps {
  /** The 8 plaintext backup codes, shown exactly once. */
  codes: string[];
  /**
   * Called when the user confirms they have saved the codes. The parent
   * decides what happens next (close modal, continue a wizard, etc.).
   */
  onConfirm: () => void;
  /** Optional heading override. */
  title?: string;
  /** Optional supporting copy override. */
  subtitle?: string;
  /** Optional label for the confirm button. */
  confirmLabel?: string;
}

export function BackupCodesDisplay({
  codes,
  onConfirm,
  title = "Save your backup codes",
  subtitle = "Each code works once. Store them somewhere safe. If you lose your authenticator, a backup code is the only way back into your account.",
  confirmLabel = "Continue",
}: BackupCodesDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable. Codes remain visible to copy by hand.
    }
  };

  const handleDownload = () => {
    const content = `Proxy two-factor backup codes\n\nEach code can be used once.\n\n${codes.join(
      "\n",
    )}\n`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "proxy-backup-codes.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>

      <div className={styles.grid}>
        {codes.map((code) => (
          <span key={code} className={styles.code}>
            {code}
          </span>
        ))}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          onClick={handleCopyAll}
          className={styles.secondaryButton}
        >
          {copied ? (
            <CheckCircle size={18} weight="duotone" />
          ) : (
            <Copy size={18} weight="duotone" />
          )}
          {copied ? "Copied" : "Copy all"}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className={styles.secondaryButton}
        >
          <DownloadSimple size={18} weight="duotone" />
          Download
        </button>
      </div>

      <label className={styles.confirmRow}>
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
          className={styles.checkbox}
        />
        <span className={styles.confirmText}>
          I have saved these backup codes somewhere safe.
        </span>
      </label>

      <button
        type="button"
        disabled={!saved}
        onClick={onConfirm}
        className={styles.continueButton}
      >
        {confirmLabel}
      </button>
    </div>
  );
}

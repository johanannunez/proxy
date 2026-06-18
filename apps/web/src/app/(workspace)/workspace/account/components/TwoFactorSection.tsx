"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Warning, X } from "@phosphor-icons/react";
import { TotpEnrollment } from "@/components/auth/TotpEnrollment";
import { BackupCodesDisplay } from "@/components/auth/BackupCodesDisplay";
import ConfirmModal from "@/components/admin/ConfirmModal";
import {
  startTwoFactorEnrollment,
  verifyTwoFactorEnrollment,
  disableTwoFactor,
} from "./two-factor-actions";

type TwoFactorSectionProps = {
  enabled: boolean;
  backupCodesRemaining: number;
  isAdmin: boolean;
  /**
   * Backup codes generated on the server render (one-time display). Present
   * only right after enrollment (?twofa=backup) or a regenerate (?twofa=regen).
   */
  backupCodes: string[] | null;
  /** Distinguishes the just-enrolled headline from the regenerate headline. */
  backupCodesContext: "enroll" | "regen" | null;
};

type EnrollmentData = { factorId: string; qrCode: string; secret: string };

/**
 * Owner self-service two-factor (TOTP) section for the account page.
 *
 * Status comes from the server (enabled, remaining backup codes). Enrollment
 * runs inside a modal: scan + verify. On a successful verify the verify action
 * redirects to ?twofa=backup, where the page generates backup codes
 * server-side and passes them back here for the one-time display. Disable sits
 * behind a danger ConfirmModal and is hidden for admins, who must keep 2FA on.
 */
export default function TwoFactorSection({
  enabled,
  backupCodesRemaining,
  isAdmin,
  backupCodes,
  backupCodesContext,
}: TwoFactorSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const lowBackupCodes = enabled && backupCodesRemaining <= 2;

  const handleEnable = () => {
    setActionError(null);
    startTransition(async () => {
      const result = await startTwoFactorEnrollment();
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setEnrollment({
        factorId: result.factorId,
        qrCode: result.qrCode,
        secret: result.secret,
      });
    });
  };

  const handleRegenerate = () => {
    setActionError(null);
    // Page generates a fresh set server-side and renders the codes modal.
    router.push("/workspace/account?twofa=regen");
  };

  const handleConfirmDisable = () => {
    setConfirmDisableOpen(false);
    setActionError(null);
    startTransition(async () => {
      const result = await disableTwoFactor();
      if (!result.ok) {
        setActionError(result.error ?? "Could not turn off two-factor.");
        return;
      }
      router.refresh();
    });
  };

  // Once the user confirms they saved the codes, drop the query param so the
  // codes are not re-shown on refresh, and re-sync status.
  const handleBackupCodesDone = () => {
    setEnrollment(null);
    router.replace("/workspace/account");
    router.refresh();
  };

  return (
    <section id="two-factor" className="scroll-mt-8">
      <h2
        className="text-xl font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary, #1a1a1a)" }}
      >
        Two-factor authentication
      </h2>
      <p
        className="mt-1 text-sm"
        style={{ color: "var(--color-text-secondary, #6b7280)" }}
      >
        Add a second step at login using an authenticator app. This protects your
        account even if your password is stolen.
      </p>

      <div
        className="mt-5 overflow-hidden rounded-xl border"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white, #ffffff)",
        }}
      >
        <div className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: enabled
                    ? "rgba(22, 163, 74, 0.08)"
                    : "rgba(2, 170, 235, 0.08)",
                  color: enabled
                    ? "var(--color-success, #16a34a)"
                    : "var(--color-brand, #1b77be)",
                }}
              >
                <ShieldCheck size={22} weight="duotone" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: "var(--color-text-primary, #1a1a1a)" }}
                  >
                    Authenticator app
                  </h3>
                  <StatusPill enabled={enabled} />
                </div>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--color-text-secondary, #6b7280)" }}
                >
                  {enabled
                    ? "Two-factor is on. You enter a code from your authenticator app each time you sign in."
                    : "Use Google Authenticator, 1Password, Authy, or any TOTP app."}
                </p>
              </div>
            </div>

            <div className="flex flex-shrink-0">
              {enabled ? (
                !isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDisableOpen(true)}
                    disabled={isPending}
                    className="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
                    style={{
                      borderColor: "rgba(220, 38, 38, 0.30)",
                      color: "var(--color-error, #dc2626)",
                      backgroundColor: "var(--color-white, #ffffff)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "rgba(220, 38, 38, 0.06)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--color-white, #ffffff)";
                    }}
                  >
                    Turn off
                  </button>
                ) : null
              ) : (
                <button
                  type="button"
                  onClick={handleEnable}
                  disabled={isPending}
                  className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: "var(--color-brand, #1b77be)" }}
                >
                  {isPending ? "Starting..." : "Enable two-factor authentication"}
                </button>
              )}
            </div>
          </div>

          {/* Admin notice: required, cannot disable. */}
          {enabled && isAdmin ? (
            <div
              className="mt-4 rounded-lg border px-4 py-3 text-sm"
              style={{
                backgroundColor: "var(--color-warm-gray-50, #f8f7f6)",
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-secondary, #6b7280)",
              }}
            >
              Two-factor authentication is required for admin accounts and cannot
              be turned off.
            </div>
          ) : null}

          {/* Backup codes state, only when enabled. */}
          {enabled ? (
            <div
              className="mt-5 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: "var(--color-warm-gray-200)" }}
            >
              <div className="flex items-start gap-2.5">
                {lowBackupCodes ? (
                  <Warning
                    size={18}
                    weight="fill"
                    style={{
                      color: "var(--color-error, #dc2626)",
                      marginTop: 1,
                      flexShrink: 0,
                    }}
                  />
                ) : null}
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{
                      color: lowBackupCodes
                        ? "var(--color-error, #dc2626)"
                        : "var(--color-text-primary, #1a1a1a)",
                    }}
                  >
                    {backupCodesRemaining}{" "}
                    {backupCodesRemaining === 1
                      ? "backup code"
                      : "backup codes"}{" "}
                    remaining
                  </p>
                  <p
                    className="mt-0.5 text-sm"
                    style={{ color: "var(--color-text-secondary, #6b7280)" }}
                  >
                    {lowBackupCodes
                      ? "You are running low. Regenerate to get a fresh set of 8."
                      : "Backup codes get you back in if you lose your authenticator."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isPending}
                className="flex-shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
                style={{
                  borderColor: "var(--color-warm-gray-200)",
                  color: "var(--color-text-primary, #1a1a1a)",
                  backgroundColor: "var(--color-white, #ffffff)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-warm-gray-50, #f8f7f6)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-white, #ffffff)";
                }}
              >
                Regenerate backup codes
              </button>
            </div>
          ) : null}

          {actionError ? (
            <div
              className="mt-4 rounded-lg border px-4 py-3 text-sm font-medium"
              style={{
                backgroundColor: "rgba(220, 38, 38, 0.08)",
                borderColor: "rgba(220, 38, 38, 0.25)",
                color: "var(--color-error, #dc2626)",
              }}
            >
              {actionError}
            </div>
          ) : null}
        </div>
      </div>

      {/* Enrollment modal: scan + verify. Verify action redirects on success,
          which surfaces the backup-codes modal below, so hide this one then. */}
      {enrollment && !backupCodes ? (
        <ModalShell dismissible onDismiss={() => setEnrollment(null)}>
          <TotpEnrollment
            factorId={enrollment.factorId}
            qrCode={enrollment.qrCode}
            secret={enrollment.secret}
            verifyAction={verifyTwoFactorEnrollment}
          />
        </ModalShell>
      ) : null}

      {/* One-time backup codes, generated on the server render. */}
      {backupCodes && backupCodesContext ? (
        <ModalShell>
          {backupCodesContext === "enroll" ? (
            <BackupCodesDisplay
              codes={backupCodes}
              onConfirm={handleBackupCodesDone}
              confirmLabel="Done"
            />
          ) : (
            <BackupCodesDisplay
              codes={backupCodes}
              onConfirm={handleBackupCodesDone}
              title="Your new backup codes"
              subtitle="These replace your previous codes. The old ones no longer work. Each new code can be used once."
              confirmLabel="Done"
            />
          )}
        </ModalShell>
      ) : null}

      <ConfirmModal
        open={confirmDisableOpen}
        variant="danger"
        title="Turn off two-factor authentication?"
        description="Your account will be protected by your password only. You can turn two-factor back on at any time."
        confirmLabel="Turn off"
        cancelLabel="Keep it on"
        onConfirm={handleConfirmDisable}
        onCancel={() => setConfirmDisableOpen(false)}
      />
    </section>
  );
}

function ModalShell({
  children,
  dismissible = false,
  onDismiss,
}: {
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
    >
      <div
        onClick={dismissible ? onDismiss : undefined}
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(15, 10, 5, 0.35)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      />
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl"
        style={{
          backgroundColor: "var(--color-white, #ffffff)",
          border: "1px solid rgba(0, 0, 0, 0.06)",
          boxShadow:
            "0 24px 80px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.06)",
        }}
      >
        {dismissible ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cancel two-factor setup"
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--color-text-secondary, #6b7280)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--color-warm-gray-50, #f8f7f6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <X size={18} weight="bold" />
          </button>
        ) : null}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{
        backgroundColor: enabled
          ? "#E7F7EE"
          : "var(--color-warm-gray-100, #f0eeec)",
        color: enabled ? "#12824A" : "var(--color-text-secondary, #6b7280)",
      }}
    >
      {enabled ? "Enabled" : "Not set up"}
    </span>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LockKey, DeviceMobile, DesktopTower, SignOut } from "@phosphor-icons/react";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { resetMemberTwoFactor } from "./two-factor-admin-actions";
import s from "./PersonalInfoSection.module.css";
import x from "./SettingsShared.module.css";

export type SessionRow = {
  id: string;
  loggedInAt: string;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  city: string | null;
  country: string | null;
};

type Props = {
  email: string;
  /** Auth user id of the member being viewed. Needed for the admin reset. */
  memberUserId: string;
  /** Workspace id, used to revalidate after a reset. */
  workspaceId: string;
  twoFactorEnabled: boolean;
  lastPasswordChangeAt: string | null;
  sessions: SessionRow[];
};

export function AccountSecuritySection({
  email,
  memberUserId,
  workspaceId,
  twoFactorEnabled,
  lastPasswordChangeAt,
  sessions,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleConfirmReset = () => {
    setConfirmResetOpen(false);
    setResetError(null);
    startTransition(async () => {
      const result = await resetMemberTwoFactor(memberUserId, workspaceId);
      if (!result.ok) {
        setResetError(result.error ?? "Could not reset two-factor.");
        return;
      }
      setResetDone(true);
      router.refresh();
    });
  };

  return (
    <div>
      <header className={s.sectionHeader}>
        <h2 className={s.sectionTitle}>Account &amp; security</h2>
        <p className={s.sectionSubtitle}>
          Sign-in details, multi-factor, and active sessions for this owner.
        </p>
      </header>

      {/* Email + password */}
      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Sign-in</span>
        </div>
        <div className={s.cardBody}>
          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>Email address</label>
              <span className={s.labelHint}>Used for login + all mail.</span>
            </div>
            <div className={s.fieldCell}>
              <div className={s.emailWrap}>
                <input className={s.input} type="email" value={email} readOnly />
                <button type="button" className={s.btnSecondary}>
                  Change email
                </button>
              </div>
              <p className={s.fieldHint}>
                Triggers a verification flow sent to the new address.
              </p>
            </div>
          </div>
          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>Password</label>
              <span className={s.labelHint}>
                {lastPasswordChangeAt
                  ? `Last changed ${formatDate(lastPasswordChangeAt)}`
                  : "Never changed since signup."}
              </span>
            </div>
            <div className={s.fieldCell}>
              <button type="button" className={s.btnSecondary}>
                <LockKey size={14} weight="duotone" /> Send reset link
              </button>
              <p className={s.fieldHint}>
                Owner gets a one-time magic link to set a new password.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Two-factor */}
      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Two-factor authentication</span>
        </div>
        <div className={s.cardBody}>
          <div className={s.row}>
            <div className={s.labelCell}>
              <label className={s.label}>Authenticator app</label>
              <span className={s.labelHint}>TOTP via Google / 1Password / Authy.</span>
            </div>
            <div className={s.fieldCell} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              {twoFactorEnabled ? (
                <>
                  <span className={`${x.pill} ${x.pillGreen}`}>Enabled</span>
                  <button
                    type="button"
                    className={s.btnSecondary}
                    onClick={() => setConfirmResetOpen(true)}
                    disabled={isPending}
                  >
                    {isPending ? "Resetting..." : "Reset 2FA"}
                  </button>
                </>
              ) : (
                <>
                  <span className={`${x.pill} ${x.pillSlate}`}>Not set up</span>
                  <p className={s.fieldHint} style={{ margin: 0, textAlign: "right", maxWidth: 280 }}>
                    {resetDone
                      ? "Two-factor was reset. The member can set it up again from their own account security settings."
                      : "This member can turn on two-factor authentication from their own account security settings."}
                  </p>
                </>
              )}
            </div>
          </div>
          {resetError ? (
            <div className={s.row}>
              <p className={x.errorMsg}>{resetError}</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Active sessions */}
      <section className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardHeaderTitle}>Active sessions</span>
        </div>
        <p className={s.cardHeaderSub}>
          Recent sign-ins tied to this owner&rsquo;s account.
        </p>
        <ul className={x.list}>
          {sessions.length === 0 ? (
            <li className={x.listItem}>
              <div className={x.listItemMain}>
                <div className={x.listItemTitle}>No sessions on record yet.</div>
                <div className={x.listItemSub}>
                  Appears here after the owner signs in for the first time.
                </div>
              </div>
            </li>
          ) : (
            sessions.map((sess, i) => {
              const Icon =
                sess.deviceType === "mobile" ? DeviceMobile : DesktopTower;
              return (
                <li key={sess.id} className={x.listItem}>
                  <div className={x.listItemIcon}>
                    <Icon size={16} weight="duotone" />
                  </div>
                  <div className={x.listItemMain}>
                    <div className={x.listItemTitle}>
                      {sess.browser ?? "Browser"}
                      {sess.os ? ` · ${sess.os}` : ""}
                      {i === 0 ? (
                        <span
                          className={`${x.pill} ${x.pillGreen}`}
                          style={{ marginLeft: 8 }}
                        >
                          Current
                        </span>
                      ) : null}
                    </div>
                    <div className={x.listItemSub}>
                      <span>{formatDate(sess.loggedInAt)}</span>
                      {(sess.city || sess.country) && (
                        <>
                          <span aria-hidden>·</span>
                          <span>
                            {[sess.city, sess.country].filter(Boolean).join(", ")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className={x.listItemAction}>
                    <button type="button" className={s.btnGhost}>
                      Sign out
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
        <div className={s.cardFooter}>
          <p className={s.cardFooterHint}>
            Signing out remote sessions forces the owner to sign back in on those devices.
          </p>
          <button type="button" className={s.btnSecondary}>
            <SignOut size={14} weight="duotone" /> Sign out of all other sessions
          </button>
        </div>
      </section>

      <ConfirmModal
        open={confirmResetOpen}
        variant="danger"
        title="Reset this member's two-factor?"
        description="This removes their authenticator and backup codes. They will sign in with their password only until they set two-factor up again. Use this when a member has lost access to their authenticator."
        confirmLabel="Reset 2FA"
        cancelLabel="Cancel"
        onConfirm={handleConfirmReset}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

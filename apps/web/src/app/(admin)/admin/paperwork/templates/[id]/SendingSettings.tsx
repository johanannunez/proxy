"use client";

/**
 * SendingSettings — the "Sending" card on a signature template's Settings tab.
 * Controls the recipient-facing send experience: email copy (with
 * personalization tokens + live preview), auto-reminders, link expiration, and
 * after-sign behavior. Each section saves through updateTemplateSettings:
 * text fields commit on blur, toggles and number commits fire immediately.
 * Saves are optimistic against local state, which survives router.refresh()
 * because the refreshed props are identical.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "@phosphor-icons/react";
import type { TemplateSettings } from "@/lib/admin/document-templates-types";
import {
  AVAILABLE_TOKENS,
  resolveTokens,
  type TokenContext,
} from "@/lib/documents/tokens";
import { updateTemplateSettings } from "../template-actions";
import styles from "./SendingSettings.module.css";

// Sensible defaults applied the first time a toggle is enabled (no prior value).
const DEFAULT_REMINDERS = { everyDays: 3, maxCount: 3 };
const DEFAULT_EXPIRES_DAYS = 7;

// Sample context so the admin sees realistic, non-empty preview copy.
const PREVIEW_CTX: TokenContext = {
  firstName: "Alex",
  ownerName: "Alex Rivera",
  property: "12 Bay St",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SavePatch = Partial<TemplateSettings>;

export function SendingSettings({
  templateId,
  settings,
}: {
  templateId: string;
  settings: TemplateSettings;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Local authoritative copy for inputs. Seeded from props; refresh re-renders
  // with identical props so this is not clobbered.
  const [subject, setSubject] = useState(settings.email?.subject ?? "");
  const [message, setMessage] = useState(settings.email?.message ?? "");
  const [redirectUrl, setRedirectUrl] = useState(
    settings.afterSign?.redirectUrl ?? "",
  );
  const [cc, setCc] = useState<string[]>(settings.afterSign?.cc ?? []);
  const [ccDraft, setCcDraft] = useState("");
  const [ccError, setCcError] = useState<string | null>(null);

  // Reminders + expiration are also local-authoritative so the inputs do not
  // snap back to the prop value during the save round-trip. router.refresh()
  // re-renders with identical props, so this state survives.
  const [remindersOn, setRemindersOn] = useState(settings.reminders != null);
  const [everyDays, setEveryDays] = useState(
    settings.reminders?.everyDays ?? DEFAULT_REMINDERS.everyDays,
  );
  const [maxCount, setMaxCount] = useState(
    settings.reminders?.maxCount ?? DEFAULT_REMINDERS.maxCount,
  );

  const [expiresOn, setExpiresOn] = useState(settings.expiresInDays != null);
  const [expiresInDays, setExpiresInDays] = useState(
    settings.expiresInDays ?? DEFAULT_EXPIRES_DAYS,
  );

  const subjectRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  // Which field a token chip insert targets, last focused.
  const lastFocused = useRef<"subject" | "message">("message");
  // Set briefly after a chip insert so the field's onBlur (which fires as focus
  // leaves for the chip) does not also save a stale, pre-insert value.
  const skipNextBlurSave = useRef(false);

  function save(patch: SavePatch) {
    setError(null);
    startTransition(async () => {
      const res = await updateTemplateSettings(templateId, patch);
      if (!res.ok) {
        setError(res.error ?? "That change did not save. Try again.");
        return;
      }
      router.refresh();
    });
  }

  function insertToken(token: string) {
    // The field loses focus to the chip button, firing its onBlur. Suppress
    // that one save so it cannot clobber the insert with a stale value.
    skipNextBlurSave.current = true;
    if (lastFocused.current === "subject") {
      const el = subjectRef.current;
      const start = el?.selectionStart ?? subject.length;
      const end = el?.selectionEnd ?? subject.length;
      const next = subject.slice(0, start) + token + subject.slice(end);
      setSubject(next);
      // Restore caret just after the inserted token.
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
      save({ email: { subject: next } });
    } else {
      const el = messageRef.current;
      const start = el?.selectionStart ?? message.length;
      const end = el?.selectionEnd ?? message.length;
      const next = message.slice(0, start) + token + message.slice(end);
      setMessage(next);
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
      save({ email: { message: next } });
    }
  }

  function addCc() {
    const value = ccDraft.trim().replace(/,$/, "").trim();
    if (!value) return;
    if (!EMAIL_RE.test(value)) {
      setCcError("Enter a valid email address.");
      return;
    }
    if (cc.some((e) => e.toLowerCase() === value.toLowerCase())) {
      setCcDraft("");
      setCcError(null);
      return;
    }
    const next = [...cc, value];
    setCc(next);
    setCcDraft("");
    setCcError(null);
    save({ afterSign: { cc: next } });
  }

  function removeCc(email: string) {
    const next = cc.filter((e) => e !== email);
    setCc(next);
    save({ afterSign: { cc: next } });
  }

  const previewSubject = resolveTokens(subject, PREVIEW_CTX);
  const previewMessage = resolveTokens(message, PREVIEW_CTX);

  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Sending</h3>

      {/* ─── Email copy ─── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionLabel}>Email to the recipient</span>
          <span className={styles.sectionDesc}>
            What signers see when the document arrives. Click a token to insert
            it where your cursor sits.
          </span>
        </div>

        <div className={styles.tokenRow}>
          {AVAILABLE_TOKENS.map((t) => (
            <button
              key={t.token}
              type="button"
              className={styles.tokenChip}
              onClick={() => insertToken(t.token)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className={styles.fieldBlock}>
          <span className={styles.fieldLabel}>Subject</span>
          <input
            ref={subjectRef}
            type="text"
            className={styles.input}
            value={subject}
            placeholder="Your document from Proxy is ready to sign"
            onFocus={() => (lastFocused.current = "subject")}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={() => {
              if (skipNextBlurSave.current) {
                skipNextBlurSave.current = false;
                return;
              }
              save({ email: { subject } });
            }}
          />
        </label>

        <label className={styles.fieldBlock}>
          <span className={styles.fieldLabel}>Message</span>
          <textarea
            ref={messageRef}
            className={`${styles.input} ${styles.textarea}`}
            value={message}
            placeholder="Hi {{first_name}}, please review and sign the attached document for {{property}}."
            onFocus={() => (lastFocused.current = "message")}
            onChange={(e) => setMessage(e.target.value)}
            onBlur={() => {
              if (skipNextBlurSave.current) {
                skipNextBlurSave.current = false;
                return;
              }
              save({ email: { message } });
            }}
          />
        </label>

        <div className={styles.preview}>
          <span className={styles.previewLabel}>Preview (sample data)</span>
          <div className={styles.previewBody}>
            <span className={styles.previewSubject}>
              {previewSubject || "No subject yet"}
            </span>
            <p className={styles.previewMessage}>
              {previewMessage || "No message yet"}
            </p>
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      {/* ─── Auto-reminders ─── */}
      <section className={styles.section}>
        <div className={styles.toggleRow}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionLabel}>Send automatic reminders</span>
            <span className={styles.sectionDesc}>
              {remindersOn
                ? "Nudge unsigned recipients on a schedule."
                : "Using the workspace default."}
            </span>
          </div>
          <Toggle
            on={remindersOn}
            ariaLabel="Send automatic reminders"
            onChange={(next) => {
              setRemindersOn(next);
              if (next) {
                setEveryDays(DEFAULT_REMINDERS.everyDays);
                setMaxCount(DEFAULT_REMINDERS.maxCount);
              }
              save({ reminders: next ? DEFAULT_REMINDERS : null });
            }}
          />
        </div>

        {remindersOn && (
          <div className={styles.inlineFields}>
            <label className={styles.numberField}>
              <span className={styles.fieldLabel}>Every</span>
              <div className={styles.numberWrap}>
                <input
                  type="number"
                  min={1}
                  className={styles.numberInput}
                  value={everyDays}
                  onChange={(e) => setEveryDays(Number(e.target.value))}
                  onBlur={() => {
                    const v = Math.max(1, Math.round(everyDays) || 1);
                    setEveryDays(v);
                    save({ reminders: { everyDays: v, maxCount } });
                  }}
                />
                <span className={styles.numberSuffix}>days</span>
              </div>
            </label>
            <label className={styles.numberField}>
              <span className={styles.fieldLabel}>Up to</span>
              <div className={styles.numberWrap}>
                <input
                  type="number"
                  min={1}
                  className={styles.numberInput}
                  value={maxCount}
                  onChange={(e) => setMaxCount(Number(e.target.value))}
                  onBlur={() => {
                    const v = Math.max(1, Math.round(maxCount) || 1);
                    setMaxCount(v);
                    save({ reminders: { everyDays, maxCount: v } });
                  }}
                />
                <span className={styles.numberSuffix}>times</span>
              </div>
            </label>
          </div>
        )}
      </section>

      <div className={styles.divider} />

      {/* ─── Expiration ─── */}
      <section className={styles.section}>
        <div className={styles.toggleRow}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionLabel}>Link expires</span>
            <span className={styles.sectionDesc}>
              {expiresOn
                ? "The signing link stops working after the window."
                : "Never expires."}
            </span>
          </div>
          <Toggle
            on={expiresOn}
            ariaLabel="Link expires"
            onChange={(next) => {
              setExpiresOn(next);
              if (next) setExpiresInDays(DEFAULT_EXPIRES_DAYS);
              save({ expiresInDays: next ? DEFAULT_EXPIRES_DAYS : null });
            }}
          />
        </div>

        {expiresOn && (
          <div className={styles.inlineFields}>
            <label className={styles.numberField}>
              <span className={styles.fieldLabel}>Expires after</span>
              <div className={styles.numberWrap}>
                <input
                  type="number"
                  min={1}
                  className={styles.numberInput}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  onBlur={() => {
                    const v = Math.max(1, Math.round(expiresInDays) || 1);
                    setExpiresInDays(v);
                    save({ expiresInDays: v });
                  }}
                />
                <span className={styles.numberSuffix}>days</span>
              </div>
            </label>
          </div>
        )}
      </section>

      <div className={styles.divider} />

      {/* ─── After signing ─── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionLabel}>After signing</span>
          <span className={styles.sectionDesc}>
            Where signers land once they finish, and who gets a copy.
          </span>
        </div>

        <label className={styles.fieldBlock}>
          <span className={styles.fieldLabel}>Redirect URL</span>
          <input
            type="url"
            className={styles.input}
            value={redirectUrl}
            placeholder="https://www.myproxyhost.com/thank-you"
            onChange={(e) => setRedirectUrl(e.target.value)}
            onBlur={() =>
              save({ afterSign: { redirectUrl: redirectUrl.trim() } })
            }
          />
        </label>

        <div className={styles.fieldBlock}>
          <span className={styles.fieldLabel}>CC a copy to</span>
          <div className={styles.ccBox}>
            {cc.map((email) => (
              <span key={email} className={styles.ccChip}>
                {email}
                <button
                  type="button"
                  className={styles.ccRemove}
                  onClick={() => removeCc(email)}
                  aria-label={`Remove ${email}`}
                >
                  <X size={11} weight="bold" />
                </button>
              </span>
            ))}
            <input
              type="email"
              className={styles.ccInput}
              value={ccDraft}
              placeholder={cc.length === 0 ? "name@example.com" : "Add another"}
              onChange={(e) => {
                setCcDraft(e.target.value);
                if (ccError) setCcError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addCc();
                }
              }}
              onBlur={addCc}
            />
          </div>
          {ccError && <span className={styles.errorNote}>{ccError}</span>}
        </div>
      </section>

      {error && <p className={styles.errorNote}>{error}</p>}
    </div>
  );
}

function Toggle({
  on,
  ariaLabel,
  onChange,
}: {
  on: boolean;
  ariaLabel: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      className={`${styles.toggle} ${on ? styles.toggleOn : ""}`}
      onClick={() => onChange(!on)}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}

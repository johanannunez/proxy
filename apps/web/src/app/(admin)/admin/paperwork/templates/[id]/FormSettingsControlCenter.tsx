"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowSquareOut, Check, Globe, LinkSimple, Lock } from "@phosphor-icons/react";
import type { FormResponseWithProfile } from "@/lib/admin/forms";
import { LAYOUT_FIELD_TYPES, type Form, type FormFieldType } from "@/lib/admin/forms-types";
import { BrandStudio } from "../../forms/BrandStudio";
import {
  publishFormAction,
  toggleFormPublicAction,
  unpublishFormAction,
  updateFormMetaAction,
} from "../form-actions";
import { CoverageSettingsCard } from "./CoverageSettingsCard";
import { resolveFormAppearance } from "../../forms/form-icon";
import styles from "./FormSettingsControlCenter.module.css";

export function FormSettingsControlCenter({
  form,
  responses,
}: {
  form: Form;
  responses: FormResponseWithProfile[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("https://www.myproxyhost.com");
  const responseCount = responses.length;

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const appearance = resolveFormAppearance(form);
  const publicUrl = form.slug ? `${origin}/f/${form.slug}` : null;
  const submitText = form.schema.settings.submitButtonText?.trim() || "Submit";
  const estimatedTimeLabel = getEstimatedTimeLabel(form.schema.fields);
  const averageTimeLabel = getAverageTimeLabel(responses);
  const previewDescription =
    form.description || "The first thing respondents see before the fields.";

  function run(action: () => Promise<{ ok: boolean; error?: string } | void>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res && "ok" in res && !res.ok) {
        setError(res.error ?? "That change did not save. Try again.");
        return;
      }
      router.refresh();
    });
  }

  function handleCopy() {
    if (!publicUrl) return;
    navigator.clipboard
      .writeText(publicUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setError("Unable to copy the link. Select the URL manually."));
  }

  return (
    <div className={styles.root}>
      <section className={styles.summary} aria-label="Form setup summary">
        <div className={styles.identity}>
          <span
            className={styles.identityIcon}
            style={{ background: appearance.bg, color: appearance.fg }}
          >
            {appearance.kind === "emoji" && appearance.emoji ? (
              <span className={styles.identityEmoji}>{appearance.emoji}</span>
            ) : (
              <appearance.Icon size={22} weight="duotone" />
            )}
          </span>
          <div className={styles.identityText}>
            <h3>{form.name}</h3>
            <p>{form.schema.fields.length} fields configured</p>
          </div>
        </div>

        <SummaryAtom
          label="Status"
          value={form.is_active ? "Published" : "Draft"}
          tone={form.is_active ? "good" : "neutral"}
        />
        <SummaryAtom
          label="Access"
          value={form.is_public ? "Public" : "Private"}
          tone={form.is_public ? "good" : "neutral"}
        />
        <SummaryAtom
          label="Responses"
          value={`${responseCount}`}
          tone={responseCount > 0 ? "good" : "neutral"}
        />
        <SummaryAtom
          label="Status board"
          value={form.tracked ? "Shown" : "Hidden"}
          tone={form.tracked ? "good" : "neutral"}
        />
        <SummaryAtom
          label="Share"
          value={publicUrl ? "Ready" : "Unavailable"}
          tone={publicUrl ? "good" : "neutral"}
        />
      </section>

      <div className={styles.grid}>
        <div className={styles.leftCol}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h3>Access and publishing</h3>
              <p>Control whether the form accepts responses and who can open it.</p>
            </div>

            <div className={styles.row}>
              <div className={styles.rowMeta}>
                <span className={styles.rowLabel}>
                  Status{" "}
                  <span
                    className={`${styles.pill} ${
                      form.is_active ? styles.pillLive : styles.pillDraft
                    }`}
                  >
                    {form.is_active ? "Live" : "Draft"}
                  </span>
                </span>
                <span className={styles.rowDesc}>
                  {form.is_active
                    ? "The form is collecting responses."
                    : "Publishing creates the share link and starts collecting responses."}
                </span>
              </div>
              <button
                type="button"
                className={`${styles.actionBtn} ${form.is_active ? "" : styles.primaryBtn}`}
                disabled={pending}
                onClick={() =>
                  run(() =>
                    form.is_active ? unpublishFormAction(form.id) : publishFormAction(form.id),
                  )
                }
              >
                {pending ? "Saving..." : form.is_active ? "Unpublish" : "Publish"}
              </button>
            </div>

            <div className={styles.row}>
              <div className={styles.rowMeta}>
                <span className={styles.rowLabel}>
                  {form.is_public ? (
                    <>
                      <Globe size={13} weight="bold" /> Public access
                    </>
                  ) : (
                    <>
                      <Lock size={13} weight="bold" /> Private
                    </>
                  )}
                </span>
                <span className={styles.rowDesc}>
                  {form.is_public
                    ? "Anyone with the link can open this form."
                    : "Respondents must sign in before filling this out."}
                </span>
              </div>
              <button
                type="button"
                className={styles.actionBtn}
                disabled={pending}
                onClick={() => run(() => toggleFormPublicAction(form.id, !form.is_public))}
              >
                {form.is_public ? "Make private" : "Make public"}
              </button>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h3>Share link</h3>
              <p>Use the live link when the form is ready for respondents.</p>
            </div>
            {form.is_active && publicUrl ? (
              <div className={styles.linkRow}>
                <span className={styles.linkText}>{publicUrl}</span>
                <button
                  type="button"
                  className={`${styles.linkActionBtn} ${copied ? styles.linkCopied : ""}`}
                  onClick={handleCopy}
                >
                  {copied ? <Check size={12} weight="bold" /> : <LinkSimple size={12} weight="bold" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.linkActionBtn}
                >
                  <ArrowSquareOut size={12} weight="bold" />
                  Open
                </a>
              </div>
            ) : (
              <p className={styles.emptyLink}>Publish the form to create its share link.</p>
            )}
          </section>

          <CoverageSettingsCard
            tracked={form.tracked}
            category={form.category}
            displayName={form.name}
            onSave={(updates) => updateFormMetaAction(form.id, updates)}
          />

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h3>About this form</h3>
              <p>Reference details for this form master.</p>
            </div>
            <dl className={styles.details}>
              <div>
                <dt>Name</dt>
                <dd>{form.name}</dd>
              </div>
              <div>
                <dt>Fields</dt>
                <dd>{form.schema.fields.length}</dd>
              </div>
              <div>
                <dt>Estimated time</dt>
                <dd>{estimatedTimeLabel}</dd>
              </div>
              <div>
                <dt>Average time</dt>
                <dd>{averageTimeLabel}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>
                  {new Date(form.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </dd>
              </div>
            </dl>
          </section>

          {error && <p className={styles.errorNote}>{error}</p>}
        </div>

        <div className={styles.rightCol}>
          <BrandStudio form={form} />

          <section className={styles.previewPanel}>
            <div className={styles.previewHead}>
              <span>Respondent preview</span>
              <span className={styles.previewBadge}>{form.is_active ? "Live" : "Draft"}</span>
            </div>
            <div className={styles.previewCard}>
              <div
                className={styles.previewIcon}
                style={{ background: appearance.bg, color: appearance.fg }}
              >
                {appearance.kind === "emoji" && appearance.emoji ? (
                  <span className={styles.previewEmoji}>{appearance.emoji}</span>
                ) : (
                  <appearance.Icon size={22} weight="duotone" />
                )}
              </div>
              <h4>{form.name}</h4>
              <p>{previewDescription}</p>
              <button type="button" disabled>
                {submitText}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const FIELD_COMPLETION_SECONDS: Record<FormFieldType, number> = {
  short_text: 20,
  long_text: 45,
  number: 18,
  email: 18,
  phone: 18,
  date: 18,
  single_choice: 18,
  multiple_choice: 28,
  dropdown: 18,
  file_upload: 55,
  rating: 16,
  signature: 55,
  section_header: 5,
  description: 8,
  divider: 2,
};

function getEstimatedTimeLabel(fields: Form["schema"]["fields"]) {
  const seconds = fields.reduce((sum, field) => {
    const requiredSeconds =
      field.required && !LAYOUT_FIELD_TYPES.includes(field.type) ? 6 : 0;
    return sum + FIELD_COMPLETION_SECONDS[field.type] + requiredSeconds;
  }, 0);

  return formatMinutesLabel(Math.max(60, seconds), true);
}

function getAverageTimeLabel(responses: FormResponseWithProfile[]) {
  const durations = responses
    .map((response) => getResponseDurationSeconds(response))
    .filter((seconds): seconds is number => seconds !== null);

  if (durations.length === 0) {
    return responses.length > 0 ? "Compiling data" : "Not enough data";
  }

  const average =
    durations.reduce((sum, seconds) => sum + seconds, 0) / durations.length;
  return formatMinutesLabel(average, false);
}

function getResponseDurationSeconds(response: FormResponseWithProfile) {
  const timestampDuration = getTimestampDurationSeconds(
    response.started_at,
    response.completed_at,
  );
  if (timestampDuration !== null) return timestampDuration;

  const metadataSeconds = readMetadataNumber(response.metadata, [
    "durationSeconds",
    "duration_seconds",
    "completionSeconds",
    "completion_seconds",
    "timeToCompleteSeconds",
  ]);
  if (metadataSeconds !== null) return metadataSeconds;

  const metadataMs = readMetadataNumber(response.metadata, [
    "durationMs",
    "duration_ms",
    "completionMs",
    "completion_ms",
    "timeToCompleteMs",
  ]);
  return metadataMs !== null ? metadataMs / 1000 : null;
}

function getTimestampDurationSeconds(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const delta = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
  if (!Number.isFinite(delta) || delta <= 0 || delta > 60 * 60 * 12) return null;
  return delta;
}

function readMetadataNumber(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
}

function formatMinutesLabel(seconds: number, estimated: boolean) {
  if (seconds < 60) return estimated ? "~1 min" : "<1 min";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${estimated ? "~" : ""}${minutes} min`;
}

function SummaryAtom({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "good" | "neutral";
  value: string;
}) {
  return (
    <div className={styles.atom}>
      <span className={`${styles.atomDot} ${tone === "good" ? styles.atomDotGood : ""}`} />
      <span className={styles.atomLabel}>{label}</span>
      <span className={styles.atomValue}>{value}</span>
    </div>
  );
}

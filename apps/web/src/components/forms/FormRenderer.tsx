"use client";

import { useState, useRef, useEffect, useMemo, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SpinnerGap, ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import type { Form, FormField } from "@/lib/admin/forms-types";
import {
  getVisibleFieldIds,
  stripHiddenValues,
} from "@/lib/admin/forms-conditions";
import styles from "./FormRenderer.module.css";
import { FieldRenderer } from "./FieldRenderer";

type Props = {
  form: Form;
  onSubmit?: (data: Record<string, unknown>) => Promise<void>;
  readOnly?: boolean;
  /**
   * Builder preview mode: fields stay interactive so conditional visibility
   * can be exercised live, but the form cannot be submitted.
   */
  preview?: boolean;
};

function validateField(field: FormField, value: unknown): string | null {
  if (
    field.type === "divider" ||
    field.type === "section_header" ||
    field.type === "description" ||
    field.type === "page_break"
  ) {
    return null;
  }
  if (field.required) {
    if (value === undefined || value === null || value === "") return "This field is required.";
    if (Array.isArray(value) && value.length === 0) return "This field is required.";
  }
  if (field.type === "email" && typeof value === "string" && value) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address.";
  }
  if (field.type === "phone" && typeof value === "string" && value) {
    if (value.replace(/\D/g, "").length < 7) return "Enter a valid phone number.";
  }
  return null;
}

export function FormRenderer({
  form,
  onSubmit,
  readOnly = false,
  preview = false,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Split fields into pages on page_break boundaries. page_break markers are
  // NOT included in any page. Empty pages from leading/trailing/consecutive
  // page_breaks are dropped.
  const pages = useMemo<FormField[][]>(() => {
    const result: FormField[][] = [];
    let current: FormField[] = [];
    for (const field of form.schema.fields) {
      if (field.type === "page_break") {
        if (current.length > 0) {
          result.push(current);
          current = [];
        }
      } else {
        current.push(field);
      }
    }
    if (current.length > 0) result.push(current);
    return result;
  }, [form.schema.fields]);

  // Conditional visibility, resolved against live values on every render.
  const visibleFieldIds = getVisibleFieldIds(form.schema.fields, values);

  // Clean up the redirect timer on unmount.
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  // Handle completion navigation after submit (only outside preview/readOnly).
  useEffect(() => {
    if (!submitted || preview || readOnly) return;

    const completion = form.schema.settings.completion;
    if (!completion || completion.type === "message") return;

    redirectTimerRef.current = setTimeout(() => {
      if (completion.type === "portal_home") {
        router.push("/workspace/home");
      } else if (completion.type === "custom" && completion.customUrl) {
        const url = completion.customUrl.trim();
        if (url.startsWith("/")) {
          router.push(url);
        } else {
          window.location.href = url;
        }
      }
    }, 1200);
  }, [submitted, preview, readOnly, form.schema.settings.completion, router]);

  // Clamp currentPage when the schema changes (e.g. preview with live edits
  // that delete a page_break, reducing page count).
  useEffect(() => {
    if (currentPage > Math.max(0, pages.length - 1)) {
      setCurrentPage(Math.max(0, pages.length - 1));
    }
  }, [pages.length, currentPage]);

  function setValue(id: string, value: unknown) {
    setValues((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => ({ ...prev, [id]: "" }));
  }

  // Validate only the fields on the given page that are currently visible and
  // required. Returns the error map (empty if all pass).
  function validatePage(pageFields: FormField[]): Record<string, string> {
    const newErrors: Record<string, string> = {};
    for (const field of pageFields) {
      if (!visibleFieldIds.has(field.id)) continue;
      const err = validateField(field, values[field.id]);
      if (err) newErrors[field.id] = err;
    }
    return newErrors;
  }

  // Advance to next page after per-page validation. In preview we skip
  // validation so the builder/AI preview can page through an unfilled form.
  function goNext() {
    if (!preview) {
      const pageFields = pages[currentPage] ?? [];
      const errs = validatePage(pageFields);
      if (Object.values(errs).some(Boolean)) {
        setErrors((prev) => ({ ...prev, ...errs }));
        return;
      }
    }
    setCurrentPage((p) => p + 1);
    // Scroll the form shell to top so the new page starts at the top.
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // If we are on a non-final page (e.g. user pressed Enter in an input),
    // treat Enter as Next rather than a full submit attempt.
    if (pages.length > 1 && currentPage < pages.length - 1) {
      goNext();
      return;
    }

    if (!onSubmit) return;

    // Final safety net: validate ALL visible fields across all pages.
    const newErrors: Record<string, string> = {};
    for (const field of form.schema.fields) {
      if (!visibleFieldIds.has(field.id)) continue;
      const err = validateField(field, values[field.id]);
      if (err) newErrors[field.id] = err;
    }
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) {
      // An errored field may live on an earlier page (e.g. a cross-page
      // condition made it required). Jump to the first page that has one so
      // the error is actually visible instead of silently blocking submit.
      if (pages.length > 1) {
        const erroredIds = new Set(
          Object.keys(newErrors).filter((id) => newErrors[id]),
        );
        const target = pages.findIndex((pg) => pg.some((f) => erroredIds.has(f.id)));
        if (target >= 0 && target !== currentPage) setCurrentPage(target);
      }
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(stripHiddenValues(form.schema.fields, values));
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  const successMsg =
    form.schema.settings.successMessage ?? "Thank you. Your response has been recorded.";

  if (submitted) {
    return (
      <div className={styles.successCard}>
        <div className={styles.successCheck}>✓</div>
        <p className={styles.successMsg}>{successMsg}</p>
      </div>
    );
  }

  // ── Single-page path: no page_break fields — render EXACTLY as before ─────
  if (pages.length <= 1) {
    return (
      <form ref={formRef} onSubmit={handleSubmit} className={styles.form} noValidate>
        {form.schema.fields.map((field) => (
          <div
            key={field.id}
            className={styles.fieldWrap}
            // Hidden, not unmounted, so values survive visibility flips.
            style={visibleFieldIds.has(field.id) ? undefined : { display: "none" }}
            data-field-id={field.id}
            data-hidden={visibleFieldIds.has(field.id) ? undefined : "true"}
          >
            <FieldRenderer
              field={field}
              value={values[field.id]}
              onChange={(val) => setValue(field.id, val)}
              error={errors[field.id]}
              readOnly={readOnly}
            />
          </div>
        ))}

        {!readOnly && !preview && (
          <div className={styles.submitRow}>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <SpinnerGap size={16} weight="bold" className={styles.spin} />
                  Submitting…
                </>
              ) : (
                (form.schema.settings.submitButtonText ?? "Submit")
              )}
            </button>
          </div>
        )}
      </form>
    );
  }

  // ── Multi-page path ────────────────────────────────────────────────────────
  const totalPages = pages.length;
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === totalPages - 1;
  const progressPct = ((currentPage + 1) / totalPages) * 100;
  const currentPageFields = pages[currentPage] ?? [];

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={styles.form} noValidate>
      {/* Step progress header */}
      <div className={styles.progressHeader}>
        <span className={styles.progressLabel}>
          Step {currentPage + 1} of {totalPages}
        </span>
        <div className={styles.progressTrack} role="progressbar" aria-valuenow={currentPage + 1} aria-valuemin={1} aria-valuemax={totalPages}>
          <div
            className={styles.progressFill}
            style={{ transform: `scaleX(${progressPct / 100})` }}
          />
        </div>
      </div>

      {/* Render ALL fields from ALL pages but only show current page's fields.
          Fields outside the current page are hidden, not unmounted, so their
          values survive page navigation (the values state object persists). */}
      {form.schema.fields
        .filter((f) => f.type !== "page_break")
        .map((field) => {
          const isOnCurrentPage = currentPageFields.some((pf) => pf.id === field.id);
          const isVisible = visibleFieldIds.has(field.id);
          const show = isOnCurrentPage && isVisible;
          return (
            <div
              key={field.id}
              className={styles.fieldWrap}
              style={show ? undefined : { display: "none" }}
              data-field-id={field.id}
              data-hidden={show ? undefined : "true"}
            >
              <FieldRenderer
                field={field}
                value={values[field.id]}
                onChange={(val) => setValue(field.id, val)}
                error={errors[field.id]}
                readOnly={readOnly}
              />
            </div>
          );
        })}

      {/* Footer navigation */}
      {!readOnly && (
        <div className={styles.pageNav}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => setCurrentPage((p) => p - 1)}
            style={isFirstPage ? { visibility: "hidden" } : undefined}
            disabled={isFirstPage}
            aria-label="Back"
          >
            <ArrowLeft size={15} weight="bold" />
            Back
          </button>

          {isLastPage ? (
            !preview && (
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <SpinnerGap size={16} weight="bold" className={styles.spin} />
                    Submitting…
                  </>
                ) : (
                  (form.schema.settings.submitButtonText ?? "Submit")
                )}
              </button>
            )
          ) : (
            <button
              type="button"
              className={styles.nextBtn}
              onClick={goNext}
              aria-label="Next"
            >
              Next
              <ArrowRight size={15} weight="bold" />
            </button>
          )}
        </div>
      )}
    </form>
  );
}

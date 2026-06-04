"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CaretDown, CaretUp } from "@phosphor-icons/react";
import type { Form, FormResponse } from "@/lib/admin/forms-types";
import { FIELD_TYPE_LABELS } from "@/lib/admin/forms-types";
import styles from "./FormResponsesHub.module.css";

type Props = {
  form: Form;
  responses: FormResponse[];
};

export function FormResponsesHub({ form, responses }: Props) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const inputFields = form.schema.fields.filter(
    (f) =>
      f.type !== "divider" && f.type !== "section_header" && f.type !== "description",
  );

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatValue(val: unknown): string {
    if (val === undefined || val === null || val === "") return "—";
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  }

  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => router.push("/admin/paperwork/forms")}
        >
          <ArrowLeft size={14} weight="bold" />
          Forms
        </button>
        <div className={styles.headerText}>
          <h1 className={styles.pageTitle}>{form.name}</h1>
          <p className={styles.pageSubtitle}>
            {responses.length === 0
              ? "No responses yet"
              : `${responses.length} response${responses.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {responses.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No responses yet</p>
          <p className={styles.emptyBody}>
            Once someone submits this form, their responses will appear here.
          </p>
        </div>
      ) : (
        <div className={styles.responseList}>
          {responses.map((response, index) => {
            const isExpanded = expandedId === response.id;
            return (
              <div key={response.id} className={styles.responseCard}>
                <button
                  type="button"
                  className={styles.responseHeader}
                  onClick={() => setExpandedId(isExpanded ? null : response.id)}
                >
                  <div className={styles.responseHeaderLeft}>
                    <span className={styles.responseIndex}>#{responses.length - index}</span>
                    <span className={styles.responseDate}>{formatDate(response.submitted_at)}</span>
                    <span className={styles.respondentLabel}>
                      {response.respondent_profile_id ? "Authenticated user" : "Anonymous"}
                    </span>
                  </div>
                  {isExpanded ? (
                    <CaretUp size={14} weight="bold" />
                  ) : (
                    <CaretDown size={14} weight="bold" />
                  )}
                </button>

                {isExpanded && (
                  <div className={styles.responseBody}>
                    {inputFields.length === 0 ? (
                      <p className={styles.noFieldsMsg}>No input fields in this form.</p>
                    ) : (
                      <dl className={styles.fieldList}>
                        {inputFields.map((field) => {
                          const val = response.data[field.id];
                          if (val === undefined) return null;
                          return (
                            <div key={field.id} className={styles.fieldRow}>
                              <dt className={styles.fieldLabel}>
                                {field.label}
                                <span className={styles.fieldTypeMeta}>
                                  {FIELD_TYPE_LABELS[field.type]}
                                </span>
                              </dt>
                              <dd className={styles.fieldValue}>{formatValue(val)}</dd>
                            </div>
                          );
                        })}
                      </dl>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

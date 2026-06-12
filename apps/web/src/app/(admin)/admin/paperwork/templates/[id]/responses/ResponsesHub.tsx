"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  CheckSquare,
  CaretDown,
  CaretUp,
  Star,
  MagnifyingGlass,
  ClockCountdown,
  ChartBar,
} from "@phosphor-icons/react";
import type { Form, FormField } from "@/lib/admin/forms-types";
import { FIELD_TYPE_LABELS, LAYOUT_FIELD_TYPES } from "@/lib/admin/forms-types";
import type { FormResponseWithProfile } from "@/lib/admin/forms";
import styles from "./ResponsesHub.module.css";

type TabKey = "questions" | "individual" | "summary";
type FilterKey = "all" | "complete" | "in_progress" | "incomplete";
type SortKey = "newest" | "oldest";

type Props = {
  form: Form;
  responses: FormResponseWithProfile[];
  viewCount: number;
};

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDuration(startStr: string | null, endStr: string | null): string {
  if (!startStr || !endStr) return "—";
  const secs = Math.round(
    (new Date(endStr).getTime() - new Date(startStr).getTime()) / 1000,
  );
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function formatValue(val: unknown): string {
  if (val === undefined || val === null || val === "") return "—";
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

function getResponseStatus(r: FormResponseWithProfile): "complete" | "in_progress" | "incomplete" {
  if (r.completed_at) return "complete";
  if (r.started_at) return "in_progress";
  return "incomplete";
}

export function ResponsesHub({ form, responses, viewCount }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("questions");

  const inputFields = form.schema.fields.filter(
    (f) => !LAYOUT_FIELD_TYPES.includes(f.type),
  );

  const completedResponses = responses.filter((r) => r.completed_at);
  const completionRate =
    responses.length > 0
      ? Math.round((completedResponses.length / responses.length) * 100)
      : 0;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => router.push("/admin/paperwork/templates")}
        >
          <ArrowLeft size={14} weight="bold" />
          Templates
        </button>

        <div className={styles.headerMain}>
          <h1 className={styles.formTitle}>{form.name}</h1>
          <div className={styles.statPills}>
            <span className={styles.statPill}>
              <Eye size={13} weight="duotone" />
              {viewCount} view{viewCount !== 1 ? "s" : ""}
            </span>
            <span className={styles.statPill}>
              <CheckSquare size={13} weight="duotone" />
              {responses.length} response{responses.length !== 1 ? "s" : ""}
            </span>
            <span className={styles.statPill}>
              <ChartBar size={13} weight="duotone" />
              {completionRate}% completion
            </span>
          </div>
        </div>
      </div>

      <div className={styles.tabs}>
        {(["questions", "individual", "summary"] as TabKey[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {tab === "questions" && (
          <QuestionsTab fields={inputFields} responses={responses} />
        )}
        {tab === "individual" && (
          <IndividualTab fields={inputFields} responses={responses} />
        )}
        {tab === "summary" && (
          <SummaryTab
            fields={inputFields}
            responses={responses}
            viewCount={viewCount}
            completionRate={completionRate}
          />
        )}
      </div>
    </div>
  );
}

function QuestionsTab({
  fields,
  responses,
}: {
  fields: FormField[];
  responses: FormResponseWithProfile[];
}) {
  if (fields.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>No input fields</p>
        <p className={styles.emptyBody}>This form has no fields that collect responses.</p>
      </div>
    );
  }

  return (
    <div className={styles.fieldCards}>
      {fields.map((field) => (
        <FieldResponseCard key={field.id} field={field} responses={responses} />
      ))}
    </div>
  );
}

function FieldResponseCard({
  field,
  responses,
}: {
  field: FormField;
  responses: FormResponseWithProfile[];
}) {
  const answered = responses.filter(
    (r) => r.data[field.id] !== undefined && r.data[field.id] !== null && r.data[field.id] !== "",
  );
  const values = answered.map((r) => r.data[field.id]);

  const isChoice =
    field.type === "single_choice" ||
    field.type === "multiple_choice" ||
    field.type === "dropdown";
  const isText =
    field.type === "short_text" ||
    field.type === "long_text" ||
    field.type === "email" ||
    field.type === "phone" ||
    field.type === "number" ||
    field.type === "date";
  const isRating = field.type === "rating";
  const isBlob = field.type === "signature" || field.type === "file_upload";

  return (
    <div className={styles.fieldCard}>
      <div className={styles.fieldCardHeader}>
        <div className={styles.fieldCardMeta}>
          <span className={styles.fieldCardLabel}>{field.label}</span>
          <span className={styles.typeBadge}>{FIELD_TYPE_LABELS[field.type]}</span>
        </div>
        <span className={styles.responseCount}>
          {answered.length} response{answered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {isChoice && field.options && field.options.length > 0 && (
        <ChoiceBreakdown options={field.options} values={values} fieldType={field.type} />
      )}

      {isText && <TextAnswerList values={values} />}

      {isRating && <RatingBreakdown values={values} max={field.ratingMax ?? 5} />}

      {isBlob && (
        <p className={styles.blobNote}>
          {answered.length} submission{answered.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

function ChoiceBreakdown({
  options,
  values,
  fieldType,
}: {
  options: string[];
  values: unknown[];
  fieldType: string;
}) {
  const counts: Record<string, number> = {};
  for (const opt of options) counts[opt] = 0;
  for (const val of values) {
    if (fieldType === "multiple_choice" && Array.isArray(val)) {
      for (const v of val as string[]) {
        if (counts[v] !== undefined) counts[v]++;
      }
    } else if (typeof val === "string" && counts[val] !== undefined) {
      counts[val]++;
    }
  }

  const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className={styles.choiceBreakdown}>
      {options.map((opt) => {
        const count = counts[opt] ?? 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        return (
          <div key={opt} className={styles.barRow}>
            <span className={styles.barLabel}>{opt}</span>
            <div className={styles.barTrack}>
              <div
                className={styles.bar}
                style={{ width: `${Math.max(pct, pct > 0 ? 1 : 0)}%` }}
              />
            </div>
            <span className={styles.barStat}>
              {count} <span className={styles.barPct}>({pct}%)</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TextAnswerList({ values }: { values: unknown[] }) {
  const [showAll, setShowAll] = useState(false);
  const strings = values
    .filter((v) => v !== null && v !== undefined && v !== "")
    .map((v) => (Array.isArray(v) ? v.join(", ") : String(v)));

  if (strings.length === 0) {
    return <p className={styles.noAnswers}>No answers yet.</p>;
  }

  const limit = 20;
  const shown = showAll ? strings : strings.slice(0, limit);

  return (
    <div className={styles.answerList}>
      {shown.map((s, i) => (
        <span key={i} className={styles.answerItem}>
          {s}
        </span>
      ))}
      {strings.length > limit && !showAll && (
        <button
          type="button"
          className={styles.showAllBtn}
          onClick={() => setShowAll(true)}
        >
          Show all {strings.length}
        </button>
      )}
    </div>
  );
}

function RatingBreakdown({ values, max }: { values: unknown[]; max: number }) {
  const nums = values
    .map((v) => Number(v))
    .filter((n) => !isNaN(n) && n > 0);
  const avg = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;

  return (
    <div className={styles.ratingBreakdown}>
      <span className={styles.ratingAvg}>{avg > 0 ? avg.toFixed(1) : "—"}</span>
      <span className={styles.ratingLabel}>avg</span>
      <div className={styles.stars}>
        {Array.from({ length: max }).map((_, i) => (
          <Star
            key={i}
            size={16}
            weight={i < Math.round(avg) ? "fill" : "regular"}
            className={i < Math.round(avg) ? styles.starFilled : styles.starEmpty}
          />
        ))}
      </div>
    </div>
  );
}

function IndividualTab({
  fields,
  responses,
}: {
  fields: FormField[];
  responses: FormResponseWithProfile[];
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = responses
    .filter((r) => {
      if (filter === "complete") return !!r.completed_at;
      if (filter === "in_progress") return !!r.started_at && !r.completed_at;
      if (filter === "incomplete") return !r.started_at;
      return true;
    })
    .filter((r) => {
      if (!search.trim()) return true;
      const name = (r.respondent_name ?? "").toLowerCase();
      return name.includes(search.toLowerCase());
    })
    .sort((a, b) => {
      const ta = new Date(a.submitted_at).getTime();
      const tb = new Date(b.submitted_at).getTime();
      return sort === "newest" ? tb - ta : ta - tb;
    });

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "complete", label: "Complete" },
    { key: "in_progress", label: "In progress" },
    { key: "incomplete", label: "Incomplete" },
  ];

  return (
    <div className={styles.individualTab}>
      <div className={styles.filterBar}>
        <div className={styles.filterChips}>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`${styles.filterChip} ${filter === f.key ? styles.filterChipActive : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className={styles.filterRight}>
          <select
            className={styles.sortSelect}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>

          <div className={styles.searchWrap}>
            <MagnifyingGlass size={13} weight="bold" className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No responses match</p>
          <p className={styles.emptyBody}>Adjust the filters or search term.</p>
        </div>
      ) : (
        <div className={styles.responseTable}>
          {filtered.map((r) => {
            const isExpanded = expandedId === r.id;
            const status = getResponseStatus(r);
            return (
              <div key={r.id} className={styles.responseRow}>
                <button
                  type="button"
                  className={styles.responseRowHeader}
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <div className={styles.responseRowLeft}>
                    <span className={styles.respondentName}>
                      {r.respondent_name ?? "Anonymous"}
                      {!r.respondent_name && (
                        <span className={styles.anonPill}>anon</span>
                      )}
                    </span>
                    <span className={styles.submittedAt}>
                      {formatRelative(r.submitted_at)}
                    </span>
                    <span className={styles.duration}>
                      <ClockCountdown size={11} weight="bold" />
                      {formatDuration(r.started_at, r.completed_at)}
                    </span>
                  </div>
                  <div className={styles.responseRowRight}>
                    <StatusPill status={status} />
                    {isExpanded ? (
                      <CaretUp size={13} weight="bold" />
                    ) : (
                      <CaretDown size={13} weight="bold" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className={styles.expandedContent}>
                    {fields.length === 0 ? (
                      <p className={styles.noAnswers}>No input fields in this form.</p>
                    ) : (
                      <dl className={styles.expandedFields}>
                        {fields.map((field) => {
                          const val = r.data[field.id];
                          return (
                            <div key={field.id} className={styles.expandedRow}>
                              <dt className={styles.expandedFieldLabel}>{field.label}</dt>
                              <dd className={styles.expandedFieldValue}>
                                {formatValue(val)}
                              </dd>
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

function StatusPill({ status }: { status: "complete" | "in_progress" | "incomplete" }) {
  if (status === "complete") {
    return <span className={`${styles.statusPill} ${styles.statusComplete}`}>Complete</span>;
  }
  if (status === "in_progress") {
    return <span className={`${styles.statusPill} ${styles.statusInProgress}`}>In progress</span>;
  }
  return <span className={`${styles.statusPill} ${styles.statusIncomplete}`}>No data</span>;
}

function SummaryTab({
  fields,
  responses,
  viewCount,
  completionRate,
}: {
  fields: FormField[];
  responses: FormResponseWithProfile[];
  viewCount: number;
  completionRate: number;
}) {
  const completedResponses = responses.filter((r) => r.completed_at && r.started_at);
  const avgSeconds =
    completedResponses.length > 0
      ? Math.round(
          completedResponses.reduce((sum, r) => {
            const delta =
              (new Date(r.completed_at!).getTime() - new Date(r.started_at!).getTime()) / 1000;
            return sum + delta;
          }, 0) / completedResponses.length,
        )
      : 0;

  const avgDurationLabel =
    avgSeconds > 0
      ? avgSeconds < 60
        ? `${avgSeconds}s`
        : `${Math.floor(avgSeconds / 60)}m ${avgSeconds % 60}s`
      : "—";

  const statCards = [
    { icon: <Eye size={20} weight="duotone" />, value: viewCount, label: "Total views" },
    {
      icon: <CheckSquare size={20} weight="duotone" />,
      value: responses.length,
      label: "Total responses",
    },
    {
      icon: <ChartBar size={20} weight="duotone" />,
      value: `${completionRate}%`,
      label: "Completion rate",
    },
    {
      icon: <ClockCountdown size={20} weight="duotone" />,
      value: avgDurationLabel,
      label: "Avg time to complete",
    },
  ];

  const last14 = buildTimeline(responses, 14);

  return (
    <div className={styles.summaryTab}>
      <div className={styles.summaryGrid}>
        {statCards.map((card) => (
          <div key={card.label} className={styles.statCard}>
            <div className={styles.statCardIcon}>{card.icon}</div>
            <span className={styles.statCardValue}>{card.value}</span>
            <span className={styles.statCardLabel}>{card.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.timelineSection}>
        <h2 className={styles.sectionHeading}>Response timeline</h2>
        <TimelineChart days={last14} />
      </div>

      {fields.length > 0 && (
        <div className={styles.fieldSummarySection}>
          <h2 className={styles.sectionHeading}>Per-field breakdown</h2>
          <div className={styles.fieldGrid}>
            {fields.map((field) => (
              <FieldResponseCard key={field.id} field={field} responses={responses} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type DayBucket = { label: string; count: number };

function buildTimeline(responses: FormResponseWithProfile[], days: number): DayBucket[] {
  const now = new Date();
  const buckets: DayBucket[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    buckets.push({ label, count: 0 });
    for (const r of responses) {
      if (r.submitted_at.slice(0, 10) === key) {
        buckets[buckets.length - 1].count++;
      }
    }
  }

  return buckets;
}

function TimelineChart({ days }: { days: DayBucket[] }) {
  const max = Math.max(...days.map((d) => d.count), 1);
  const maxBarHeight = 80;

  return (
    <div className={styles.timelineWrap}>
      {days.map((day, i) => {
        const heightPct = day.count / max;
        const barHeight = Math.max(heightPct * maxBarHeight, day.count > 0 ? 4 : 0);
        return (
          <div key={i} className={styles.dayBar}>
            <div className={styles.dayBarInner}>
              <div
                className={styles.dayBarFill}
                style={{ height: `${barHeight}px` }}
                title={`${day.count} response${day.count !== 1 ? "s" : ""}`}
              />
            </div>
            <span className={styles.dayLabel}>{day.label}</span>
          </div>
        );
      })}
    </div>
  );
}

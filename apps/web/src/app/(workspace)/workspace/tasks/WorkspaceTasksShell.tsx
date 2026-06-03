"use client";

import { useState, useTransition, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle,
  Phone,
  UsersThree,
  EnvelopeSimple,
  Flag,
  X,
  Warning,
  ArrowUp,
  Chat,
  ArrowRight,
  ListChecks,
} from "@phosphor-icons/react";
import { updateTaskStatus, toggleSubtask, addComment } from "./workspace-task-actions";
import type { WorkspaceTask, TaskSubtask, TaskComment, PropertyOption } from "./page";
import { PhaseProgressRing } from "./PhaseProgressRing";

// ─── Type helpers ────────────────────────────────────────────────────────────

type FilterTab = "all" | "open" | "done" | "overdue";

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_META: Record<
  string,
  { icon: React.ReactNode; color: string; bg: string; label: string }
> = {
  todo: {
    icon: <CheckCircle size={16} weight="duotone" />,
    color: "#0c6fae",
    bg: "rgba(2, 170, 235, 0.10)",
    label: "To-Do",
  },
  call: {
    icon: <Phone size={16} weight="duotone" />,
    color: "#059669",
    bg: "rgba(5, 150, 105, 0.10)",
    label: "Call",
  },
  meeting: {
    icon: <UsersThree size={16} weight="duotone" />,
    color: "#7c3aed",
    bg: "rgba(124, 58, 237, 0.10)",
    label: "Meeting",
  },
  email: {
    icon: <EnvelopeSimple size={16} weight="duotone" />,
    color: "#b45309",
    bg: "rgba(245, 158, 11, 0.10)",
    label: "Email",
  },
  milestone: {
    icon: <Flag size={16} weight="duotone" />,
    color: "#be123c",
    bg: "rgba(190, 18, 60, 0.09)",
    label: "Milestone",
  },
};

function getTypeMeta(type: string) {
  return (
    TYPE_META[type] ?? {
      icon: <CheckCircle size={16} weight="duotone" />,
      color: "#0c6fae",
      bg: "rgba(2, 170, 235, 0.10)",
      label: "Task",
    }
  );
}

function priorityBadge(priority: string | null): {
  bg: string;
  fg: string;
  label: string;
  showArrow: boolean;
} {
  if (priority === "urgent")
    return { bg: "rgba(220, 38, 38, 0.12)", fg: "#b91c1c", label: "Urgent", showArrow: true };
  if (priority === "high")
    return { bg: "rgba(220, 38, 38, 0.09)", fg: "#dc2626", label: "High", showArrow: true };
  if (priority === "medium")
    return { bg: "rgba(245, 158, 11, 0.12)", fg: "#b45309", label: "Medium", showArrow: false };
  return { bg: "rgba(2, 170, 235, 0.09)", fg: "#0c6fae", label: "Low", showArrow: false };
}

function statusStyle(status: string): { indicator: string; cardOpacity: number } {
  if (status === "done") return { indicator: "#16a34a", cardOpacity: 0.65 };
  if (status === "blocked") return { indicator: "#dc2626", cardOpacity: 1 };
  if (status === "in_progress") return { indicator: "#d97706", cardOpacity: 1 };
  if (status === "cancelled") return { indicator: "#9ca3af", cardOpacity: 0.55 };
  return { indicator: "#02AAEB", cardOpacity: 1 };
}

function isOverdue(task: WorkspaceTask): boolean {
  if (!task.due_date) return false;
  if (task.status === "done" || task.status === "cancelled") return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

function formatDue(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCommentTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TypeIcon({ type }: { type: string }) {
  const meta = getTypeMeta(type);
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
      style={{ backgroundColor: meta.bg, color: meta.color }}
    >
      {meta.icon}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const b = priorityBadge(priority);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: b.bg, color: b.fg }}
    >
      {b.showArrow && <ArrowUp size={9} weight="bold" />}
      {b.label}
    </span>
  );
}

function SubtasksBar({
  subtasks,
}: {
  subtasks: TaskSubtask[];
}) {
  if (subtasks.length === 0) return null;
  const done = subtasks.filter((s) => s.completed).length;
  const total = subtasks.length;
  const pct = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1 flex-1 overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--color-warm-gray-200)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            backgroundColor: pct === 100 ? "#16a34a" : "var(--color-brand)",
          }}
        />
      </div>
      <span
        className="shrink-0 text-[11px] tabular-nums"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {done}/{total}
      </span>
    </div>
  );
}

function StatusPill({
  status,
  taskId,
  disabled,
  onToggle,
}: {
  status: string;
  taskId: string;
  disabled: boolean;
  onToggle: (taskId: string, newStatus: "done" | "todo") => void;
}) {
  const isDone = status === "done";

  if (status === "blocked" || status === "cancelled" || status === "in_progress") {
    const labels: Record<string, string> = {
      blocked: "Blocked",
      cancelled: "Cancelled",
      in_progress: "In Progress",
    };
    const colors: Record<string, { bg: string; fg: string }> = {
      blocked: { bg: "rgba(220,38,38,0.10)", fg: "#dc2626" },
      cancelled: { bg: "rgba(156,163,175,0.15)", fg: "#6b7280" },
      in_progress: { bg: "rgba(217,119,6,0.12)", fg: "#d97706" },
    };
    const c = colors[status] ?? colors.in_progress;
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
        style={{ backgroundColor: c.bg, color: c.fg }}
      >
        {labels[status]}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(taskId, isDone ? "todo" : "done");
      }}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all"
      style={{
        backgroundColor: isDone ? "rgba(22, 163, 74, 0.10)" : "rgba(2, 170, 235, 0.09)",
        color: isDone ? "#16a34a" : "#0c6fae",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
      aria-label={isDone ? "Mark as open" : "Mark as done"}
    >
      <CheckCircle
        size={12}
        weight={isDone ? "fill" : "regular"}
        style={{ flexShrink: 0 }}
      />
      {isDone ? "Done" : "Mark done"}
    </button>
  );
}

function TaskCard({
  task,
  propertyLabel,
  onOpen,
  onToggleStatus,
  pendingIds,
}: {
  task: WorkspaceTask;
  propertyLabel: string | null;
  onOpen: () => void;
  onToggleStatus: (taskId: string, newStatus: "done" | "todo") => void;
  pendingIds: Set<string>;
}) {
  const overdue = isOverdue(task);
  const { indicator, cardOpacity } = statusStyle(task.status);
  const meta = getTypeMeta(task.task_type);
  const isPending = pendingIds.has(task.id);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: cardOpacity, y: 0 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      onClick={onOpen}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border p-5 transition-shadow"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.07)";
        e.currentTarget.style.borderColor = "rgba(2,170,235,0.30)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
        e.currentTarget.style.borderColor = "var(--color-warm-gray-200)";
      }}
    >
      {/* Status indicator strip */}
      <div
        className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
        style={{ backgroundColor: indicator }}
      />

      <div className="pl-4">
        {/* Top row: icon + title + status pill */}
        <div className="flex items-start gap-3">
          <TypeIcon type={task.task_type} />
          <div className="min-w-0 flex-1">
            <div
              className="text-[14px] font-semibold leading-snug"
              style={{
                color: "var(--color-text-primary)",
                textDecoration: task.status === "done" ? "line-through" : "none",
                opacity: task.status === "done" ? 0.7 : 1,
              }}
            >
              {task.title}
            </div>
            {task.description && (
              <div
                className="mt-1 line-clamp-2 text-[13px] leading-relaxed"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {task.description}
              </div>
            )}
          </div>
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <StatusPill
              status={task.status}
              taskId={task.id}
              disabled={isPending}
              onToggle={onToggleStatus}
            />
          </div>
        </div>

        {/* Subtasks progress bar */}
        {task.task_subtasks.length > 0 && (
          <div className="mt-3">
            <SubtasksBar subtasks={task.task_subtasks} />
          </div>
        )}

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Type label */}
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: meta.bg, color: meta.color }}
          >
            {meta.label}
          </span>

          {/* Priority */}
          <PriorityBadge priority={task.priority} />

          {/* Property */}
          {propertyLabel && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: "rgba(2,170,235,0.07)",
                color: "var(--color-brand)",
              }}
            >
              {propertyLabel}
            </span>
          )}

          {/* Due date */}
          {task.due_date && (
            <span
              className="ml-auto flex items-center gap-1 text-[11px] font-medium"
              style={{ color: overdue ? "#dc2626" : "var(--color-text-tertiary)" }}
            >
              {overdue && <Warning size={11} weight="fill" />}
              Due {formatDue(task.due_date)}
            </span>
          )}
        </div>
      </div>

      {/* Open detail arrow — appears on hover */}
      <div
        className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <ArrowRight size={14} />
      </div>
    </motion.div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function TaskDrawer({
  task,
  propertyLabel,
  onClose,
  onToggleSubtask,
  pendingSubtasks,
  comments,
  onAddComment,
  isSubmittingComment,
}: {
  task: WorkspaceTask;
  propertyLabel: string | null;
  onClose: () => void;
  onToggleSubtask: (subtaskId: string, completed: boolean) => void;
  pendingSubtasks: Set<string>;
  comments: TaskComment[];
  onAddComment: (content: string) => void;
  isSubmittingComment: boolean;
}) {
  const [comment, setComment] = useState("");
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const { indicator } = statusStyle(task.status);
  const meta = getTypeMeta(task.task_type);
  const pBadge = priorityBadge(task.priority);
  const overdue = isOverdue(task);

  function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    onAddComment(comment.trim());
    setComment("");
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-40 bg-black/25"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <motion.div
        key="drawer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 360 }}
        className="fixed inset-y-0 right-0 z-50 flex w-[420px] max-w-[95vw] flex-col overflow-hidden shadow-2xl"
        style={{ backgroundColor: "var(--color-white)" }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ backgroundColor: meta.bg, color: meta.color }}
            >
              {meta.icon}
            </span>
            <span
              className="text-[13px] font-semibold"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {meta.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-warm-gray-100)]"
            style={{ color: "var(--color-text-tertiary)" }}
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Title block */}
          <div className="px-5 pt-5 pb-4">
            <div
              className="absolute left-0 top-0 h-full w-[3px]"
              style={{ backgroundColor: indicator }}
            />
            <h2
              className="text-[17px] font-semibold leading-snug tracking-tight"
              style={{ color: "var(--color-text-primary)" }}
            >
              {task.title}
            </h2>

            {/* Badges row */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Status */}
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  backgroundColor:
                    task.status === "done"
                      ? "rgba(22,163,74,0.10)"
                      : task.status === "blocked"
                        ? "rgba(220,38,38,0.10)"
                        : task.status === "in_progress"
                          ? "rgba(217,119,6,0.10)"
                          : "rgba(2,170,235,0.09)",
                  color:
                    task.status === "done"
                      ? "#16a34a"
                      : task.status === "blocked"
                        ? "#dc2626"
                        : task.status === "in_progress"
                          ? "#d97706"
                          : "#0c6fae",
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: indicator }}
                />
                {task.status === "done"
                  ? "Done"
                  : task.status === "blocked"
                    ? "Blocked"
                    : task.status === "in_progress"
                      ? "In Progress"
                      : task.status === "cancelled"
                        ? "Cancelled"
                        : "Open"}
              </span>

              {/* Priority */}
              {task.priority && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ backgroundColor: pBadge.bg, color: pBadge.fg }}
                >
                  {pBadge.showArrow && <ArrowUp size={9} weight="bold" />}
                  {pBadge.label}
                </span>
              )}

              {/* Property */}
              {propertyLabel && (
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                  style={{
                    backgroundColor: "rgba(2,170,235,0.08)",
                    color: "var(--color-brand)",
                  }}
                >
                  {propertyLabel}
                </span>
              )}
            </div>

            {/* Due date */}
            {task.due_date && (
              <div
                className="mt-3 flex items-center gap-1.5 text-[12px] font-medium"
                style={{ color: overdue ? "#dc2626" : "var(--color-text-tertiary)" }}
              >
                {overdue && <Warning size={12} weight="fill" />}
                Due {formatDue(task.due_date)}
                {overdue && " (overdue)"}
              </div>
            )}
          </div>

          <div
            className="mx-5 border-t"
            style={{ borderColor: "var(--color-warm-gray-200)" }}
          />

          {/* Description */}
          {task.description && (
            <>
              <div className="px-5 py-4">
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {task.description}
                </p>
              </div>
              <div
                className="mx-5 border-t"
                style={{ borderColor: "var(--color-warm-gray-200)" }}
              />
            </>
          )}

          {/* Subtasks */}
          {task.task_subtasks.length > 0 && (
            <>
              <div className="px-5 py-4">
                <div
                  className="mb-3 flex items-center justify-between"
                >
                  <span
                    className="text-[12px] font-semibold uppercase tracking-[0.10em]"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    Subtasks
                  </span>
                  <span
                    className="text-[11px] tabular-nums"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {task.task_subtasks.filter((s) => s.completed).length}/
                    {task.task_subtasks.length} done
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {task.task_subtasks.map((subtask) => {
                    const isPending = pendingSubtasks.has(subtask.id);
                    return (
                      <button
                        key={subtask.id}
                        type="button"
                        disabled={isPending}
                        onClick={() => onToggleSubtask(subtask.id, !subtask.completed)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-warm-gray-100)]"
                        style={{ opacity: isPending ? 0.6 : 1 }}
                      >
                        <span
                          className="flex h-4.5 w-4.5 shrink-0 items-center justify-center"
                          style={{
                            color: subtask.completed ? "#16a34a" : "var(--color-text-tertiary)",
                          }}
                        >
                          <CheckCircle
                            size={17}
                            weight={subtask.completed ? "fill" : "regular"}
                          />
                        </span>
                        <span
                          className="flex-1 text-[13px]"
                          style={{
                            color: subtask.completed
                              ? "var(--color-text-tertiary)"
                              : "var(--color-text-primary)",
                            textDecoration: subtask.completed ? "line-through" : "none",
                          }}
                        >
                          {subtask.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div
                className="mx-5 border-t"
                style={{ borderColor: "var(--color-warm-gray-200)" }}
              />
            </>
          )}

          {/* Comments */}
          <div className="px-5 py-4">
            <span
              className="mb-3 block text-[12px] font-semibold uppercase tracking-[0.10em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Comments
            </span>

            {comments.length === 0 && (
              <p className="text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
                No comments yet.
              </p>
            )}

            <div className="flex flex-col gap-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: "rgba(2,170,235,0.10)", color: "var(--color-brand)" }}
                  >
                    <Chat size={13} weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[13px] leading-relaxed"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {c.content}
                    </p>
                    <span
                      className="mt-0.5 block text-[11px]"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {formatCommentTime(c.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Add comment form */}
            <form onSubmit={handleCommentSubmit} className="mt-4">
              <textarea
                ref={commentRef}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
                className="w-full resize-none rounded-xl border px-3 py-2.5 text-[13px] outline-none transition-colors focus:border-[var(--color-brand)]"
                style={{
                  borderColor: "var(--color-warm-gray-200)",
                  backgroundColor: "var(--color-off-white)",
                  color: "var(--color-text-primary)",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleCommentSubmit(e as unknown as React.FormEvent);
                  }
                }}
              />
              <div className="mt-2 flex items-center justify-between">
                <span
                  className="text-[11px]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  ⌘ + Enter to send
                </span>
                <button
                  type="submit"
                  disabled={!comment.trim() || isSubmittingComment}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-opacity disabled:opacity-40"
                  style={{
                    background: "linear-gradient(135deg, #02AAEB 0%, #1B77BE 100%)",
                    color: "#fff",
                  }}
                >
                  {isSubmittingComment ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

function FilterTabs({
  active,
  counts,
  onChange,
}: {
  active: FilterTab;
  counts: Record<FilterTab, number>;
  onChange: (tab: FilterTab) => void;
}) {
  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "open", label: "Open" },
    { id: "done", label: "Done" },
    { id: "overdue", label: "Overdue" },
  ];

  return (
    <div
      className="flex items-center gap-1 rounded-xl p-1"
      style={{ backgroundColor: "var(--color-warm-gray-100)" }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        const count = counts[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className="relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors"
            style={{
              backgroundColor: isActive ? "var(--color-white)" : "transparent",
              color: isActive ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
              boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {tab.label}
            {count > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] tabular-nums"
                style={{
                  backgroundColor: isActive
                    ? "rgba(2,170,235,0.10)"
                    : "rgba(0,0,0,0.06)",
                  color: isActive ? "var(--color-brand)" : "var(--color-text-tertiary)",
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Phase card ───────────────────────────────────────────────────────────────

function PhaseCard({
  label,
  tasks,
  color,
  onToggle,
}: {
  label: string;
  tasks: Array<{ id: string; title: string; status: string }>;
  color: string;
  onToggle: (id: string, newStatus: "done" | "todo") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const done = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length;
  if (total === 0) return null;

  return (
    <div
      style={{
        border: "1px solid var(--color-warm-gray-200)",
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "var(--color-white)",
      }}
    >
      <button
        type="button"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <PhaseProgressRing done={done} total={total} color={color} size={44} />
        <div style={{ flex: 1 }}>
          <div
            style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}
          >
            {label}
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color, marginTop: 2 }}>
            {done}/{total} done
          </div>
        </div>
        <span
          style={{ fontSize: 10, color: "var(--color-text-tertiary)", lineHeight: 1 }}
        >
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: "0 16px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {tasks.map((t) => {
            const isDone = t.status === "done";
            return (
              <li key={t.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                  onClick={() => onToggle(t.id, isDone ? "todo" : "done")}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    flexShrink: 0,
                    border: `2px solid ${isDone ? color : "var(--color-warm-gray-300, #d1d5db)"}`,
                    background: isDone ? color : "transparent",
                    cursor: "pointer",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: "var(--color-text-primary)",
                    textDecoration: isDone ? "line-through" : "none",
                    opacity: isDone ? 0.6 : 1,
                  }}
                >
                  {t.title}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export function WorkspaceTasksShell({
  tasks: initialTasks,
  properties,
}: {
  tasks: WorkspaceTask[];
  properties: PropertyOption[];
}) {
  const [tasks, setTasks] = useState<WorkspaceTask[]>(initialTasks);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedTask, setSelectedTask] = useState<WorkspaceTask | null>(null);
  const [pendingStatusIds, setPendingStatusIds] = useState<Set<string>>(new Set());
  const [pendingSubtaskIds, setPendingSubtaskIds] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isSubmittingComment, startCommentTransition] = useTransition();
  const [, startStatusTransition] = useTransition();
  const [, startSubtaskTransition] = useTransition();

  const propertyMap = new Map(properties.map((p) => [p.id, p.label]));

  // ── Derived counts ──────────────────────────────────────────────────────────
  const counts: Record<FilterTab, number> = {
    all: tasks.length,
    open: tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length,
    done: tasks.filter((t) => t.status === "done").length,
    overdue: tasks.filter(isOverdue).length,
  };

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filteredTasks = tasks.filter((t) => {
    if (activeTab === "open") return t.status !== "done" && t.status !== "cancelled";
    if (activeTab === "done") return t.status === "done";
    if (activeTab === "overdue") return isOverdue(t);
    return true;
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleToggleStatus(taskId: string, newStatus: "done" | "todo") {
    setPendingStatusIds((prev) => new Set([...prev, taskId]));

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus,
              completed_at: newStatus === "done" ? new Date().toISOString() : null,
            }
          : t,
      ),
    );

    // Also update selected task if open
    setSelectedTask((prev) =>
      prev?.id === taskId
        ? {
            ...prev,
            status: newStatus,
            completed_at: newStatus === "done" ? new Date().toISOString() : null,
          }
        : prev,
    );

    startStatusTransition(async () => {
      const result = await updateTaskStatus(taskId, newStatus);
      if (result.error) {
        // Revert on error
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: newStatus === "done" ? "todo" : "done",
                  completed_at: null,
                }
              : t,
          ),
        );
      }
      setPendingStatusIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    });
  }

  function handleToggleSubtask(subtaskId: string, completed: boolean) {
    setPendingSubtaskIds((prev) => new Set([...prev, subtaskId]));

    // Optimistic update in tasks list
    function applySubtaskUpdate(list: WorkspaceTask[]): WorkspaceTask[] {
      return list.map((t) => ({
        ...t,
        task_subtasks: t.task_subtasks.map((s) =>
          s.id === subtaskId
            ? { ...s, completed, completed_at: completed ? new Date().toISOString() : null }
            : s,
        ),
      }));
    }

    setTasks((prev) => applySubtaskUpdate(prev));
    setSelectedTask((prev) => (prev ? applySubtaskUpdate([prev])[0] : prev));

    startSubtaskTransition(async () => {
      const result = await toggleSubtask(subtaskId, completed);
      if (result.error) {
        // Revert
        function revertSubtaskUpdate(list: WorkspaceTask[]): WorkspaceTask[] {
          return list.map((t) => ({
            ...t,
            task_subtasks: t.task_subtasks.map((s) =>
              s.id === subtaskId ? { ...s, completed: !completed } : s,
            ),
          }));
        }
        setTasks((prev) => revertSubtaskUpdate(prev));
        setSelectedTask((prev) => (prev ? revertSubtaskUpdate([prev])[0] : prev));
      }
      setPendingSubtaskIds((prev) => {
        const next = new Set(prev);
        next.delete(subtaskId);
        return next;
      });
    });
  }

  function handleAddComment(content: string) {
    startCommentTransition(async () => {
      if (!selectedTask) return;
      const tempComment: TaskComment = {
        id: `temp-${Date.now()}`,
        author_id: "",
        content,
        created_at: new Date().toISOString(),
      };
      setComments((prev) => [...prev, tempComment]);

      const result = await addComment(selectedTask.id, content);
      if (result.error) {
        setComments((prev) => prev.filter((c) => c.id !== tempComment.id));
      }
    });
  }

  // ── Summary stats ───────────────────────────────────────────────────────────
  const openCount = counts.open;
  const doneCount = counts.done;
  const overdueCount = counts.overdue;

  // ── Onboarding phases ───────────────────────────────────────────────────────
  const onboardingTasks = tasks.filter(
    (t) => Array.isArray(t.tags) && t.tags.some((tag) => tag.startsWith("onboarding")),
  );
  const docTasks = onboardingTasks.filter((t) =>
    (t.tags ?? []).includes("onboarding:documents"),
  );
  const finTasks = onboardingTasks.filter((t) =>
    (t.tags ?? []).includes("onboarding:finances"),
  );
  const listTasks = onboardingTasks.filter((t) =>
    (t.tags ?? []).includes("onboarding:listings"),
  );
  const hasOnboarding = onboardingTasks.length > 0;

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (tasks.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl border px-8 py-16 text-center"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
        }}
      >
        <span
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: "var(--color-warm-gray-100)",
            color: "var(--color-text-tertiary)",
          }}
        >
          <ListChecks size={26} weight="duotone" />
        </span>
        <h3
          className="mt-5 text-[16px] font-semibold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          No tasks yet
        </h3>
        <p
          className="mt-2 max-w-sm text-[13px] leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Your Proxy team will assign tasks here when there is something that needs your attention.
        </p>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-3 py-1 text-[12px] font-semibold"
          style={{
            backgroundColor: "var(--color-warm-gray-100)",
            color: "var(--color-text-secondary)",
          }}
        >
          {tasks.length} task{tasks.length !== 1 ? "s" : ""}
        </span>
        {openCount > 0 && (
          <span
            className="rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{ backgroundColor: "rgba(2,170,235,0.09)", color: "#0c6fae" }}
          >
            {openCount} open
          </span>
        )}
        {overdueCount > 0 && (
          <span
            className="rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{ backgroundColor: "rgba(220,38,38,0.09)", color: "#dc2626" }}
          >
            {overdueCount} overdue
          </span>
        )}
        {doneCount > 0 && (
          <span
            className="rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{ backgroundColor: "rgba(22,163,74,0.09)", color: "#16a34a" }}
          >
            {doneCount} done
          </span>
        )}
      </div>

      {/* Onboarding phase cards */}
      {hasOnboarding && (
        <section style={{ marginBottom: 4 }}>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              margin: "0 0 10px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Onboarding
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <PhaseCard
              label="Documents"
              tasks={docTasks}
              color="#6366f1"
              onToggle={handleToggleStatus}
            />
            <PhaseCard
              label="Finances"
              tasks={finTasks}
              color="#10b981"
              onToggle={handleToggleStatus}
            />
            <PhaseCard
              label="Listings"
              tasks={listTasks}
              color="#8b5cf6"
              onToggle={handleToggleStatus}
            />
          </div>
        </section>
      )}

      {/* Filter tabs */}
      <FilterTabs active={activeTab} counts={counts} onChange={setActiveTab} />

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-2xl border py-10 text-[13px]"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            color: "var(--color-text-tertiary)",
            borderStyle: "dashed",
          }}
        >
          No {activeTab === "overdue" ? "overdue" : activeTab === "done" ? "completed" : "open"}{" "}
          tasks.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                propertyLabel={task.property_id ? (propertyMap.get(task.property_id) ?? null) : null}
                onOpen={() => {
                  setSelectedTask(task);
                  setComments([]);
                }}
                onToggleStatus={handleToggleStatus}
                pendingIds={pendingStatusIds}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Detail drawer */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDrawer
            task={selectedTask}
            propertyLabel={
              selectedTask.property_id
                ? (propertyMap.get(selectedTask.property_id) ?? null)
                : null
            }
            onClose={() => setSelectedTask(null)}
            onToggleSubtask={handleToggleSubtask}
            pendingSubtasks={pendingSubtaskIds}
            comments={comments}
            onAddComment={handleAddComment}
            isSubmittingComment={isSubmittingComment}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Task } from '@/lib/admin/task-types';
import { updateTask, completeTask, uncompleteTask, createTask } from '@/lib/admin/task-actions';
import { SubtaskInlineForm } from './SubtaskInlineForm';
import { DatePickerDropdown } from './DatePickerDropdown';
import {
  Flag,
  CalendarBlank,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  DotsThree,
  CaretDown,
  CaretUp,
  Paperclip,
  PaperPlaneTilt,
} from '@phosphor-icons/react';
import styles from './TaskDetailModal.module.css';

// Priority config
const PRIORITY_OPTIONS = [
  { value: 1 as const, label: 'Urgent', color: '#ef4444' },
  { value: 2 as const, label: 'High', color: '#f59e0b' },
  { value: 3 as const, label: 'Medium', color: '#60a5fa' },
  { value: 4 as const, label: 'None', color: '#9ca3af' },
] as const;

function getPriorityConfig(p: 1 | 2 | 3 | 4) {
  return PRIORITY_OPTIONS.find((o) => o.value === p) ?? PRIORITY_OPTIONS[3];
}

function parseLocalDate(iso: string): Date {
  const p = iso.split('T')[0].split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}

function formatDateLabel(iso: string | null): string {
  if (!iso) return 'No date';
  const d = parseLocalDate(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// TagEditor — inline chip-based tag editor
type TagEditorProps = {
  tags: string[];
  onChange: (newTags: string[]) => void;
};

function TagEditor({ tags, onChange }: TagEditorProps) {
  const [adding, setAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function commitTag() {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
    setAdding(false);
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className={styles.tagEditor}>
      {tags.map((tag) => (
        <span key={tag} className={styles.tagChip}>
          {tag}
          <button
            type="button"
            className={styles.tagChipRemove}
            onClick={() => removeTag(tag)}
            aria-label={`Remove label ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          className={styles.tagInput}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitTag(); }
            if (e.key === 'Escape') { setInputValue(''); setAdding(false); }
          }}
          onBlur={commitTag}
          autoFocus
          placeholder="Label..."
        />
      ) : (
        <button
          type="button"
          className={styles.stubLink}
          onClick={() => setAdding(true)}
        >
          + Labels
        </button>
      )}
    </div>
  );
}

// Subtask row type used locally
type SubtaskRow = {
  id: string;
  title: string;
  status: string;
};

function useSubtasks(task: Task | null) {
  // Subtasks are managed optimistically. On open, start empty.
  // Created subtasks are appended; toggled subtasks update in place.
  const [subtasks, setSubtasks] = useState<SubtaskRow[]>([]);

  useEffect(() => {
    setSubtasks([]);
  }, [task?.id]);

  return { subtasks, setSubtasks };
}

export type TaskDetailModalProps = {
  task: Task | null;
  onClose: () => void;
  onSaved?: (taskId: string) => void;
};

export function TaskDetailModal({ task, onClose, onSaved }: TaskDetailModalProps) {
  const [, startTransition] = useTransition();

  // Local state
  const [localStatus, setLocalStatus] = useState<string>('todo');
  const [localPriority, setLocalPriority] = useState<1 | 2 | 3 | 4>(4);
  const [localDueAt, setLocalDueAt] = useState<string | null>(null);
  const [localDeadline, setLocalDeadline] = useState<string | null>(null);
  const [savedState, setSavedState] = useState<null | 'saving' | 'saved'>(null);
  const [subtasksExpanded, setSubtasksExpanded] = useState(true);
  const [commentsExpanded, setCommentsExpanded] = useState(true);
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [localTags, setLocalTags] = useState<string[]>([]);
  const [commentText, setCommentText] = useState('');
  const [localComments, setLocalComments] = useState<{ id: string; text: string; at: string }[]>([]);

  const titleRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const priorityMenuRef = useRef<HTMLDivElement>(null);

  const { subtasks, setSubtasks } = useSubtasks(task);

  function autoResizeTextarea(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  // Re-initialize state when task changes
  useEffect(() => {
    if (!task) return;
    setLocalStatus(task.status);
    setLocalPriority(task.priority);
    setLocalDueAt(task.dueAt);
    setLocalDeadline(null);
    setLocalTags(task.tags ?? []);
    setShowSubtaskForm(false);
    setShowDatePicker(false);
    setShowDeadlinePicker(false);
    setShowPriorityMenu(false);
    setSavedState(null);
    setCommentText('');
    setLocalComments([]);

    if (titleRef.current) {
      titleRef.current.innerText = task.title;
    }
    if (descRef.current) {
      descRef.current.value = task.description ?? '';
      autoResizeTextarea(descRef.current);
    }
  }, [task?.id]);

  // Escape key
  useEffect(() => {
    if (!task) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showPriorityMenu) { setShowPriorityMenu(false); return; }
        if (showDatePicker) { setShowDatePicker(false); return; }
        if (showDeadlinePicker) { setShowDeadlinePicker(false); return; }
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [task?.id, onClose, showPriorityMenu, showDatePicker, showDeadlinePicker]);

  // Close priority menu on outside click
  useEffect(() => {
    if (!showPriorityMenu) return;
    function handleClick(e: MouseEvent) {
      if (priorityMenuRef.current && !priorityMenuRef.current.contains(e.target as Node)) {
        setShowPriorityMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPriorityMenu]);

  // Save wrapper
  const withSave = useCallback(async (fn: () => Promise<void>) => {
    if (!task) return;
    setSavedState('saving');
    try {
      await fn();
      setSavedState('saved');
      setTimeout(() => setSavedState(null), 2000);
      onSaved?.(task.id);
    } catch {
      setSavedState(null);
    }
  }, [task, onSaved]);

  const handleTitleBlur = useCallback(() => {
    if (!task || !titleRef.current) return;
    const newTitle = titleRef.current.innerText.trim();
    if (!newTitle || newTitle === task.title) return;
    startTransition(() => {
      withSave(() => updateTask(task.id, { title: newTitle }));
    });
  }, [task, withSave]);

  const handleDescBlur = useCallback(() => {
    if (!task || !descRef.current) return;
    const newDesc = descRef.current.value;
    if (newDesc === (task.description ?? '')) return;
    startTransition(() => {
      withSave(() => updateTask(task.id, { description: newDesc || null }));
    });
  }, [task, withSave]);

  const toggleDone = useCallback(() => {
    if (!task) return;
    const isDone = localStatus === 'done';
    setLocalStatus(isDone ? 'todo' : 'done');
    startTransition(() => {
      withSave(async () => {
        if (isDone) await uncompleteTask(task.id);
        else await completeTask(task.id);
      });
    });
  }, [task, localStatus, withSave]);

  const handleDueAtChange = useCallback((iso: string | null) => {
    if (!task) return;
    setLocalDueAt(iso);
    setShowDatePicker(false);
    startTransition(() => {
      withSave(() => updateTask(task.id, { dueAt: iso }));
    });
  }, [task, withSave]);

  const handlePriorityChange = useCallback((value: 1 | 2 | 3 | 4) => {
    if (!task) return;
    setLocalPriority(value);
    setShowPriorityMenu(false);
    startTransition(() => {
      withSave(() => updateTask(task.id, { priority: value }));
    });
  }, [task, withSave]);

  const handleToggleSubtask = useCallback((subtaskId: string, currentStatus: string) => {
    setSubtasks((prev) =>
      prev.map((s) =>
        s.id === subtaskId
          ? { ...s, status: currentStatus === 'done' ? 'todo' : 'done' }
          : s
      )
    );
    startTransition(() => {
      withSave(async () => {
        if (currentStatus === 'done') await uncompleteTask(subtaskId);
        else await completeTask(subtaskId);
      });
    });
  }, [setSubtasks, withSave]);

  const handleSubtaskSave = useCallback(async (data: {
    title: string;
    dueAt: string | null;
    priority: 1 | 2 | 3 | 4 | null;
  }) => {
    if (!task) return;
    await createTask({
      title: data.title,
      parentTaskId: task.id,
      dueAt: data.dueAt,
      priority: data.priority ?? undefined,
    });
    setSubtasks((prev) => [
      ...prev,
      { id: `optimistic-${Date.now()}`, title: data.title, status: 'todo' },
    ]);
    onSaved?.(task.id);
  }, [task, onSaved, setSubtasks]);

  const priorityConfig = getPriorityConfig(localPriority);

  return (
    <AnimatePresence>
      {task && (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            aria-label="Task details"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <span className={styles.breadcrumb}>
                  {task.parent ? task.parent.label : 'Inbox'}
                </span>
                {savedState && (
                  <span
                    className={`${styles.savedIndicator} ${
                      savedState === 'saving'
                        ? styles.savedIndicatorSaving
                        : styles.savedIndicatorSaved
                    }`}
                  >
                    {savedState === 'saving' ? 'Saving...' : 'Saved'}
                  </span>
                )}
              </div>
              <div className={styles.headerRight}>
                <button
                  type="button"
                  className={styles.headerIconBtn}
                  aria-label="Previous task"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  className={styles.headerIconBtn}
                  aria-label="Next task"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  className={styles.headerIconBtn}
                  aria-label="More options"
                >
                  <DotsThree size={18} weight="bold" />
                </button>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className={styles.body}>
              {/* Main column */}
              <div className={styles.main}>
                {/* Title */}
                <div className={styles.titleArea}>
                  <button
                    type="button"
                    className={`${styles.completeCircle} ${
                      localStatus === 'done' ? styles.completeCircleDone : ''
                    }`}
                    onClick={toggleDone}
                    aria-label={localStatus === 'done' ? 'Mark incomplete' : 'Mark complete'}
                  />
                  <div
                    ref={titleRef}
                    className={`${styles.titleEditable} ${
                      localStatus === 'done' ? styles.titleDone : ''
                    }`}
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="Task name"
                    onBlur={handleTitleBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        titleRef.current?.blur();
                      }
                    }}
                  />
                </div>

                {/* Description */}
                <textarea
                  ref={descRef}
                  className={styles.description}
                  placeholder="Add a description..."
                  onBlur={handleDescBlur}
                  onInput={(e) => autoResizeTextarea(e.currentTarget)}
                  rows={2}
                />

                {/* Subtasks section */}
                <div className={styles.subtasksSection}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>
                      Subtasks{' '}
                      {subtasks.length > 0 &&
                        `${subtasks.filter((s) => s.status === 'done').length}/${subtasks.length}`}
                    </span>
                    <button
                      type="button"
                      className={styles.chevronBtn}
                      onClick={() => setSubtasksExpanded((v) => !v)}
                      aria-label={subtasksExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                    >
                      {subtasksExpanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
                    </button>
                  </div>

                  {subtasksExpanded && (
                    <>
                      {subtasks.map((s) => (
                        <div key={s.id} className={styles.subtaskRow}>
                          <button
                            type="button"
                            className={`${styles.subtaskCircle} ${
                              s.status === 'done' ? styles.subtaskCircleDone : ''
                            }`}
                            onClick={() => handleToggleSubtask(s.id, s.status)}
                            aria-label={s.status === 'done' ? 'Mark incomplete' : 'Mark complete'}
                          />
                          <span
                            className={`${styles.subtaskTitle} ${
                              s.status === 'done' ? styles.subtaskTitleDone : ''
                            }`}
                          >
                            {s.title}
                          </span>
                        </div>
                      ))}

                      {showSubtaskForm ? (
                        <SubtaskInlineForm
                          parentTaskId={task.id}
                          onSave={handleSubtaskSave}
                          onClose={() => setShowSubtaskForm(false)}
                        />
                      ) : (
                        <button
                          type="button"
                          className={styles.addSubtaskBtn}
                          onClick={() => setShowSubtaskForm(true)}
                        >
                          + Add sub-task
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Comments section */}
                <div className={styles.commentsSection}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>
                      Comments {localComments.length > 0 ? localComments.length : ''}
                    </span>
                    <button
                      type="button"
                      className={styles.chevronBtn}
                      onClick={() => setCommentsExpanded((v) => !v)}
                      aria-label={commentsExpanded ? 'Collapse comments' : 'Expand comments'}
                    >
                      {commentsExpanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
                    </button>
                  </div>
                  {commentsExpanded && (
                    <>
                      {localComments.map((c) => (
                        <div key={c.id} className={styles.commentEntry}>
                          <span className={styles.commentAvatar}>
                            {task.assigneeName ? task.assigneeName.charAt(0).toUpperCase() : 'A'}
                          </span>
                          <div className={styles.commentEntryBody}>
                            <div className={styles.commentEntryMeta}>
                              <span className={styles.commentEntryName}>
                                {task.assigneeName ?? 'Admin'}
                              </span>
                              <span className={styles.commentEntryTime}>{c.at}</span>
                            </div>
                            <p className={styles.commentEntryText}>{c.text}</p>
                          </div>
                        </div>
                      ))}
                      {/* Inline composer row — always visible */}
                      <div className={styles.commentComposerRow}>
                        <span className={styles.commentAvatar}>
                          {task.createdByName ? task.createdByName.charAt(0).toUpperCase() : 'A'}
                        </span>
                        <input
                          className={styles.commentInlineInput}
                          placeholder="Comment"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && commentText.trim()) {
                              setLocalComments((prev) => [
                                ...prev,
                                { id: `c-${Date.now()}`, text: commentText.trim(), at: 'Just now' },
                              ]);
                              setCommentText('');
                            }
                            if (e.key === 'Escape') setCommentText('');
                          }}
                        />
                        {commentText.trim() ? (
                          <button
                            type="button"
                            className={styles.commentSendBtn}
                            aria-label="Send comment"
                            onClick={() => {
                              setLocalComments((prev) => [
                                ...prev,
                                { id: `c-${Date.now()}`, text: commentText.trim(), at: 'Just now' },
                              ]);
                              setCommentText('');
                            }}
                          >
                            <PaperPlaneTilt size={14} weight="fill" />
                          </button>
                        ) : (
                          <button type="button" className={styles.commentAttachBtn} aria-label="Attach file">
                            <Paperclip size={14} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Sidebar */}
              <div className={styles.sidebar}>
                {/* Project */}
                <div className={styles.sidebarRow}>
                  <span className={styles.sidebarLabel}>Project</span>
                  {task.parent ? (
                    <span className={styles.projectChip}>{task.parent.label}</span>
                  ) : (
                    <span className={styles.sidebarValue}>—</span>
                  )}
                </div>

                {/* Date */}
                <div className={styles.sidebarRow}>
                  <span className={styles.sidebarLabel}>Date</span>
                  <button
                    type="button"
                    className={`${styles.dateTrigger} ${!localDueAt ? styles.dateTriggerEmpty : ''}`}
                    onClick={() => {
                      setShowDeadlinePicker(false);
                      setShowPriorityMenu(false);
                      setShowDatePicker((v) => !v);
                    }}
                  >
                    <CalendarBlank size={13} />
                    {formatDateLabel(localDueAt)}
                  </button>
                  {showDatePicker && (
                    <div className={styles.datePickerWrap}>
                      <DatePickerDropdown
                        value={localDueAt}
                        onChange={handleDueAtChange}
                        onClose={() => setShowDatePicker(false)}
                      />
                    </div>
                  )}
                </div>

                {/* Deadline */}
                <div className={styles.sidebarRow}>
                  <span className={styles.sidebarLabel}>Deadline</span>
                  <button
                    type="button"
                    className={`${styles.dateTrigger} ${!localDeadline ? styles.dateTriggerEmpty : ''}`}
                    onClick={() => {
                      setShowDatePicker(false);
                      setShowPriorityMenu(false);
                      setShowDeadlinePicker((v) => !v);
                    }}
                  >
                    <CalendarBlank size={13} />
                    {formatDateLabel(localDeadline)}
                  </button>
                  {showDeadlinePicker && (
                    <div className={styles.datePickerWrap}>
                      <DatePickerDropdown
                        value={localDeadline}
                        onChange={(iso) => {
                          setLocalDeadline(iso);
                          setShowDeadlinePicker(false);
                        }}
                        onClose={() => setShowDeadlinePicker(false)}
                      />
                    </div>
                  )}
                </div>

                {/* Priority */}
                <div className={styles.sidebarRow} ref={priorityMenuRef}>
                  <span className={styles.sidebarLabel}>Priority</span>
                  <button
                    type="button"
                    className={styles.priorityTrigger}
                    onClick={() => {
                      setShowDatePicker(false);
                      setShowDeadlinePicker(false);
                      setShowPriorityMenu((v) => !v);
                    }}
                  >
                    <Flag size={14} weight="fill" color={priorityConfig.color} />
                    <span style={{ color: priorityConfig.color, fontSize: 13 }}>
                      {priorityConfig.label}
                    </span>
                  </button>
                  {showPriorityMenu && (
                    <div className={styles.priorityDropdown}>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={styles.priorityOption}
                          onClick={() => handlePriorityChange(opt.value)}
                        >
                          <span className={styles.priorityOptionLeft}>
                            <Flag size={14} weight="fill" color={opt.color} />
                            <span style={{ color: '#111827', fontSize: 13 }}>{opt.label}</span>
                          </span>
                          {localPriority === opt.value && (
                            <Check size={13} className={styles.priorityCheck} weight="bold" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Labels */}
                <div className={styles.sidebarRow}>
                  <span className={styles.sidebarLabel}>Labels</span>
                  <TagEditor
                    tags={localTags}
                    onChange={(newTags) => {
                      setLocalTags(newTags);
                      startTransition(() => {
                        withSave(() => updateTask(task.id, { tags: newTags }));
                      });
                    }}
                  />
                </div>

                {/* Reminders (stub) */}
                <div className={styles.sidebarRow}>
                  <span className={styles.sidebarLabel}>Reminders</span>
                  <span className={styles.stubLink}>+ Reminders</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

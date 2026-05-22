'use client';

import { useState, useEffect, useRef, useId } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DotsSixVertical, X, Plus } from '@phosphor-icons/react';
import { createTaskFromInsight, fetchAssignableProfiles, type AssignableProfile } from '@/lib/admin/insight-actions';
import { CustomSelect } from '@/components/admin/CustomSelect';
import { DatePickerInput } from '@/components/admin/DatePickerInput';
import styles from './CreateTaskModal.module.css';

type SubtaskItem = { id: string; text: string };

const overlayVariants = {
  hidden: { opacity: 0, transition: { duration: 0.14, ease: 'easeIn' as const } },
  visible: { opacity: 1, transition: { duration: 0.16, ease: 'easeOut' as const } },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.14, ease: 'easeIn' as const } },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 26 } },
};

type Props = {
  open: boolean;
  insightId: string;
  propertyId: string;
  initialTitle: string;
  initialDescription: string;
  initialSubtasks: string[];
  onClose: () => void;
  onSuccess: () => void;
};

function SortableRow({
  item,
  onChange,
  onDelete,
}: {
  item: SubtaskItem;
  onChange: (text: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={styles.subtaskRow}>
      <button
        type="button"
        className={styles.dragHandle}
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <DotsSixVertical size={14} />
      </button>
      <input
        className={styles.subtaskInput}
        value={item.text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Subtask…"
      />
      <button
        type="button"
        className={styles.subtaskDelete}
        aria-label="Remove subtask"
        onClick={onDelete}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function CreateTaskModal({
  open,
  insightId,
  propertyId,
  initialTitle,
  initialDescription,
  initialSubtasks,
  onClose,
  onSuccess,
}: Props) {
  const listId = useId();
  const prevOpenRef = useRef(false);
  const initTitleRef = useRef(initialTitle);
  const initDescRef = useRef(initialDescription);
  const initSubtasksRef = useRef(initialSubtasks);
  initTitleRef.current = initialTitle;
  initDescRef.current = initialDescription;
  initSubtasksRef.current = initialSubtasks;
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([]);
  const [profiles, setProfiles] = useState<AssignableProfile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;
    if (!justOpened) return;
    setTitle(initTitleRef.current);
    setDescription(initDescRef.current);
    setSubtasks(initSubtasksRef.current.map((text) => ({ id: crypto.randomUUID(), text })));
    setAssigneeId(null);
    setDueDate('');
    setError(null);
    let isMounted = true;
    fetchAssignableProfiles()
      .then((data) => { if (isMounted) setProfiles(data); })
      .catch(console.error);
    return () => { isMounted = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSubtasks((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      await createTaskFromInsight({
        propertyId,
        title: title.trim(),
        body: description,
        suggestedFixes: subtasks.map((s) => s.text).filter((t) => t.trim().length > 0),
        assigneeId,
        dueDate: dueDate || null,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const subtaskCount = subtasks.filter((s) => s.text.trim().length > 0).length;

  return (
    <AnimatePresence>
      {open && (
      <motion.div
        className={styles.overlay}
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={(e) => e.stopPropagation()}
        >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Create task</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div>
            <label className={styles.fieldLabel}>Title</label>
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className={styles.fieldLabel}>Description</label>
            <textarea
              className={styles.textarea}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Assigned to</label>
              <CustomSelect
                value={assigneeId ?? ''}
                onChange={(v) => setAssigneeId(v || null)}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...profiles.map((p) => ({ value: p.id, label: p.fullName ?? 'Unknown' })),
                ]}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Due date</label>
              <DatePickerInput
                value={dueDate}
                onChange={setDueDate}
                placeholder="No due date"
              />
            </div>
          </div>

          <div>
            <label className={styles.fieldLabel}>Subtasks</label>
            <DndContext
              id={listId}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={subtasks.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className={styles.subtaskList}>
                  {subtasks.map((item) => (
                    <SortableRow
                      key={item.id}
                      item={item}
                      onChange={(text) =>
                        setSubtasks((prev) =>
                          prev.map((s) => (s.id === item.id ? { ...s, text } : s))
                        )
                      }
                      onDelete={() =>
                        setSubtasks((prev) => prev.filter((s) => s.id !== item.id))
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <button
              type="button"
              className={styles.addSubtaskBtn}
              onClick={() =>
                setSubtasks((prev) => [...prev, { id: crypto.randomUUID(), text: '' }])
              }
            >
              <Plus size={13} /> Add subtask
            </button>
          </div>
        </div>

        <div className={styles.modalFooter}>
          {error && <span className={styles.errorMsg}>{error}</span>}
          <button
            type="button"
            className={styles.btnCancel}
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnConfirm}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Creating…'
              : subtaskCount > 0
              ? `Create task + ${subtaskCount} subtask${subtaskCount !== 1 ? 's' : ''}`
              : 'Create task'}
          </button>
        </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}

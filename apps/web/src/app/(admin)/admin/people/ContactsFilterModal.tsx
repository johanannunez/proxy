'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  X,
  Pencil,
  Trash,
  MagnifyingGlass,
  BookmarkSimple,
  UserCircle,
  UserMinus,
  Funnel,
  Kanban,
  Tag as TagIcon,
} from '@phosphor-icons/react';
import type { ContactFilterOptions } from '@/lib/admin/people-list';
import type { ContactSavedView } from '@/lib/admin/contact-types';
import type { ContactSource } from '@/lib/admin/contact-sources';
import {
  IconPickerPopover,
  ViewIcon,
  DEFAULT_ICON_COLOR,
} from '@/components/admin/IconPickerPopover';
import {
  createSavedView,
  renameSavedView,
  deleteSavedView,
  createContactSource,
  updateContactSource,
  deleteContactSource,
} from './actions';
import { useContactsFilters, UNASSIGNED_FILTER_KEY } from './ContactsFiltersProvider';
import { useBoardTools } from './BoardToolsContext';
import { getSourceIcon } from './source-icons';
import styles from './ContactsFilterModal.module.css';

type Tab = 'filters' | 'assignee' | 'views' | 'sources';

type Props = {
  open: boolean;
  onClose: () => void;
  filterOptions: ContactFilterOptions;
  views: ContactSavedView[];
  allSources: ContactSource[];
  currentUserId: string | null;
};

const UNASSIGNED_KEY = UNASSIGNED_FILTER_KEY;

// Fallback icon + color for shared "default" views that haven't had icons set.
const DEFAULT_VIEW_ICONS: Record<string, { iconId: string; iconColor: string }> = {
  'lead-pipeline': { iconId: 'Funnel', iconColor: '#02AAEB' },
  onboarding: { iconId: 'Sparkle', iconColor: '#8b5cf6' },
  'active-owners': { iconId: 'HouseLine', iconColor: '#10b981' },
  archived: { iconId: 'Archive', iconColor: '#9ca3af' },
};

function resolveViewIcon(view: ContactSavedView): {
  iconId: string | null;
  iconColor: string;
} {
  if (view.iconId) {
    return { iconId: view.iconId, iconColor: view.iconColor ?? DEFAULT_ICON_COLOR };
  }
  const fallback = DEFAULT_VIEW_ICONS[view.key];
  if (fallback) return fallback;
  return { iconId: null, iconColor: DEFAULT_ICON_COLOR };
}

export function ContactsFilterModal({
  open,
  onClose,
  filterOptions,
  views,
  allSources,
  currentUserId,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>('filters');
  const { sources, assignees, setSources, setAssignees, clear, hiddenViews, setHiddenViews } =
    useContactsFilters();
  const { tools } = useBoardTools();
  const sourceCount = sources.length;
  const assigneeCount = assignees.length;

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  const sharedViews = views.filter((v) => !v.isPersonal);
  const personalViews = views.filter((v) => v.isPersonal);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <h3 className={styles.title}>Filter people</h3>
            <p className={styles.subtitle}>
              Dial in exactly what you want to see.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={15} weight="bold" />
          </button>
        </div>

        <div className={styles.tabStrip} role="tablist">
          <TabBtn tab="filters" active={activeTab} onClick={setActiveTab} icon={Funnel} label="Filters" count={sourceCount} />
          <TabBtn tab="assignee" active={activeTab} onClick={setActiveTab} icon={UserCircle} label="Assignee" count={assigneeCount} />
          <TabBtn tab="views" active={activeTab} onClick={setActiveTab} icon={Kanban} label="Views" />
          <TabBtn tab="sources" active={activeTab} onClick={setActiveTab} icon={TagIcon} label="Sources" />
        </div>

        <div className={styles.tabBody}>
          {activeTab === 'filters' && (
            <FiltersTab
              filterOptions={filterOptions}
              sources={sources}
              setSources={setSources}
              clear={clear}
              activeCount={sourceCount + assigneeCount}
            />
          )}
          {activeTab === 'assignee' && (
            <AssigneeTab
              filterOptions={filterOptions}
              assignees={assignees}
              setAssignees={setAssignees}
              currentUserId={currentUserId}
            />
          )}
          {activeTab === 'views' && (
            <ViewsTab
              sharedViews={sharedViews}
              personalViews={personalViews}
              hiddenViews={hiddenViews}
              onHiddenViewsChange={setHiddenViews}
              tools={tools}
              onClose={onClose}
            />
          )}
          {activeTab === 'sources' && (
            <SourcesTab allSources={allSources} />
          )}
        </div>
      </div>
    </dialog>
  );
}

function TabBtn({
  tab,
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  tab: Tab;
  active: Tab;
  onClick: (t: Tab) => void;
  icon: React.ComponentType<{ size?: number; weight?: 'bold' | 'regular' | 'fill' }>;
  label: string;
  count?: number;
}) {
  const isActive = active === tab;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ''}`}
      onClick={() => onClick(tab)}
    >
      <Icon size={13} weight={isActive ? 'fill' : 'regular'} />
      <span>{label}</span>
      {typeof count === 'number' && count > 0 ? (
        <span className={styles.tabCount}>{count}</span>
      ) : null}
    </button>
  );
}

// ── Filters tab (Source only) ─────────────────────────────────────────────────

function FiltersTab({
  filterOptions,
  sources,
  setSources,
  clear,
  activeCount,
}: {
  filterOptions: ContactFilterOptions;
  sources: string[];
  setSources: (v: string[]) => void;
  clear: () => void;
  activeCount: number;
}) {
  return (
    <div className={styles.tabContent}>
      <Section label="Source" hint="Pick which lead sources should appear.">
        {filterOptions.sources.length === 0 ? (
          <p className={styles.emptyNote}>No sources available yet.</p>
        ) : (
          <div className={styles.sourceGrid}>
            {filterOptions.sources.map((s) => {
              const icon = getSourceIcon(s.slug);
              const checked = sources.includes(s.slug);
              return (
                <SourceCard
                  key={s.slug}
                  label={s.label}
                  icon={icon}
                  checked={checked}
                  onToggle={() => {
                    if (checked) setSources(sources.filter((x) => x !== s.slug));
                    else setSources([...sources, s.slug]);
                  }}
                />
              );
            })}
          </div>
        )}
      </Section>

      {activeCount > 0 && (
        <div className={styles.filterFooter}>
          <button type="button" className={styles.clearAllBtn} onClick={clear}>
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}

function SourceCard({
  label,
  icon,
  checked,
  onToggle,
}: {
  label: string;
  icon: ReturnType<typeof getSourceIcon>;
  checked: boolean;
  onToggle: () => void;
}) {
  const { Icon, color, accent } = icon;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`${styles.sourceCard} ${checked ? styles.sourceCardOn : ''}`}
      style={checked ? { borderColor: color, boxShadow: `0 0 0 2px ${accent}` } : undefined}
    >
      <span
        className={styles.sourceCardIcon}
        style={{ background: accent, color }}
        aria-hidden
      >
        <Icon size={15} weight="fill" />
      </span>
      <span className={styles.sourceCardLabel}>{label}</span>
      {checked ? <span className={styles.sourceCardCheck} style={{ background: color }} /> : null}
    </button>
  );
}

// ── Assignee tab ──────────────────────────────────────────────────────────────

function AssigneeTab({
  filterOptions,
  assignees,
  setAssignees,
  currentUserId,
}: {
  filterOptions: ContactFilterOptions;
  assignees: string[];
  setAssignees: (v: string[]) => void;
  currentUserId: string | null;
}) {
  const unassignedChecked = assignees.includes(UNASSIGNED_KEY);

  function toggle(id: string) {
    if (assignees.includes(id)) setAssignees(assignees.filter((x) => x !== id));
    else setAssignees([...assignees, id]);
  }

  return (
    <div className={styles.tabContent}>
      <Section label="Assignee" hint="Show people assigned to specific Proxy team members.">
        <div className={styles.assigneeList}>
          <AssigneeRow
            label="Unassigned"
            sublabel="People with no assignee"
            initial="?"
            isUnassigned
            checked={unassignedChecked}
            onToggle={() => toggle(UNASSIGNED_KEY)}
          />
          {filterOptions.assignees.length === 0 ? (
            <p className={styles.emptyNoteInner}>No teammates yet.</p>
          ) : (
            filterOptions.assignees.map((a) => {
              const isMe = currentUserId !== null && a.id === currentUserId;
              return (
                <AssigneeRow
                  key={a.id}
                  label={a.name}
                  sublabel={isMe ? 'That is you' : undefined}
                  initial={initialsFor(a.name)}
                  isMe={isMe}
                  checked={assignees.includes(a.id)}
                  onToggle={() => toggle(a.id)}
                />
              );
            })
          )}
        </div>
      </Section>
    </div>
  );
}

function AssigneeRow({
  label,
  sublabel,
  initial,
  isMe,
  isUnassigned,
  checked,
  onToggle,
}: {
  label: string;
  sublabel?: string;
  initial: string;
  isMe?: boolean;
  isUnassigned?: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`${styles.assigneeRow} ${checked ? styles.assigneeRowOn : ''}`}
    >
      <span
        className={`${styles.assigneeAvatar} ${isUnassigned ? styles.assigneeAvatarGhost : ''}`}
        aria-hidden
      >
        {isUnassigned ? <UserMinus size={14} weight="bold" /> : initial}
      </span>
      <span className={styles.assigneeMain}>
        <span className={styles.assigneeName}>
          {label}
          {isMe ? <span className={styles.meBadge}>Me</span> : null}
        </span>
        {sublabel ? <span className={styles.assigneeSub}>{sublabel}</span> : null}
      </span>
      <span
        className={`${styles.checkboxBox} ${checked ? styles.checkboxBoxOn : ''}`}
        aria-hidden
      />
    </button>
  );
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// ── Views tab ─────────────────────────────────────────────────────────────────

function ViewsTab({
  sharedViews,
  personalViews,
  hiddenViews,
  onHiddenViewsChange,
  tools,
  onClose,
}: {
  sharedViews: ContactSavedView[];
  personalViews: ContactSavedView[];
  hiddenViews: string[];
  onHiddenViewsChange: (next: string[]) => void;
  tools: React.ReactNode;
  onClose: () => void;
}) {
  function toggleView(key: string) {
    if (hiddenViews.includes(key)) {
      onHiddenViewsChange(hiddenViews.filter((k) => k !== key));
    } else {
      onHiddenViewsChange([...hiddenViews, key]);
    }
  }

  return (
    <div className={styles.tabContent}>
      <Section label="Columns" hint="Show, collapse, or hide pipeline columns.">
        {tools ? (
          <div className={styles.toolsWrap}>{tools}</div>
        ) : (
          <p className={styles.emptyNote}>
            Switch to kanban view to manage columns.
          </p>
        )}
      </Section>

      <Section label="Default views" hint="Hide ones you do not need today.">
        <div className={styles.viewList}>
          {sharedViews.map((v) => (
            <ViewRow
              key={v.id}
              view={v}
              isDefault
              hidden={hiddenViews.includes(v.key)}
              onToggleHidden={() => toggleView(v.key)}
            />
          ))}
        </div>
      </Section>

      <Section
        label="Your saved views"
        count={personalViews.length}
        hint="Personal snapshots of filters and view mode."
      >
        {personalViews.length === 0 ? (
          <p className={styles.emptyNote}>No saved views yet. Save one below.</p>
        ) : (
          <div className={styles.viewList}>
            {personalViews.map((v) => (
              <ViewRow key={v.id} view={v} />
            ))}
          </div>
        )}
      </Section>

      <Section label="Save current view" hint="Pin the current filters and mode.">
        <SaveViewForm onClose={onClose} />
      </Section>
    </div>
  );
}

// ── View row (both shared + personal) ─────────────────────────────────────────

function ViewRow({
  view,
  isDefault,
  hidden,
  onToggleHidden,
}: {
  view: ContactSavedView;
  isDefault?: boolean;
  hidden?: boolean;
  onToggleHidden?: () => void;
}) {
  const router = useRouter();
  const resolved = resolveViewIcon(view);
  const [editing, setEditing] = useState(false);
  const [iconId, setIconId] = useState<string | null>(resolved.iconId);
  const [iconColor, setIconColor] = useState<string>(resolved.iconColor);
  const [name, setName] = useState(view.name);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const iconBtnRef = useRef<HTMLButtonElement>(null);

  function openIconPicker() {
    if (iconBtnRef.current) {
      setPickerAnchor(iconBtnRef.current.getBoundingClientRect());
    }
    setPickerOpen(true);
  }

  function startEdit() {
    const latest = resolveViewIcon(view);
    setName(view.name);
    setIconId(latest.iconId);
    setIconColor(latest.iconColor);
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Name required.'); return; }
    startTransition(async () => {
      const result = await renameSavedView({
        id: view.id,
        name: trimmed,
        iconId: iconId ?? null,
        iconColor: iconId ? iconColor : null,
      });
      if (!result.ok) { setError(result.error); return; }
      setEditing(false);
      router.refresh();
    });
  }

  function onDelete() {
    setDeleteError(null);
    setConfirming(true);
  }

  function onDeleteConfirm() {
    startTransition(async () => {
      const result = await deleteSavedView({ id: view.id });
      if (!result.ok) { setDeleteError(result.error); return; }
      setConfirming(false);
      setDeleteError(null);
      router.refresh();
    });
  }

  function onDeleteCancel() {
    setConfirming(false);
    setDeleteError(null);
  }

  if (editing) {
    return (
      <>
        <div className={styles.viewRowEdit}>
          <form className={styles.viewEditForm} onSubmit={submit}>
            <button
              ref={iconBtnRef}
              type="button"
              className={`${styles.iconPickerBtn} ${iconId ? styles.iconPickerBtnSelected : ''}`}
              onClick={openIconPicker}
              title="Pick an icon"
              style={iconId ? { color: iconColor, borderColor: iconColor } : undefined}
            >
              {iconId ? (
                <ViewIcon iconId={iconId} iconColor={iconColor} size={15} />
              ) : (
                <MagnifyingGlass size={13} />
              )}
            </button>
            <input
              autoFocus
              type="text"
              value={name}
              maxLength={58}
              onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
              onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit(); }}
              className={styles.viewEditInput}
              disabled={pending}
            />
            <button type="submit" className={styles.viewEditSave} disabled={pending || !name.trim()}>
              Save
            </button>
            <button type="button" className={styles.viewEditCancel} onClick={cancelEdit} disabled={pending}>
              Cancel
            </button>
          </form>
          {error ? <span className={styles.viewEditError}>{error}</span> : null}
        </div>
        {pickerOpen && pickerAnchor
          ? createPortal(
              <IconPickerPopover
                anchorRect={pickerAnchor}
                selectedIcon={iconId}
                selectedColor={iconColor}
                onSelect={(id, col) => { setIconId(id); setIconColor(col); setPickerOpen(false); }}
                onRemove={() => { setIconId(null); setPickerOpen(false); }}
                onClose={() => setPickerOpen(false)}
              />,
              document.body,
            )
          : null}
      </>
    );
  }

  if (confirming) {
    return (
      <div className={`${styles.viewRow} ${hidden ? styles.viewRowHidden : ''}`} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary, #6b7280)', flex: 1 }}>
            Delete <strong style={{ color: 'var(--color-text-primary, #111827)' }}>{view.name}</strong>? This cannot be undone.
          </span>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              type="button"
              onClick={onDeleteCancel}
              disabled={pending}
              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--color-border, #e5e7eb)', background: 'transparent', color: 'var(--color-text-secondary, #6b7280)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDeleteConfirm}
              disabled={pending}
              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
            >
              Delete
            </button>
          </div>
        </div>
        {deleteError ? (
          <span style={{ fontSize: 11, color: '#dc2626' }}>{deleteError}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`${styles.viewRow} ${hidden ? styles.viewRowHidden : ''}`}>
      <span className={styles.viewIconSlot} aria-hidden>
        {resolved.iconId ? (
          <ViewIcon
            iconId={resolved.iconId}
            iconColor={resolved.iconColor}
            size={15}
          />
        ) : (
          <span className={styles.viewIconDot} />
        )}
      </span>
      <span className={styles.viewName}>{view.name}</span>
      {view.count !== null ? (
        <span className={styles.viewCount}>{view.count}</span>
      ) : null}
      <div className={styles.viewRowActions}>
        <button
          type="button"
          className={styles.viewActionBtn}
          onClick={startEdit}
          disabled={pending}
          aria-label="Edit"
          title="Edit"
        >
          <Pencil size={12} weight="bold" />
        </button>
        {isDefault ? (
          <VisibilityToggle enabled={!hidden} onChange={onToggleHidden!} />
        ) : (
          <button
            type="button"
            className={`${styles.viewActionBtn} ${styles.viewActionBtnDanger}`}
            onClick={onDelete}
            disabled={pending}
            aria-label="Delete"
            title="Delete"
          >
            <Trash size={12} weight="bold" />
          </button>
        )}
      </div>
    </div>
  );
}

function VisibilityToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      className={`${styles.toggle} ${enabled ? styles.toggleOn : styles.toggleOff}`}
      onClick={onChange}
      title={enabled ? 'Hide tab' : 'Show tab'}
    />
  );
}

// ── Save view form ───────────────────────────────────────────────────────────

function SaveViewForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [name, setName] = useState('');
  const [iconId, setIconId] = useState<string | null>(null);
  const [iconColor, setIconColor] = useState<string>(DEFAULT_ICON_COLOR);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const iconBtnRef = useRef<HTMLButtonElement>(null);

  function openIconPicker() {
    if (iconBtnRef.current) {
      setPickerAnchor(iconBtnRef.current.getBoundingClientRect());
    }
    setPickerOpen(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Give your view a name.'); return; }
    const live = new URLSearchParams(window.location.search);
    const params = {
      view: live.get('view') ?? sp?.get('view') ?? undefined,
      mode: live.get('mode') ?? sp?.get('mode') ?? undefined,
      source: live.get('source') ?? sp?.get('source') ?? undefined,
      assignee: live.get('assignee') ?? sp?.get('assignee') ?? undefined,
      q: live.get('q') ?? sp?.get('q') ?? undefined,
    };
    startTransition(async () => {
      const result = await createSavedView({
        name: name.trim(),
        iconId: iconId ?? null,
        iconColor: iconId ? iconColor : null,
        searchParams: params,
      });
      if (!result.ok) { setError(result.error); return; }
      setName('');
      setIconId(null);
      setIconColor(DEFAULT_ICON_COLOR);
      setError(null);
      const next = new URLSearchParams(window.location.search);
      next.set('view_id', result.data.id);
      router.push(`?${next.toString()}`);
      router.refresh();
      onClose();
    });
  }

  return (
    <>
      <div className={styles.saveViewWrap}>
        <form className={styles.saveViewForm} onSubmit={onSubmit}>
          <button
            ref={iconBtnRef}
            type="button"
            className={`${styles.saveIconBtn} ${iconId ? styles.saveIconBtnSelected : ''}`}
            onClick={openIconPicker}
            aria-label="Choose an icon for this view"
            style={iconId ? { color: iconColor, borderColor: iconColor } : undefined}
          >
            {iconId ? (
              <ViewIcon iconId={iconId} iconColor={iconColor} size={17} />
            ) : (
              <>
                <BookmarkSimple size={14} weight="bold" />
                <span className={styles.saveIconHint}>Icon</span>
              </>
            )}
          </button>
          <input
            type="text"
            value={name}
            maxLength={58}
            placeholder="e.g. Cold 30+ days"
            onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
            className={styles.saveViewInput}
          />
          <button
            type="submit"
            className={styles.saveViewSaveBtn}
            disabled={pending || !name.trim()}
          >
            {pending ? 'Saving\u2026' : 'Save'}
          </button>
        </form>
        {error ? <div className={styles.saveViewError}>{error}</div> : null}
      </div>
      {pickerOpen && pickerAnchor
        ? createPortal(
            <IconPickerPopover
              anchorRect={pickerAnchor}
              selectedIcon={iconId}
              selectedColor={iconColor}
              onSelect={(id, col) => { setIconId(id); setIconColor(col); setPickerOpen(false); }}
              onRemove={() => { setIconId(null); setPickerOpen(false); }}
              onClose={() => setPickerOpen(false)}
            />,
            document.body,
          )
        : null}
    </>
  );
}

// ── Sources tab ───────────────────────────────────────────────────────────────

function SourcesTab({ allSources }: { allSources: ContactSource[] }) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    startTransition(async () => {
      const res = await createContactSource(newLabel.trim());
      if (!res.ok) { setAddError(res.error); return; }
      setNewLabel('');
      setAddError(null);
      router.refresh();
    });
  }

  function handleToggle(source: ContactSource) {
    startTransition(async () => {
      await updateContactSource(source.id, { active: !source.active });
      router.refresh();
    });
  }

  function handleDelete(source: ContactSource) {
    startTransition(async () => {
      const res = await deleteContactSource(source.id);
      if (!res.ok) {
        setDeleteErrors((prev) => ({ ...prev, [source.id]: res.error }));
        return;
      }
      setDeleteErrors((prev) => {
        const next = { ...prev };
        delete next[source.id];
        return next;
      });
      router.refresh();
    });
  }

  return (
    <div className={styles.tabContent}>
      <Section
        label="All sources"
        count={allSources.length}
        hint="Inactive sources stay on records but disappear from filters."
      >
        {allSources.length === 0 ? (
          <p className={styles.emptyNote}>No sources yet. Add one below.</p>
        ) : (
          <div className={styles.sourceManageGrid}>
            {allSources.map((s) => {
              const icon = getSourceIcon(s.slug);
              const { Icon, color, accent } = icon;
              return (
                <div key={s.id} className={`${styles.sourceManageCard} ${!s.active ? styles.sourceManageCardOff : ''}`}>
                  <div className={styles.sourceManageTop}>
                    <span
                      className={styles.sourceManageIcon}
                      style={{ background: accent, color }}
                      aria-hidden
                    >
                      <Icon size={16} weight="fill" />
                    </span>
                    <div className={styles.sourceManageText}>
                      <span className={styles.sourceManageLabel}>{s.label}</span>
                      <span className={styles.sourceManageSlug}>{s.slug}</span>
                    </div>
                    <button
                      type="button"
                      className={`${styles.viewActionBtn} ${styles.viewActionBtnDanger}`}
                      onClick={() => handleDelete(s)}
                      disabled={isPending}
                      aria-label={`Delete ${s.label}`}
                      title="Delete"
                    >
                      <Trash size={12} weight="bold" />
                    </button>
                  </div>
                  <div className={styles.sourceManageBottom}>
                    <button
                      type="button"
                      className={`${styles.activeToggle} ${s.active ? styles.activeOn : styles.activeOff}`}
                      onClick={() => handleToggle(s)}
                      disabled={isPending}
                    >
                      {s.active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                  {deleteErrors[s.id] ? (
                    <div className={styles.rowError}>{deleteErrors[s.id]}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section label="Add source" hint="Give it a short label. Slug auto-generates.">
        <div className={styles.addSourceWrap}>
          <form onSubmit={handleAdd} className={styles.addSourceForm}>
            <input
              type="text"
              className={styles.addSourceInput}
              value={newLabel}
              onChange={(e) => { setNewLabel(e.target.value); setAddError(null); }}
              placeholder="e.g. Cold Outreach"
              disabled={isPending}
            />
            <button
              type="submit"
              className={styles.addSourceBtn}
              disabled={isPending || !newLabel.trim()}
            >
              Add
            </button>
          </form>
          {addError ? <div className={styles.addError}>{addError}</div> : null}
        </div>
      </Section>
    </div>
  );
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

function Section({
  label,
  count,
  hint,
  children,
}: {
  label: string;
  count?: number;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionLabel}>
          {label}
          {count !== undefined && (
            <span className={styles.sectionCount}>{count}</span>
          )}
        </div>
        {hint ? <span className={styles.sectionHint}>{hint}</span> : null}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  );
}

"use client";

import { ArrowSquareOut, Check, Copy, EnvelopeSimple, GearSix, MagnifyingGlass, Phone, User, X } from "@phosphor-icons/react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  WorkspaceGalleryCard,
  WorkspaceGalleryPerson,
  WorkspaceGalleryView,
  WorkspacePersonRelationshipRole,
  WorkspacePersonResponsibilityRole,
} from "@/lib/admin/workspace-gallery";
import { updateWorkspace } from "../[workspaceId]/workspace-actions";
import { updateWorkspacePersonQuickLabels } from "../[workspaceId]/workspace-person-actions";
import { WorkspaceListView } from "./WorkspaceListView";
import styles from "./WorkspaceGallery.module.css";

type WorkspaceDisplayMode = "gallery" | "list";

type Props = {
  cards: WorkspaceGalleryCard[];
  counts: Record<WorkspaceGalleryView, number>;
  activeView: WorkspaceGalleryView;
  displayMode: WorkspaceDisplayMode;
  search: string;
};

type ContactCopyState = {
  key: string;
  state: "copying" | "copied" | "error";
} | null;

const VIEW_LABELS: Record<WorkspaceGalleryView, string> = {
  active: "Active Workspaces",
  offboarding: "Offboarding",
  archived: "Archived",
};

const RELATIONSHIP_OPTIONS: Array<{ value: WorkspacePersonRelationshipRole; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "husband", label: "Husband" },
  { value: "wife", label: "Wife" },
  { value: "family", label: "Family" },
  { value: "partner", label: "Business partner" },
  { value: "advisor", label: "Advisor" },
  { value: "collaborator", label: "Collaborator" },
];

const RESPONSIBILITY_OPTIONS: Array<{ value: WorkspacePersonResponsibilityRole; label: string }> = [
  { value: "primary", label: "Lead contact" },
  { value: "day_to_day", label: "Day to day" },
  { value: "finance", label: "Finance" },
  { value: "accounting", label: "Accounting" },
  { value: "operations", label: "Operations" },
  { value: "legal", label: "Legal" },
  { value: "notices", label: "Notices" },
  { value: "none", label: "No specific duty" },
];

const RELATIONSHIP_LABELS: Record<WorkspacePersonRelationshipRole, string> = {
  owner: "Owner",
  husband: "Husband",
  wife: "Wife",
  family: "Family",
  partner: "Business partner",
  advisor: "Advisor",
  collaborator: "Collaborator",
};

const RESPONSIBILITY_LABELS: Record<WorkspacePersonResponsibilityRole, string> = {
  primary: "Lead contact",
  day_to_day: "Day to day",
  finance: "Finance",
  accounting: "Accounting",
  operations: "Operations",
  legal: "Legal",
  notices: "Notices",
  none: "None",
};

function legalRelationshipLabel(relationshipRole: WorkspacePersonRelationshipRole): string {
  return relationshipRole === "owner" ? "Owner" : "Non-owner";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function viewParam(view: WorkspaceGalleryView): string {
  return view === "active" ? "active" : view;
}

function searchPlaceholder(view: WorkspaceGalleryView): string {
  if (view === "offboarding") return "Search offboarding Workspaces";
  if (view === "archived") return "Search archived Workspaces";
  return "Search active Workspaces";
}

function propertyStatus(property: WorkspaceGalleryCard["properties"][number]): string {
  if (!property.active) return "Inactive";
  if (property.setupStatus !== "completed") return "In setup";
  return "Active";
}

function mediaStyle(url: string): CSSProperties {
  return { backgroundImage: `url(${url})` };
}

function personContactKey(cardId: string, personId: string): string {
  return `${cardId}:${personId}`;
}

function oppositeSpouseRole(person: WorkspaceGalleryPerson): WorkspacePersonRelationshipRole | null {
  if (person.relationshipRole === "husband") return "wife";
  if (person.relationshipRole === "wife") return "husband";
  return null;
}

function spouseForPerson(
  people: WorkspaceGalleryPerson[],
  person: WorkspaceGalleryPerson,
): WorkspaceGalleryPerson | null {
  const spouseRole = oppositeSpouseRole(person);
  if (!spouseRole) return null;
  return people.find((item) => item.id !== person.id && item.relationshipRole === spouseRole) ?? null;
}

function totalLabel(count: number): string {
  return count > 99 ? "99+" : String(count);
}

function matchesSearch(card: WorkspaceGalleryCard, searchTerm: string): boolean {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return true;

  const haystack = [
    card.name,
    card.statusLabel,
    card.nextMeetingAt ?? "",
    String(card.counters.upcomingMeetingCount),
    String(card.counters.unreadMessageCount),
    String(card.counters.taskOpenCount),
    ...card.people.map((person) => `${person.name} ${person.email ?? ""} ${person.phone ?? ""} ${person.roleLabel}`),
    ...card.properties.map((property) => `${property.label} ${property.location}`),
  ].join(" ").toLowerCase();

  return haystack.includes(query);
}

function personRoleLabel(
  relationshipRole: WorkspacePersonRelationshipRole,
  responsibilityRole: WorkspacePersonResponsibilityRole,
  ownershipPercentage: number | null,
): string {
  const relationshipLabel = RELATIONSHIP_LABELS[relationshipRole];
  const ownershipSuffix =
    relationshipRole === "owner" && ownershipPercentage !== null
      ? ` (${formatOwnershipPercent(ownershipPercentage)}%)`
      : "";
  if (responsibilityRole === "none") return `${relationshipLabel}${ownershipSuffix}`;
  return `${relationshipLabel}${ownershipSuffix}, ${RESPONSIBILITY_LABELS[responsibilityRole]}`;
}

function formatOwnershipPercent(value: number | null): string {
  if (value === null) return "";
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(2)));
}

function parseOwnershipDraft(value: string): number | null | undefined {
  const normalized = value.replace(/%/g, "").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed < 0 || parsed > 100) return undefined;
  return parsed;
}

function ownershipDraftKey(cardId: string, personId: string): string {
  return `${cardId}:${personId}:ownership`;
}

function countCards(cards: WorkspaceGalleryCard[]): Record<WorkspaceGalleryView, number> {
  return cards.reduce<Record<WorkspaceGalleryView, number>>(
    (acc, card) => {
      if (card.status === "offboarding") acc.offboarding += 1;
      else if (card.status === "archived") acc.archived += 1;
      else acc.active += 1;
      return acc;
    },
    { active: 0, offboarding: 0, archived: 0 },
  );
}

function isInView(card: WorkspaceGalleryCard, view: WorkspaceGalleryView): boolean {
  if (view === "offboarding") return card.status === "offboarding";
  if (view === "archived") return card.status === "archived";
  return card.status !== "archived" && card.status !== "offboarding";
}

function ContactCopyRow({
  icon,
  label,
  value,
  copyState,
  onCopy,
}: {
  icon: ReactNode;
  label: string;
  value: string | null;
  copyState: ContactCopyState;
  onCopy: () => void;
}) {
  const cleanValue = value?.trim() ?? "";
  const hasValue = cleanValue.length > 0;
  const isCopying = copyState?.state === "copying";
  const isCopied = copyState?.state === "copied";
  const hasCopyError = copyState?.state === "error";

  return (
    <div
      className={`${styles.contactRow} ${isCopied ? styles.contactRowCopied : ""} ${
        hasCopyError ? styles.contactRowError : ""
      }`}
    >
      <span className={styles.contactIcon} aria-hidden>
        {icon}
      </span>
      <span className={styles.contactMeta}>
        <span className={styles.contactLabel}>{label}</span>
        <span className={`${styles.contactValue} ${hasValue ? "" : styles.contactMissing}`}>
          {hasValue ? cleanValue : "Not added"}
        </span>
      </span>
      <button
        type="button"
        className={`${styles.contactCopy} ${isCopying ? styles.contactCopyLoading : ""} ${
          isCopied ? styles.contactCopyDone : ""
        } ${hasCopyError ? styles.contactCopyError : ""}`}
        disabled={!hasValue || isCopying}
        onClick={onCopy}
      >
        {isCopied ? <Check size={13} weight="bold" aria-hidden /> : <Copy size={13} weight="bold" aria-hidden />}
        <span>{isCopying ? "Copying" : hasCopyError ? "Copy failed" : isCopied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // The fallback handles browsers that block the async clipboard API.
    }
  }

  if (typeof document === "undefined") return false;

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "-1000px";
  textArea.style.left = "-1000px";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, textArea.value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}

export function WorkspaceGallery({ cards, counts, activeView, displayMode, search }: Props) {
  const [cardState, setCardState] = useState(cards);
  const [searchTerm, setSearchTerm] = useState(search);
  const [currentView, setCurrentView] = useState(activeView);
  const [currentDisplayMode, setCurrentDisplayMode] = useState(displayMode);
  const [openSettingsId, setOpenSettingsId] = useState<string | null>(null);
  const [openContactKey, setOpenContactKey] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [ownershipDrafts, setOwnershipDrafts] = useState<Record<string, string>>({});
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingNameId, setSavingNameId] = useState<string | null>(null);
  const [savingPersonKey, setSavingPersonKey] = useState<string | null>(null);
  const [contactCopyState, setContactCopyState] = useState<ContactCopyState>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const contactPanelRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const personTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    setCardState(cards);
  }, [cards]);

  useEffect(() => {
    if (!openSettingsId) return;
    const activeSettingsId = openSettingsId;

    function restoreFocus(cardId: string): void {
      requestAnimationFrame(() => {
        triggerRefs.current.get(cardId)?.focus();
      });
    }

    function closePanel(cardId: string): void {
      setOpenSettingsId(null);
      setSettingsError(null);
      restoreFocus(cardId);
    }

    function handlePointerDown(event: PointerEvent): void {
      if (!(event.target instanceof Node)) return;
      const trigger = triggerRefs.current.get(activeSettingsId);
      if (panelRef.current?.contains(event.target) || trigger?.contains(event.target)) return;
      closePanel(activeSettingsId);
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      closePanel(activeSettingsId);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openSettingsId]);

  useEffect(() => {
    if (!openContactKey) return;
    const activeContactKey = openContactKey;

    function restoreFocus(contactKey: string): void {
      requestAnimationFrame(() => {
        personTriggerRefs.current.get(contactKey)?.focus();
      });
    }

    function closeContact(contactKey: string): void {
      setOpenContactKey(null);
      setContactCopyState(null);
      restoreFocus(contactKey);
    }

    function handlePointerDown(event: PointerEvent): void {
      if (!(event.target instanceof Node)) return;
      if (event.target instanceof Element && event.target.closest("[data-person-contact-trigger='true']")) return;
      const trigger = personTriggerRefs.current.get(activeContactKey);
      if (contactPanelRef.current?.contains(event.target) || trigger?.contains(event.target)) return;
      closeContact(activeContactKey);
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      closeContact(activeContactKey);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openContactKey]);

  const filteredCards = useMemo(
    () => cardState.filter((card) => matchesSearch(card, searchTerm)),
    [cardState, searchTerm],
  );
  const liveCounts = useMemo(
    () => (searchTerm.trim() ? countCards(filteredCards) : counts),
    [counts, filteredCards, searchTerm],
  );
  const visibleCards = useMemo(
    () => filteredCards.filter((card) => isInView(card, currentView)),
    [currentView, filteredCards],
  );
  const activeSettingsCard = useMemo(
    () => visibleCards.find((card) => card.id === openSettingsId) ?? null,
    [openSettingsId, visibleCards],
  );

  function replaceUrl(nextView: WorkspaceGalleryView, nextDisplayMode: WorkspaceDisplayMode, nextSearch: string): void {
    const params = new URLSearchParams();
    params.set("view", viewParam(nextView));
    params.set("display", nextDisplayMode);
    if (nextSearch.trim()) params.set("q", nextSearch.trim());
    window.history.replaceState(null, "", `/admin/workspaces?${params.toString()}`);
  }

  function handleViewChange(view: WorkspaceGalleryView): void {
    setCurrentView(view);
    replaceUrl(view, currentDisplayMode, searchTerm);
  }

  function handleDisplayChange(nextDisplayMode: WorkspaceDisplayMode): void {
    setCurrentDisplayMode(nextDisplayMode);
    replaceUrl(currentView, nextDisplayMode, searchTerm);
  }

  function handleSearchChange(nextSearch: string): void {
    setSearchTerm(nextSearch);
    replaceUrl(currentView, currentDisplayMode, nextSearch);
  }

  function closeSettings(cardId: string): void {
    setOpenSettingsId(null);
    setSettingsError(null);
    setOwnershipDrafts({});
    requestAnimationFrame(() => {
      triggerRefs.current.get(cardId)?.focus();
    });
  }

  function toggleSettings(card: WorkspaceGalleryCard): void {
    setOpenContactKey(null);
    setContactCopyState(null);
    if (openSettingsId === card.id) {
      closeSettings(card.id);
      return;
    }

    setOpenSettingsId(card.id);
    setDraftName(card.name);
    setOwnershipDrafts(
      Object.fromEntries(
        card.people.map((person) => [ownershipDraftKey(card.id, person.id), formatOwnershipPercent(person.ownershipPercentage)]),
      ),
    );
    setSettingsError(null);
  }

  function closeContact(contactKey: string): void {
    setOpenContactKey(null);
    setContactCopyState(null);
    requestAnimationFrame(() => {
      personTriggerRefs.current.get(contactKey)?.focus();
    });
  }

  function toggleContact(cardId: string, personId: string): void {
    const key = personContactKey(cardId, personId);
    setOpenSettingsId(null);
    setSettingsError(null);
    setContactCopyState(null);

    if (openContactKey === key) {
      closeContact(key);
      return;
    }

    setOpenContactKey(key);
  }

  async function handleCopyContactValue(copyKey: string, value: string | null): Promise<void> {
    const cleanValue = value?.trim() ?? "";
    if (!cleanValue) return;

    setContactCopyState({ key: copyKey, state: "copying" });

    const copied = await copyTextToClipboard(cleanValue);
    if (copied) {
      setContactCopyState({ key: copyKey, state: "copied" });
      window.setTimeout(() => {
        setContactCopyState((current) => (current?.key === copyKey ? null : current));
      }, 1400);
      return;
    }

    setContactCopyState({ key: copyKey, state: "error" });
    window.setTimeout(() => {
      setContactCopyState((current) => (current?.key === copyKey ? null : current));
    }, 2200);
  }

  async function handleRename(card: WorkspaceGalleryCard): Promise<void> {
    const nextName = draftName.trim();
    if (!nextName) {
      setSettingsError("Workspace name is required.");
      return;
    }

    if (nextName === card.name) {
      closeSettings(card.id);
      return;
    }

    setSavingNameId(card.id);
    setSettingsError(null);

    try {
      const result = await updateWorkspace({ workspaceId: card.id, name: nextName });
      if ("error" in result) {
        setSettingsError(result.error ?? "Workspace name could not be saved.");
        return;
      }

      setCardState((currentCards) =>
        currentCards.map((item) => (item.id === card.id ? { ...item, name: nextName } : item)),
      );
      closeSettings(card.id);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Workspace name could not be saved.");
    } finally {
      setSavingNameId(null);
    }
  }

  async function handlePersonLabelChange(
    card: WorkspaceGalleryCard,
    person: WorkspaceGalleryPerson,
    nextLabels: Partial<Pick<WorkspaceGalleryPerson, "relationshipRole" | "responsibilityRole">>,
  ): Promise<void> {
    const nextRelationshipRole = nextLabels.relationshipRole ?? person.relationshipRole;
    const nextResponsibilityRole = nextLabels.responsibilityRole ?? person.responsibilityRole;
    if (person.relationshipRole === nextRelationshipRole && person.responsibilityRole === nextResponsibilityRole) {
      return;
    }

    const pendingSegment = nextLabels.relationshipRole ? "relationship" : "responsibility";
    const pendingKey = `${card.id}:${person.id}:${pendingSegment}`;
    setSavingPersonKey(pendingKey);
    setSettingsError(null);

    try {
      const result = await updateWorkspacePersonQuickLabels({
        workspaceId: card.id,
        profileId: person.profileId,
        contactId: person.contactId,
        relationshipRole: nextLabels.relationshipRole,
        responsibilityRole: nextLabels.responsibilityRole,
      });

      if (!result.ok) {
        setSettingsError(result.message);
        return;
      }

      setCardState((currentCards) =>
        currentCards.map((item) =>
          item.id === card.id
            ? {
                ...item,
                people: item.people.map((itemPerson) =>
                  itemPerson.id === person.id
                    ? {
                        ...itemPerson,
                        relationshipRole: nextRelationshipRole,
                        responsibilityRole: nextResponsibilityRole,
                        roleLabel: personRoleLabel(
                          nextRelationshipRole,
                          nextResponsibilityRole,
                          itemPerson.ownershipPercentage,
                        ),
                        responsibility: nextResponsibilityRole === "none" ? null : nextResponsibilityRole,
                      }
                    : itemPerson,
                ),
              }
            : item,
        ),
      );
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "People label could not be saved.");
    } finally {
      setSavingPersonKey(null);
    }
  }

  async function handlePersonOwnershipChange(
    card: WorkspaceGalleryCard,
    person: WorkspaceGalleryPerson,
  ): Promise<void> {
    const draft = ownershipDrafts[ownershipDraftKey(card.id, person.id)] ?? "";
    const parsedOwnership = parseOwnershipDraft(draft);

    if (parsedOwnership === undefined) {
      setSettingsError("Ownership share must be a number between 0 and 100.");
      return;
    }

    if (parsedOwnership === person.ownershipPercentage) {
      return;
    }

    const pendingKey = ownershipDraftKey(card.id, person.id);
    setSavingPersonKey(pendingKey);
    setSettingsError(null);

    try {
      const result = await updateWorkspacePersonQuickLabels({
        workspaceId: card.id,
        profileId: person.profileId,
        contactId: person.contactId,
        ownershipPercentage: parsedOwnership,
      });

      if (!result.ok) {
        setSettingsError(result.message);
        return;
      }

      setCardState((currentCards) =>
        currentCards.map((item) =>
          item.id === card.id
            ? {
                ...item,
                people: item.people.map((itemPerson) =>
                  itemPerson.id === person.id
                    ? {
                        ...itemPerson,
                        ownershipPercentage: parsedOwnership,
                        roleLabel: personRoleLabel(
                          itemPerson.relationshipRole,
                          itemPerson.responsibilityRole,
                          parsedOwnership,
                        ),
                      }
                    : itemPerson,
                ),
              }
            : item,
        ),
      );
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Ownership share could not be saved.");
    } finally {
      setSavingPersonKey(null);
    }
  }

  function setOwnershipDraft(personIdKey: string, value: string): void {
    setOwnershipDrafts((current) => ({ ...current, [personIdKey]: value }));
  }

  return (
    <div className={styles.shell}>
      <div className={styles.toolbar}>
        <div className={styles.intro}>
          <h1 className={styles.title}>Workspaces</h1>
        </div>
      </div>

      <div className={styles.controls}>
        <nav className={styles.tabs} aria-label="Workspace views">
          {(Object.keys(VIEW_LABELS) as WorkspaceGalleryView[]).map((view) => (
            <button
              key={view}
              type="button"
              className={`${styles.tab} ${currentView === view ? styles.tabActive : ""}`}
              onClick={() => handleViewChange(view)}
              aria-pressed={currentView === view}
            >
              {VIEW_LABELS[view]}
              <span className={styles.count}>{liveCounts[view]}</span>
            </button>
          ))}
        </nav>

        <form className={styles.search} action="/admin/workspaces" onSubmit={(event) => event.preventDefault()}>
          <input type="hidden" name="view" value={viewParam(currentView)} />
          <input type="hidden" name="display" value={currentDisplayMode} />
          <MagnifyingGlass className={styles.searchIcon} size={17} weight="bold" aria-hidden />
          <input
            className={styles.searchInput}
            type="search"
            name="q"
            value={searchTerm}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder={searchPlaceholder(currentView)}
            aria-label={searchPlaceholder(currentView)}
          />
        </form>

        <nav className={styles.displayToggle} aria-label="Workspace display">
          <button
            type="button"
            className={`${styles.displayButton} ${currentDisplayMode === "gallery" ? styles.displayButtonActive : ""}`}
            onClick={() => handleDisplayChange("gallery")}
            aria-pressed={currentDisplayMode === "gallery"}
          >
            Gallery
          </button>
          <button
            type="button"
            className={`${styles.displayButton} ${currentDisplayMode === "list" ? styles.displayButtonActive : ""}`}
            onClick={() => handleDisplayChange("list")}
            aria-pressed={currentDisplayMode === "list"}
          >
            List
          </button>
        </nav>
      </div>

      {visibleCards.length === 0 ? (
        <div className={styles.empty}>No Workspaces match this view.</div>
      ) : currentDisplayMode === "list" ? (
        <WorkspaceListView cards={visibleCards} />
      ) : (
        <div className={styles.grid}>
          {visibleCards.map((card) => {
            const visiblePeople = card.people.slice(0, 4);
            const visibleProperties = card.properties.slice(0, 2);
            const extraPeople = Math.max(0, card.people.length - visiblePeople.length);
            const extraProperties = Math.max(0, card.propertyCount - visibleProperties.length);
            const isSettingsOpen = openSettingsId === card.id;
            const previewName = isSettingsOpen && draftName.trim() ? draftName : card.name;

            return (
              <article key={card.id} className={styles.card} data-status={card.status}>
                <header className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.workspaceName}>{previewName}</h2>
                    <div className={styles.workspaceMeta}>
                      <span>{card.propertyCount} {card.propertyCount === 1 ? "property" : "properties"}</span>
                      <span>{card.people.length} {card.people.length === 1 ? "person" : "people"}</span>
                    </div>
                  </div>
                  <span className={styles.pillGroup}>
                    {card.isTestWorkspace ? <span className={styles.testBadge}>Test</span> : null}
                    <span className={styles.pill}>{card.statusLabel}</span>
                    <button
                      type="button"
                      className={styles.cardSettings}
                      aria-label={`Quick settings for ${previewName}`}
                      aria-controls={`workspace-quick-settings-${card.id}`}
                      aria-expanded={isSettingsOpen}
                      aria-haspopup="dialog"
                      onClick={() => toggleSettings(card)}
                      ref={(node) => {
                        if (node) triggerRefs.current.set(card.id, node);
                        else triggerRefs.current.delete(card.id);
                      }}
                    >
                      <GearSix size={17} weight="regular" />
                    </button>
                  </span>
                </header>

                <section>
                  <p className={styles.sectionLabel}>People</p>
                  <div className={styles.peopleRow}>
                    {visiblePeople.map((person) => {
                      const contactKey = personContactKey(card.id, person.id);
                      const isContactOpen = openContactKey === contactKey;
                      const nameCopyKey = `${contactKey}:name`;
                      const emailCopyKey = `${contactKey}:email`;
                      const phoneCopyKey = `${contactKey}:phone`;

                      return (
                        <div key={person.id} className={styles.personShell}>
                          <button
                            type="button"
                            className={styles.person}
                            aria-label={`Open contact options for ${person.name}`}
                            aria-controls={`workspace-person-contact-${card.id}-${person.id}`}
                            aria-expanded={isContactOpen}
                            data-person-contact-trigger="true"
                            onClick={() => toggleContact(card.id, person.id)}
                            ref={(node) => {
                              if (node) personTriggerRefs.current.set(contactKey, node);
                              else personTriggerRefs.current.delete(contactKey);
                            }}
                          >
                            {person.avatarUrl ? (
                              <span
                                className={styles.avatar}
                                role="img"
                                aria-label={person.name}
                                style={mediaStyle(person.avatarUrl)}
                              />
                            ) : (
                              <span className={styles.avatarInitials} aria-hidden>{initials(person.name)}</span>
                            )}
                            <span className={styles.personText}>
                              <span className={styles.personName}>{person.name}</span>
                              <span className={styles.personRole}>{person.roleLabel}</span>
                            </span>
                          </button>

                          {isContactOpen ? (
                            <div
                              ref={contactPanelRef}
                              id={`workspace-person-contact-${card.id}-${person.id}`}
                              className={styles.contactCard}
                              role="dialog"
                              aria-label={`${person.name} contact details`}
                            >
                              <div className={styles.contactHeader}>
                                {person.avatarUrl ? (
                                  <span
                                    className={styles.contactAvatar}
                                    role="img"
                                    aria-label={person.name}
                                    style={mediaStyle(person.avatarUrl)}
                                  />
                                ) : (
                                  <span className={styles.contactInitials} aria-hidden>
                                    {initials(person.name)}
                                  </span>
                                )}
                                <span className={styles.contactTitleBlock}>
                                  <span className={styles.contactTitle}>{person.name}</span>
                                  <span className={styles.contactRole}>{person.roleLabel}</span>
                                </span>
                                <button
                                  type="button"
                                  className={styles.contactClose}
                                  aria-label={`Close ${person.name} contact details`}
                                  onClick={() => closeContact(contactKey)}
                                >
                                  <X size={14} weight="bold" />
                                </button>
                              </div>

                              <div className={styles.contactRows}>
                                <ContactCopyRow
                                  icon={<User size={15} weight="bold" />}
                                  label="Name"
                                  value={person.name}
                                  copyState={contactCopyState?.key === nameCopyKey ? contactCopyState : null}
                                  onCopy={() => void handleCopyContactValue(nameCopyKey, person.name)}
                                />
                                <ContactCopyRow
                                  icon={<EnvelopeSimple size={15} weight="bold" />}
                                  label="Email"
                                  value={person.email}
                                  copyState={contactCopyState?.key === emailCopyKey ? contactCopyState : null}
                                  onCopy={() => void handleCopyContactValue(emailCopyKey, person.email)}
                                />
                                <ContactCopyRow
                                  icon={<Phone size={15} weight="bold" />}
                                  label="Phone"
                                  value={person.phone}
                                  copyState={contactCopyState?.key === phoneCopyKey ? contactCopyState : null}
                                  onCopy={() => void handleCopyContactValue(phoneCopyKey, person.phone)}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {extraPeople > 0 ? <span className={styles.morePeople}>+{extraPeople}</span> : null}
                  </div>
                </section>

                <section>
                  <p className={styles.sectionLabel}>Properties</p>
                  {visibleProperties.length > 0 ? (
                    <div className={styles.propertyGrid}>
                      {visibleProperties.map((property) => (
                        <div key={property.id} className={styles.property} title={property.label}>
                          <div className={styles.propertyImage}>
                            {property.coverPhotoUrl ? (
                              <span className={styles.propertyPhoto} aria-hidden style={mediaStyle(property.coverPhotoUrl)} />
                            ) : null}
                          </div>
                          <div className={styles.propertyBody}>
                            <p className={styles.propertyName}>{property.displayAddressLine1 || property.label}</p>
                            {property.displayAddressLine2 ? (
                              <span className={styles.propertyUnit}>{property.displayAddressLine2}</span>
                            ) : null}
                            <p className={styles.propertyLocation}>
                              {property.displayLocation || property.location || propertyStatus(property)}
                              {extraProperties > 0 && property === visibleProperties[visibleProperties.length - 1]
                                ? `  + ${extraProperties} more`
                                : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyProperties}>No properties linked yet</div>
                  )}
                </section>

                <section className={styles.context} aria-label={`${card.name} workspace attention`}>
                  <span className={`${styles.attentionItem} ${card.counters.upcomingMeetingCount > 0 ? styles.attentionItemHot : ""}`}>
                    <span className={styles.attentionValue}>{totalLabel(card.counters.upcomingMeetingCount)}</span>
                    <span className={styles.attentionLabel}>Upcoming</span>
                  </span>
                  <span className={`${styles.attentionItem} ${card.counters.unreadMessageCount > 0 ? styles.attentionItemHot : ""}`}>
                    <span className={styles.attentionValue}>{totalLabel(card.counters.unreadMessageCount)}</span>
                    <span className={styles.attentionLabel}>Messages</span>
                  </span>
                  <span className={`${styles.attentionItem} ${card.counters.taskOpenCount > 0 ? styles.attentionItemHot : ""}`}>
                    <span className={styles.attentionValue}>{totalLabel(card.counters.taskOpenCount)}</span>
                    <span className={styles.attentionLabel}>Tasks</span>
                  </span>
                </section>

                <footer className={styles.footer}>
                  <Link href={`/admin/workspaces/${card.id}`} className={styles.openAction}>
                    Open Workspace
                  </Link>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {activeSettingsCard ? (
        <>
          <div
            className={styles.quickSettingsBackdrop}
            role="presentation"
            aria-hidden="true"
            onClick={() => closeSettings(activeSettingsCard.id)}
          />
          <div
            ref={panelRef}
            id={`workspace-quick-settings-${activeSettingsCard.id}`}
            className={styles.quickSettings}
            role="dialog"
            aria-modal="true"
            aria-label={`${activeSettingsCard.name} quick settings`}
          >
            <div className={styles.quickSettingsHeader}>
              <div>
                <p className={styles.quickSettingsEyebrow}>Quick settings</p>
                <h3 className={styles.quickSettingsTitle}>{activeSettingsCard.name}</h3>
              </div>
              <button
                type="button"
                className={styles.quickClose}
                aria-label="Close quick settings"
                onClick={() => closeSettings(activeSettingsCard.id)}
              >
                <X size={15} weight="bold" />
              </button>
            </div>

            <form
              className={styles.quickNameForm}
              onSubmit={(event) => {
                event.preventDefault();
                void handleRename(activeSettingsCard);
              }}
            >
              <label className={styles.quickLabel} htmlFor={`workspace-name-${activeSettingsCard.id}`}>
                Workspace name
              </label>
              <div className={styles.quickNameRow}>
                <input
                  id={`workspace-name-${activeSettingsCard.id}`}
                  className={styles.quickNameInput}
                  value={draftName}
                  onChange={(event) => {
                    setDraftName(event.target.value);
                    if (settingsError === "Workspace name is required.") setSettingsError(null);
                  }}
                  aria-invalid={settingsError === "Workspace name is required."}
                />
                <button
                  type="submit"
                  className={styles.quickSave}
                  disabled={savingNameId === activeSettingsCard.id}
                >
                  {savingNameId === activeSettingsCard.id ? "Saving" : "Save"}
                </button>
              </div>
            </form>

            {settingsError ? (
              <p className={styles.quickError} role="alert">
                {settingsError}
              </p>
            ) : null}

            <div className={styles.quickPeople}>
              <p className={styles.quickLabel}>People context</p>
              {activeSettingsCard.people.map((person) => {
                const spouse = spouseForPerson(activeSettingsCard.people, person);
                const relationshipPendingKey = `${activeSettingsCard.id}:${person.id}:relationship`;
                const responsibilityPendingKey = `${activeSettingsCard.id}:${person.id}:responsibility`;
                const legalRole = legalRelationshipLabel(person.relationshipRole);

                return (
                  <div key={person.id} className={styles.quickPerson}>
                    <div className={styles.quickPersonSummary}>
                      {person.avatarUrl ? (
                        <span
                          className={styles.quickAvatar}
                          role="img"
                          aria-label={person.name}
                          style={mediaStyle(person.avatarUrl)}
                        />
                      ) : (
                        <span className={styles.quickInitials} aria-hidden>
                          {initials(person.name)}
                        </span>
                      )}
                      <span>
                        <span className={styles.quickPersonName}>{person.name}</span>
                        <span className={styles.quickPersonStatusLine}>Legal: {legalRole}</span>
                        <span className={styles.quickPersonStatusLine}>
                          Handles: {RESPONSIBILITY_LABELS[person.responsibilityRole]}
                        </span>
                          {spouse ? <span className={styles.quickPersonStatusLine}>Spouse: {spouse.name}</span> : null}
                          {person.ownershipPercentage !== null ? (
                            <span className={styles.quickPersonStatusLine}>
                              Ownership: {formatOwnershipPercent(person.ownershipPercentage)}%
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className={styles.quickRoleSection}>
                      <span className={styles.quickRoleCaption}>Who they are</span>
                      <div className={styles.quickRoleGrid} aria-label={`${person.name} relationship`}>
                        {RELATIONSHIP_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`${styles.quickRoleButton} ${
                              person.relationshipRole === option.value ? styles.quickRoleButtonActive : ""
                            }`}
                            aria-pressed={person.relationshipRole === option.value}
                            disabled={savingPersonKey === relationshipPendingKey}
                            onClick={() =>
                              void handlePersonLabelChange(activeSettingsCard, person, { relationshipRole: option.value })
                            }
                          >
                            {savingPersonKey === relationshipPendingKey && person.relationshipRole !== option.value ? (
                              <span className={styles.savingDot} aria-hidden />
                            ) : null}
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                      <div className={styles.quickRoleSection}>
                        <span className={styles.quickRoleCaption}>What they handle</span>
                      <div className={styles.quickRoleGrid} aria-label={`${person.name} responsibility`}>
                        {RESPONSIBILITY_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`${styles.quickRoleButton} ${
                              person.responsibilityRole === option.value ? styles.quickRoleButtonActive : ""
                            }`}
                            aria-pressed={person.responsibilityRole === option.value}
                            disabled={savingPersonKey === responsibilityPendingKey}
                            onClick={() =>
                              void handlePersonLabelChange(activeSettingsCard, person, {
                                responsibilityRole: option.value,
                              })
                            }
                          >
                            {savingPersonKey === responsibilityPendingKey && person.responsibilityRole !== option.value ? (
                              <span className={styles.savingDot} aria-hidden />
                            ) : null}
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={styles.quickRoleSection}>
                      <span className={styles.quickRoleCaption}>Ownership share</span>
                      <div className={styles.quickOwnershipRow}>
                        <label className={styles.quickOwnershipLabel} htmlFor={`ownership-${activeSettingsCard.id}-${person.id}`}>
                          % owned
                        </label>
                        <input
                          id={`ownership-${activeSettingsCard.id}-${person.id}`}
                          className={styles.quickOwnershipInput}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="100"
                          step="0.01"
                          value={ownershipDrafts[ownershipDraftKey(activeSettingsCard.id, person.id)] ?? ""}
                          onChange={(event) =>
                            setOwnershipDraft(
                              ownershipDraftKey(activeSettingsCard.id, person.id),
                              event.target.value,
                            )
                          }
                          onBlur={() => void handlePersonOwnershipChange(activeSettingsCard, person)}
                        />
                        <button
                          type="button"
                          className={styles.quickSaveCompact}
                          onClick={() => void handlePersonOwnershipChange(activeSettingsCard, person)}
                          disabled={
                            savingPersonKey === ownershipDraftKey(activeSettingsCard.id, person.id) ||
                            parseOwnershipDraft(ownershipDrafts[ownershipDraftKey(activeSettingsCard.id, person.id)] ?? "") ===
                              person.ownershipPercentage
                          }
                        >
                          {savingPersonKey === ownershipDraftKey(activeSettingsCard.id, person.id) ? "Saving" : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.quickActions}>
              <Link href={`/admin/workspaces/${activeSettingsCard.id}`} className={styles.quickPrimaryLink}>
                Workspace
                <ArrowSquareOut size={14} weight="bold" aria-hidden />
              </Link>
              <Link
                href={`/admin/workspaces/${activeSettingsCard.id}?tab=settings&section=business`}
                className={styles.quickLink}
              >
                Settings
                <GearSix size={14} weight="bold" aria-hidden />
              </Link>
              <button
                type="button"
                className={styles.quickCancelDanger}
                onClick={() => closeSettings(activeSettingsCard.id)}
              >
                Cancel
                <X size={14} weight="bold" aria-hidden />
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

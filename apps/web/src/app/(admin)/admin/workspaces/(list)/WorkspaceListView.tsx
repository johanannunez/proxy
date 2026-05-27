'use client';

import Link from 'next/link';
import { Check, CopySimple, EnvelopeSimple, House, Phone, UserCircle, X } from '@phosphor-icons/react';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import type { WorkspaceGalleryCard, WorkspaceGalleryPerson, WorkspaceGalleryStatus } from '@/lib/admin/workspace-gallery';
import styles from './WorkspaceListView.module.css';

type Props = {
  cards: WorkspaceGalleryCard[];
};

type HealthTone = 'healthy' | 'attention' | 'risk';
type OwnerCopyField = 'name' | 'email' | 'phone';

type CopiedFieldState = {
  key: string;
  state: 'copying' | 'copied' | 'error';
} | null;

const HEALTH_LABEL: Record<HealthTone, string> = {
  healthy: 'Healthy',
  attention: 'Needs attention',
  risk: 'At risk',
};

function mediaStyle(url: string): CSSProperties {
  return { backgroundImage: `url(${url})` };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return null;
  return Math.max(0, Math.floor(diff / 86400_000));
}

function relativeTime(iso: string | null): string {
  const days = daysSince(iso);
  if (days === null) return 'No activity';
  if (days < 1) return 'Today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 month' : `${months} months`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year' : `${years} years`;
}

function healthFor(status: WorkspaceGalleryStatus, lastActivityAt: string | null): HealthTone {
  if (status === 'offboarding' || status === 'archived') return 'risk';
  if (status === 'attention') return 'attention';

  const days = daysSince(lastActivityAt);
  if (days === null || days > 30) return 'risk';
  if (days > 7) return 'attention';
  return 'healthy';
}

function healthReasonFor(card: WorkspaceGalleryCard): string {
  if (card.status === 'offboarding') return 'Workspace is currently in offboarding.';
  if (card.status === 'archived') return 'Workspace is archived.';
  if (card.status === 'attention') {
    if (card.openTaskCount > 0) {
      return `${card.openTaskCount} open ${card.openTaskCount === 1 ? 'task needs' : 'tasks need'} attention.`;
    }
    return 'This workspace needs follow up attention.';
  }

  const days = daysSince(card.lastActivityAt);
  if (days === null) return 'No recent owner activity is on file.';
  if (days > 30) return `Last owner activity was ${relativeTime(card.lastActivityAt).toLowerCase()} ago.`;
  if (days > 7) return `Last owner activity was ${relativeTime(card.lastActivityAt).toLowerCase()} ago.`;
  return 'Owner activity is current within the last week.';
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to the legacy copy path.
    }
  }

  if (typeof document === 'undefined') return false;

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.top = '-1000px';
  textArea.style.left = '-1000px';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, textArea.value.length);

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}

function ownerContactKey(cardId: string, personId: string): string {
  return `${cardId}:${personId}`;
}

export function WorkspaceListView({ cards }: Props) {
  const [openOwnerKey, setOpenOwnerKey] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<CopiedFieldState>(null);
  const contactPanelRef = useRef<HTMLSpanElement | null>(null);
  const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (!openOwnerKey) return;
    const activeContactKey = openOwnerKey;

    function restoreFocus(contactKey: string): void {
      requestAnimationFrame(() => {
        triggerRefs.current.get(contactKey)?.focus();
      });
    }

    function closeContact(contactKey: string): void {
      setOpenOwnerKey(null);
      setCopiedField(null);
      restoreFocus(contactKey);
    }

    function handlePointerDown(event: PointerEvent): void {
      if (!(event.target instanceof Node)) return;
      if (event.target instanceof Element && event.target.closest('[data-owner-contact-trigger="true"]')) return;
      const trigger = triggerRefs.current.get(activeContactKey);
      if (contactPanelRef.current?.contains(event.target) || trigger?.contains(event.target)) return;
      closeContact(activeContactKey);
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      closeContact(activeContactKey);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openOwnerKey]);

  function toggleOwner(cardId: string, ownerId: string) {
    const nextKey = ownerContactKey(cardId, ownerId);
    setCopiedField(null);
    setOpenOwnerKey((current) => (current === nextKey ? null : nextKey));
  }

  async function handleCopyField(copyKey: string, value: string | null) {
    const cleanValue = value?.trim() ?? '';
    if (!cleanValue) return;

    setCopiedField({ key: copyKey, state: 'copying' });

    const copied = await copyTextToClipboard(cleanValue);
    if (copied) {
      setCopiedField({ key: copyKey, state: 'copied' });
      window.setTimeout(() => {
        setCopiedField((current) => (current?.key === copyKey ? null : current));
      }, 1400);
      return;
    }

    setCopiedField({ key: copyKey, state: 'error' });
    window.setTimeout(() => {
      setCopiedField((current) => (current?.key === copyKey ? null : current));
    }, 2200);
  }

  function renderOwnerAvatar(person: WorkspaceGalleryPerson, className: string, fallbackClassName: string) {
    if (person.avatarUrl) {
      return <span className={className} aria-hidden style={mediaStyle(person.avatarUrl)} />;
    }
    return <span className={fallbackClassName} aria-hidden>{initials(person.name)}</span>;
  }

  function renderOwnerPopoverField(
    person: WorkspaceGalleryPerson,
    field: OwnerCopyField,
    label: string,
    value: string | null,
    icon: ReactNode,
    cardId: string,
  ) {
    const copyKey = `${ownerContactKey(cardId, person.id)}:${field}`;
    const copyState = copiedField?.key === copyKey ? copiedField.state : null;
    const hasValue = Boolean(value?.trim());

    return (
      <button
        type="button"
        className={styles.ownerPopoverField}
        data-copied={copyState === 'copied' ? 'true' : undefined}
        data-error={copyState === 'error' ? 'true' : undefined}
        disabled={!hasValue || copyState === 'copying'}
        onClick={() => void handleCopyField(copyKey, value)}
        aria-label={hasValue ? `Copy ${label.toLowerCase()} for ${person.name}` : `${label} not added for ${person.name}`}
      >
        {icon}
        <span>
          <span className={styles.ownerPopoverLabel}>{label}</span>
          <span className={styles.ownerPopoverValue}>{value ?? 'Not added'}</span>
        </span>
        <span className={styles.ownerPopoverCopyIndicator} aria-hidden>
          {copyState === 'copied' ? (
            <Check size={15} weight="bold" />
          ) : hasValue ? (
            <CopySimple size={15} weight="bold" />
          ) : null}
        </span>
      </button>
    );
  }

  return (
    <div className={styles.tableShell}>
      <div className={styles.headerRow} role="row">
        <span>Workspace</span>
        <span>Owners</span>
        <span>Properties</span>
        <span>Status</span>
      </div>

      {cards.map((card) => {
        const health = healthFor(card.status, card.lastActivityAt);
        const healthReason = healthReasonFor(card);
        const visibleOwners = card.people.slice(0, 2);
        const visibleProperties = card.properties.slice(0, 2);

        return (
          <article key={card.id} className={styles.row} data-health={health}>
            <span className={styles.workspaceCell}>
              <span className={styles.avatarWrap}>
                {card.people[0]
                  ? renderOwnerAvatar(card.people[0], styles.avatarImage, styles.avatarFallback)
                  : <span className={styles.avatarFallback} aria-hidden>{initials(card.name)}</span>}
              </span>
              <span className={styles.identity}>
                <span className={styles.healthWrap}>
                  <span
                    className={styles.healthBadge}
                    data-health={health}
                    tabIndex={0}
                    aria-label={`${HEALTH_LABEL[health]}: ${healthReason}`}
                  >
                    {HEALTH_LABEL[health]}
                  </span>
                  <span className={styles.healthTooltip} role="tooltip">{healthReason}</span>
                </span>
                <Link href={`/admin/workspaces/${card.id}`} className={styles.workspaceNameLink}>
                  {card.name}
                </Link>
                <span className={styles.company}>
                  {card.people.length} {card.people.length === 1 ? 'owner' : 'owners'} in this workspace
                </span>
              </span>
            </span>

            <span className={styles.ownersCell}>
              <span className={styles.ownerCards}>
                {visibleOwners.map((person) => {
                  const contactKey = ownerContactKey(card.id, person.id);
                  const isOpen = openOwnerKey === contactKey;

                  return (
                    <span key={person.id} className={styles.ownerContactShell}>
                      <button
                        type="button"
                        className={styles.ownerContactTrigger}
                        onClick={() => toggleOwner(card.id, person.id)}
                        aria-expanded={isOpen}
                        aria-label={`Open ${person.name} contact`}
                        data-owner-contact-trigger="true"
                        ref={(node) => {
                          if (node) triggerRefs.current.set(contactKey, node);
                          else triggerRefs.current.delete(contactKey);
                        }}
                      >
                        <span className={styles.ownerContactAvatar}>
                          {renderOwnerAvatar(person, styles.ownerAvatarImage, styles.ownerAvatarFallback)}
                        </span>
                        <span className={styles.ownerContactText}>
                          <span className={styles.ownerContactName}>{person.name}</span>
                        </span>
                      </button>

                      {isOpen ? (
                        <span
                          ref={contactPanelRef}
                          className={styles.ownerPopover}
                          role="dialog"
                          aria-label={`${person.name} contact details`}
                        >
                          <span className={styles.ownerPopoverHeader}>
                            <span className={styles.ownerPopoverAvatar}>
                              {renderOwnerAvatar(person, styles.ownerAvatarImage, styles.ownerAvatarFallback)}
                            </span>
                            <span className={styles.ownerPopoverIdentity}>
                              <span className={styles.ownerPopoverName}>{person.name}</span>
                              <span className={styles.ownerPopoverMeta}>{person.roleLabel}</span>
                            </span>
                            <button
                              type="button"
                              className={styles.ownerPopoverClose}
                              onClick={() => setOpenOwnerKey(null)}
                              aria-label={`Close ${person.name} contact details`}
                            >
                              <X size={14} weight="bold" aria-hidden />
                            </button>
                          </span>

                          <span className={styles.ownerPopoverFields}>
                            {renderOwnerPopoverField(person, 'name', 'Name', person.name, <UserCircle size={15} weight="duotone" aria-hidden />, card.id)}
                            {renderOwnerPopoverField(person, 'email', 'Email', person.email, <EnvelopeSimple size={15} weight="duotone" aria-hidden />, card.id)}
                            {renderOwnerPopoverField(person, 'phone', 'Phone', person.phone, <Phone size={15} weight="duotone" aria-hidden />, card.id)}
                          </span>
                        </span>
                      ) : null}
                    </span>
                  );
                })}

                {card.people.length > visibleOwners.length ? (
                  <span className={styles.moreOwners}>+{card.people.length - visibleOwners.length} more owners</span>
                ) : null}
              </span>
            </span>

            <span className={styles.propertiesCell}>
              <span className={styles.propertyCount}>
                {card.propertyCount} {card.propertyCount === 1 ? 'property' : 'properties'}
              </span>
              {visibleProperties.length > 0 ? (
                <span className={styles.propertyLinks}>
                  {visibleProperties.map((property) => (
                    <span key={property.id} className={styles.propertyRow}>
                      <Link href={`/admin/properties/${property.id}`} className={styles.propertyLink}>
                        {property.coverPhotoUrl ? (
                          <span className={styles.propertyThumb} aria-hidden style={mediaStyle(property.coverPhotoUrl)} />
                        ) : (
                          <span className={styles.propertyThumbEmpty} aria-hidden>
                            <House size={13} weight="duotone" />
                          </span>
                        )}
                        <span>
                          <span className={styles.propertyPrimary}>{property.label}</span>
                        </span>
                      </Link>
                      <button
                        type="button"
                        className={styles.propertyCopyButton}
                        data-copied={copiedField?.key === `property:${property.id}` && copiedField.state === 'copied' ? 'true' : undefined}
                        data-error={copiedField?.key === `property:${property.id}` && copiedField.state === 'error' ? 'true' : undefined}
                        onClick={() => void handleCopyField(`property:${property.id}`, property.label)}
                        aria-label={`Copy address for ${property.label}`}
                      >
                        {copiedField?.key === `property:${property.id}` && copiedField.state === 'copied' ? (
                          <Check size={14} weight="bold" aria-hidden />
                        ) : (
                          <CopySimple size={14} weight="bold" aria-hidden />
                        )}
                        <span className={styles.propertyCopyLabel}>
                          {copiedField?.key === `property:${property.id}` && copiedField.state === 'copied' ? 'Copied' : 'Copy'}
                        </span>
                      </button>
                    </span>
                  ))}
                  {card.propertyCount > visibleProperties.length ? (
                    <span className={styles.moreProperties}>
                      +{card.propertyCount - visibleProperties.length} more properties
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className={styles.noProperties}>No properties linked</span>
              )}
            </span>

            <span className={styles.statusCell}>
              <span className={styles.stagePill} data-status={card.status}>{card.statusLabel}</span>
              <span className={styles.statusMetaLine}>{relativeTime(card.lastActivityAt)}</span>
            </span>
          </article>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarBlank,
  ChatCircleDots,
  CheckCircle,
  EnvelopeSimple,
  Globe,
  InstagramLogo,
  LinkedinLogo,
  MapPin,
  Phone,
  Sparkle,
  Star,
  Trash,
  Translate,
  User,
  UserPlus,
  UsersThree,
  X as XIcon,
  XCircle,
} from "@phosphor-icons/react";
import ConfirmModal from "@/components/admin/ConfirmModal";
import type { ProxyTeamMember, WorkspaceMember } from "@/lib/admin/workspace-contact-detail";
import {
  addPersonToWorkspace,
  removePersonFromWorkspace,
} from "./workspace-person-actions";
import styles from "./WorkspaceTeamTab.module.css";

type Props = {
  workspaceId: string;
  members: WorkspaceMember[];
  activeContactId: string;
  proxyTeam: ProxyTeamMember[];
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatPhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  const normalized = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;
  if (normalized.length !== 10) return raw;
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

function formatMemberSince(value: string): string {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function isJohananProxyLead(member: ProxyTeamMember): boolean {
  const normalizedName = member.name.trim().toLowerCase();
  return normalizedName === "johanan nunez";
}

function Avatar({
  src,
  name,
  size = 44,
  tone = "neutral",
}: {
  src: string | null;
  name: string;
  size?: number;
  tone?: "neutral" | "brand";
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className={styles.avatarImage}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={tone === "brand" ? styles.avatarFallbackBrand : styles.avatarFallback}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className={styles.sectionTitleRow}>
      <span className={styles.sectionTitle}>{title}</span>
      <span className={styles.sectionCount}>{count}</span>
      <span className={styles.sectionLine} aria-hidden="true" />
    </div>
  );
}

function OwnerCard({
  member,
  isActive,
  canRemove,
  onOpen,
  onRemove,
}: {
  member: WorkspaceMember;
  isActive: boolean;
  canRemove: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const contactLine = member.email ?? formatPhone(member.phone);

  return (
    <article className={`${styles.personCard} ${isActive ? styles.personCardActive : ""}`}>
      <button type="button" className={styles.cardMain} data-testid="owner-team-card" onClick={onOpen}>
        <Avatar src={member.avatarUrl} name={member.fullName} size={58} tone="neutral" />
        <span className={styles.cardText}>
          <span className={styles.cardTagRow}>
            {isActive ? <span className={styles.viewingBadge}>Viewing</span> : null}
            <span className={member.portalAccess ? styles.portalBadgeActive : styles.portalBadgeMuted}>
              {member.portalAccess ? (
                <>
                  <CheckCircle size={13} weight="fill" />
                  Workspace access
                </>
              ) : (
                <>
                  <XCircle size={13} weight="regular" />
                  No portal access
                </>
              )}
            </span>
          </span>
          <span className={styles.cardTitle}>{member.fullName}</span>
          <span className={styles.rolePill}>{member.roleLabel}</span>
          {contactLine ? (
            <span className={styles.cardLocationLine}>
              {member.email ? <EnvelopeSimple size={13} weight="bold" /> : <Phone size={13} weight="bold" />}
              {contactLine}
            </span>
          ) : null}
        </span>
      </button>
      {canRemove ? (
        <button
          type="button"
          className={styles.removeButton}
          onClick={onRemove}
          aria-label={`Remove ${member.fullName}`}
        >
          <Trash size={15} weight="bold" />
        </button>
      ) : null}
    </article>
  );
}

function ProxyCard({
  member,
  onOpen,
}: {
  member: ProxyTeamMember;
  onOpen: () => void;
}) {
  const companyName = member.company_name?.trim();
  const showJohananActions = isJohananProxyLead(member);
  const topTag = member.founding_member ? (
    <span className={styles.foundingBadge}>
      <Sparkle size={11} weight="fill" />
      Founding team
    </span>
  ) : (
    <span className={styles.proxyRolePill}>{member.role}</span>
  );
  const secondaryLine = companyName || (member.founding_member ? member.role : null);

  return (
    <article className={styles.proxyCardShell}>
      <button
        type="button"
        className={styles.proxyCard}
        data-testid="proxy-team-card"
        data-member-name={member.name}
        onClick={onOpen}
      >
        <Avatar src={member.avatar_url} name={member.name} size={64} tone="brand" />
        <span className={styles.cardText}>
          <span className={styles.cardTagRow}>{topTag}</span>
          <span className={styles.cardTitle}>{member.name}</span>
          {secondaryLine ? <span className={styles.cardCompany}>{secondaryLine}</span> : null}
          {member.location ? (
            <span className={styles.cardLocationLine}>
              <MapPin size={13} weight="bold" />
              {member.location}
            </span>
          ) : null}
          {showJohananActions && member.email ? (
            <span className={styles.cardLocationLine}>
              <EnvelopeSimple size={13} weight="bold" />
              {member.email}
            </span>
          ) : null}
        </span>
      </button>
      {showJohananActions ? (
        <div className={styles.cardActionRow}>
          <a className={styles.cardActionLink} href="/workspace/inbox">
            <ChatCircleDots size={14} weight="bold" />
            Message in portal
          </a>
          {member.email ? (
            <a className={styles.cardActionLinkMuted} href={`mailto:${member.email}`}>
              <EnvelopeSimple size={14} weight="bold" />
              Email
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function DrawerLink({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <a className={styles.drawerLink} href={href}>
      <span className={styles.drawerLinkIcon}>{icon}</span>
      <span>{label}</span>
    </a>
  );
}

function DrawerTagRow({
  icon,
  label,
  tags,
}: {
  icon: React.ReactNode;
  label: string;
  tags: string[];
}) {
  return (
    <div className={styles.drawerDetailRow}>
      <span className={styles.drawerDetailIcon}>{icon}</span>
      <span className={styles.drawerDetailText}>
        <span className={styles.drawerDetailLabel}>{label}</span>
        <span className={styles.tagRow}>
          {tags.map((tag) => (
            <span key={tag} className={styles.detailTag}>{tag}</span>
          ))}
        </span>
      </span>
    </div>
  );
}

function ProxyTeamDrawer({
  member,
  onClose,
}: {
  member: ProxyTeamMember;
  onClose: () => void;
}) {
  const companyName = member.company_name?.trim();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.drawerLayer}>
      <button
        type="button"
        className={styles.drawerBackdrop}
        onClick={onClose}
        aria-label="Close team member"
      />
      <section
        className={styles.proxyDrawer}
        role="dialog"
        aria-modal="true"
        aria-label="Team member"
        data-testid="proxy-team-drawer"
      >
        <div className={styles.drawerTopBar}>
          <span className={styles.drawerKicker}>Team member</span>
          <button type="button" className={styles.drawerClose} onClick={onClose} aria-label="Close team member">
            <XIcon size={18} weight="bold" />
          </button>
        </div>
        <div className={styles.proxyHero}>
          <Avatar src={member.avatar_url} name={member.name} size={60} tone="brand" />
          <span className={styles.proxyHeroText}>
            <span className={styles.proxyHeroRole}>{member.role}</span>
            <span className={styles.proxyHeroName}>{member.name}</span>
            {companyName ? <span className={styles.proxyHeroCompany}>{companyName}</span> : null}
            {member.location ? (
              <span className={styles.proxyHeroLocation}>
                <MapPin size={12} weight="bold" />
                {member.location}
              </span>
            ) : null}
          </span>
        </div>
        <div className={styles.drawerContent}>
          {member.bio ? <p className={styles.drawerBio}>{member.bio}</p> : null}
          <div className={styles.drawerLinkGroup}>
            {member.email ? (
              <DrawerLink icon={<EnvelopeSimple size={15} weight="bold" />} label={member.email} href={`mailto:${member.email}`} />
            ) : null}
            {member.phone ? (
              <DrawerLink icon={<Phone size={15} weight="bold" />} label={formatPhone(member.phone) ?? member.phone} href={`tel:${member.phone}`} />
            ) : null}
            {member.linkedin_url ? (
              <DrawerLink icon={<LinkedinLogo size={15} weight="bold" />} label="LinkedIn" href={member.linkedin_url} />
            ) : null}
            {member.instagram_url ? (
              <DrawerLink icon={<InstagramLogo size={15} weight="bold" />} label="Instagram" href={member.instagram_url} />
            ) : null}
            {member.website_url ? (
              <DrawerLink icon={<Globe size={15} weight="bold" />} label={member.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")} href={member.website_url} />
            ) : null}
          </div>
          <div className={styles.drawerDetailGroup}>
            {companyName ? (
              <div className={styles.drawerDetailRow}>
                <Globe size={15} weight="bold" className={styles.drawerDetailIcon} />
                <span className={styles.drawerDetailText}>
                  <span className={styles.drawerDetailLabel}>Company</span>
                  <span className={styles.drawerDetailValue}>{companyName}</span>
                </span>
              </div>
            ) : null}
            {member.hours ? (
              <div className={styles.drawerDetailRow}>
                <CalendarBlank size={15} weight="bold" className={styles.drawerDetailIcon} />
                <span className={styles.drawerDetailText}>
                  <span className={styles.drawerDetailLabel}>Hours</span>
                  <span className={styles.drawerDetailValue}>{member.hours}</span>
                </span>
              </div>
            ) : null}
            {member.member_since ? (
              <div className={styles.drawerDetailRow}>
                <CalendarBlank size={15} weight="bold" className={styles.drawerDetailIcon} />
                <span className={styles.drawerDetailText}>
                  <span className={styles.drawerDetailLabel}>Member since</span>
                  <span className={styles.drawerDetailValue}>{formatMemberSince(member.member_since)}</span>
                </span>
              </div>
            ) : null}
            {member.languages?.length ? (
              <DrawerTagRow icon={<Translate size={15} weight="bold" />} label="Languages" tags={member.languages} />
            ) : null}
            {member.services?.length ? (
              <DrawerTagRow icon={<Sparkle size={15} weight="bold" />} label="Services" tags={member.services} />
            ) : null}
            {member.specialties?.length ? (
              <DrawerTagRow icon={<Star size={15} weight="bold" />} label="Expertise" tags={member.specialties} />
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export function WorkspaceTeamTab({
  workspaceId,
  members,
  activeContactId,
  proxyTeam,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [addPending, startAddTransition] = useTransition();
  const [removePending, startRemoveTransition] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const selectedProxyId = searchParams?.get("teamMember") ?? null;

  const selectedProxy = useMemo(
    () => proxyTeam.find((member) => member.id === selectedProxyId) ?? null,
    [proxyTeam, selectedProxyId],
  );

  const portalAccessCount = members.filter((member) => member.portalAccess).length;
  const confirmTarget = members.find((member) => member.id === confirmRemoveId);

  function openOwnerDetail(memberId: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", "team");
    params.set("person", memberId);
    params.set("detail", "contact");
    params.delete("section");
    router.replace(`/admin/workspaces/${workspaceId}?${params.toString()}`, {
      scroll: false,
    });
  }

  function updateProxyDetail(memberId: string | null) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", "team");
    if (memberId) {
      params.set("teamMember", memberId);
    } else {
      params.delete("teamMember");
    }
    router.replace(`/admin/workspaces/${workspaceId}?${params.toString()}`, {
      scroll: false,
    });
  }

  function handleAdd() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError("First and last name are required.");
      return;
    }

    setFormError(null);
    startAddTransition(async () => {
      const result = await addPersonToWorkspace(workspaceId, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      });

      if (result.ok) {
        setForm(EMPTY_FORM);
        setIsAdding(false);
        router.replace(`/admin/workspaces/${workspaceId}?tab=team&person=${result.id}&detail=contact`, {
          scroll: false,
        });
        router.refresh();
      } else {
        setFormError(result.error);
      }
    });
  }

  function handleRemoveConfirm() {
    if (!confirmRemoveId) return;
    setRemoveError(null);
    startRemoveTransition(async () => {
      const result = await removePersonFromWorkspace(confirmRemoveId, workspaceId);
      setConfirmRemoveId(null);
      if (result.ok) {
        router.replace(`/admin/workspaces/${workspaceId}?tab=team`, {
          scroll: false,
        });
        router.refresh();
      } else {
        setRemoveError(result.error);
      }
    });
  }

  return (
    <div className={styles.root}>
      <section className={styles.summaryGrid} aria-label="Team summary">
        <div className={styles.summaryTile}>
          <UsersThree size={18} weight="bold" />
          <span>
            <strong>{members.length}</strong>
            Owner team
          </span>
        </div>
        <div className={styles.summaryTile}>
          <User size={18} weight="bold" />
          <span>
            <strong>{proxyTeam.length}</strong>
            Proxy team
          </span>
        </div>
        <div className={styles.summaryTile}>
          <CheckCircle size={18} weight="bold" />
          <span>
            <strong>{portalAccessCount}</strong>
            Workspace access
          </span>
        </div>
      </section>

      <section className={styles.teamSection}>
        <div className={styles.sectionHeader}>
          <SectionTitle title="Owner Team" count={members.length} />
          <button
            type="button"
            className={styles.addButton}
            onClick={() => {
              setIsAdding((current) => !current);
              setFormError(null);
            }}
          >
            <UserPlus size={15} weight="bold" />
            Add person
          </button>
        </div>

        {removeError ? <p className={styles.errorText}>{removeError}</p> : null}

        {isAdding ? (
          <div className={styles.addPanel}>
            <div className={styles.formGrid}>
              <label className={styles.formField}>
                <span>First name</span>
                <input
                  className={styles.textInput}
                  value={form.firstName}
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                  placeholder="Jane"
                  autoFocus
                />
              </label>
              <label className={styles.formField}>
                <span>Last name</span>
                <input
                  className={styles.textInput}
                  value={form.lastName}
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                  placeholder="Smith"
                />
              </label>
              <label className={styles.formField}>
                <span>Email optional</span>
                <input
                  className={styles.textInput}
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="jane@example.com"
                />
              </label>
              <label className={styles.formField}>
                <span>Phone optional</span>
                <input
                  className={styles.textInput}
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="+1 555 000 0000"
                />
              </label>
            </div>
            {formError ? <p className={styles.errorText}>{formError}</p> : null}
            <div className={styles.formActions}>
              <button type="button" className={styles.saveButton} onClick={handleAdd} disabled={addPending}>
                {addPending ? "Adding..." : "Add person"}
              </button>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => {
                  setIsAdding(false);
                  setForm(EMPTY_FORM);
                  setFormError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className={styles.ownerGrid}>
          {members.map((member) => (
            <OwnerCard
              key={member.id}
              member={member}
              isActive={member.id === activeContactId}
              canRemove={members.length > 1 && !removePending}
              onOpen={() => openOwnerDetail(member.id)}
              onRemove={() => setConfirmRemoveId(member.id)}
            />
          ))}
        </div>
      </section>

      <section className={styles.teamSection}>
        <SectionTitle title="Proxy Team" count={proxyTeam.length} />
        {proxyTeam.length > 0 ? (
          <div className={styles.proxyGrid}>
            {proxyTeam.map((member) => (
              <ProxyCard
                key={member.id}
                member={member}
                onOpen={() => updateProxyDetail(member.id)}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyProxyTeam}>
            <UsersThree size={20} weight="bold" />
            <span>Proxy team members will appear here.</span>
          </div>
        )}
      </section>

      <ConfirmModal
        open={!!confirmRemoveId}
        title="Remove person"
        description={`Remove ${confirmTarget?.fullName ?? "this person"} from the workspace? They will move to a standalone record.`}
        variant="danger"
        confirmLabel="Remove"
        onConfirm={handleRemoveConfirm}
        onCancel={() => setConfirmRemoveId(null)}
      />

      {selectedProxy ? (
        <ProxyTeamDrawer member={selectedProxy} onClose={() => updateProxyDetail(null)} />
      ) : null}
    </div>
  );
}

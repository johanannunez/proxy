"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  EnvelopeSimple,
  Phone,
  MapPin,
  LinkedinLogo,
  InstagramLogo,
  ArrowSquareOut,
  Translate,
  Star,
  CalendarBlank,
  Sparkle,
  Globe,
  ChatCircle,
  User,
} from "@phosphor-icons/react";

type ProxyTeamMember = {
  id: string;
  name: string;
  role: string;
  location: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  bio: string | null;
  member_since: string | null;
  languages: string[] | null;
  specialties: string[] | null;
  founding_member: boolean | null;
  website_url: string | null;
  is_messageable: boolean | null;
};

type OwnerMember = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  responsibility: string | null;
  location: string | null;
};

type DrawerItem =
  | { type: "proxy"; data: ProxyTeamMember }
  | { type: "owner"; data: OwnerMember };

type MemberColors = {
  gradient: string;
  shadow: string;
  shadowHover: string;
  drawerBorder: string;
};

function getMemberColors(name: string): MemberColors {
  if (name.toLowerCase().includes("elmira")) {
    return {
      gradient: "linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)",
      shadow: "0 2px 8px rgba(109, 40, 217, 0.28)",
      shadowHover: "0 6px 24px rgba(109, 40, 217, 0.50)",
      drawerBorder: "rgba(76, 29, 149, 0.35)",
    };
  }
  return {
    gradient: "linear-gradient(135deg, #02AAEB 0%, #1B77BE 100%)",
    shadow: "0 2px 8px rgba(2, 170, 235, 0.22)",
    shadowHover: "0 6px 24px rgba(2, 170, 235, 0.45)",
    drawerBorder: "rgba(27, 119, 190, 0.30)",
  };
}


function Avatar({
  src,
  name,
  size = 52,
  theme = "light",
}: {
  src?: string | null;
  name?: string | null;
  email?: string;
  size?: number;
  theme?: "light" | "blue";
}) {
  const placeholderStyle =
    theme === "blue"
      ? { backgroundColor: "rgba(255,255,255,0.20)", color: "rgba(255,255,255,0.70)" }
      : { background: "linear-gradient(135deg, rgba(2,170,235,0.10) 0%, rgba(27,119,190,0.16) 100%)", color: "rgba(2,170,235,0.55)" };

  const photoRing =
    theme === "blue"
      ? "0 0 0 2.5px rgba(255,255,255,0.55)"
      : "0 0 0 2px #fff, 0 0 0 3.5px rgba(2, 170, 235, 0.28)";

  const Placeholder = (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ ...placeholderStyle, width: size, height: size }}
    >
      <User size={size * 0.46} weight="regular" />
    </div>
  );

  if (src) {
    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name ?? ""}
          width={size}
          height={size}
          className="rounded-full object-cover"
          style={{ width: size, height: size, boxShadow: photoRing }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
            const fb = e.currentTarget.parentElement?.querySelector(
              "[data-fallback]",
            ) as HTMLElement | null;
            if (fb) fb.style.display = "flex";
          }}
        />
        <div
          data-fallback
          className="absolute inset-0 hidden items-center justify-center rounded-full"
          style={placeholderStyle}
        >
          <User size={size * 0.46} weight="regular" />
        </div>
      </div>
    );
  }

  return Placeholder;
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="shrink-0 text-[13px] font-semibold"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {title}
      </span>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
        style={{
          backgroundColor: "var(--color-warm-gray-100)",
          color: "var(--color-text-tertiary)",
        }}
      >
        {count}
      </span>
      <div
        className="flex-1"
        style={{ height: 1, backgroundColor: "var(--color-warm-gray-200)" }}
      />
    </div>
  );
}

function ProxyCard({
  member,
  index,
  onClick,
}: {
  member: ProxyTeamMember;
  index: number;
  onClick: () => void;
}) {
  const colors = getMemberColors(member.name);
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.05 }}
      onClick={onClick}
      className="flex w-full cursor-pointer items-start gap-4 rounded-2xl p-5 text-left"
      style={{
        background: colors.gradient,
        boxShadow: colors.shadow,
        minHeight: 148,
        transition: "box-shadow 150ms ease, transform 150ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = colors.shadowHover;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = colors.shadow;
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <Avatar src={member.avatar_url} name={member.name} size={52} theme="blue" />
      <div className="min-w-0 flex-1 pt-0.5">
        <div
          className="truncate text-[14px] font-semibold leading-tight"
          style={{ color: "rgba(255,255,255,0.97)" }}
        >
          {member.name}
        </div>
        {member.founding_member && (
          <div className="mt-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                backgroundColor: "rgba(245, 158, 11, 0.45)",
                color: "#fef3c7",
              }}
            >
              <Sparkle size={10} weight="fill" />
              Founding team
            </span>
          </div>
        )}
        <div className="mt-1.5">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: "rgba(255,255,255,0.18)",
              color: "rgba(255,255,255,0.95)",
            }}
          >
            {member.role}
          </span>
        </div>
        {member.location && (
          <div
            className="mt-2 flex items-center gap-1 text-[12px]"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            <MapPin size={11} />
            {member.location}
          </div>
        )}
      </div>
    </motion.button>
  );
}

function OwnerCard({
  member,
  index,
  isCurrent,
  onClick,
}: {
  member: OwnerMember;
  index: number;
  isCurrent: boolean;
  onClick: () => void;
}) {
  const displayName = member.full_name?.trim() || member.email;
  const responsibility = member.responsibility?.trim() || "Owner";

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.05 }}
      onClick={onClick}
      className="flex w-full cursor-pointer items-start gap-4 rounded-2xl border p-5 text-left"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
        minHeight: 148,
        transition: "border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--color-brand)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(2, 170, 235, 0.10)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--color-warm-gray-200)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <Avatar
        src={member.avatar_url}
        name={member.full_name}
        email={member.email}
        size={52}
        theme="light"
      />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="truncate text-[14px] font-semibold leading-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            {displayName}
          </div>
          {isCurrent && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                backgroundColor: "rgba(2, 170, 235, 0.10)",
                color: "var(--color-brand)",
              }}
            >
              You
            </span>
          )}
        </div>
        <div className="mt-2">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: "rgba(2, 170, 235, 0.08)",
              color: "var(--color-brand)",
            }}
          >
            {responsibility}
          </span>
        </div>
        {member.location && (
          <div
            className="mt-2 flex items-center gap-1 text-[12px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <MapPin size={11} />
            {member.location}
          </div>
        )}
      </div>
    </motion.button>
  );
}

export function MembersShell({
  proxyTeam,
  ownerMembers,
  currentUserId,
}: {
  proxyTeam: ProxyTeamMember[];
  ownerMembers: OwnerMember[];
  currentUserId: string;
}) {
  const [drawer, setDrawer] = useState<DrawerItem | null>(null);
  const closeDrawer = () => setDrawer(null);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {/* Owner section — always first */}
      {ownerMembers.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHeader title="Owner" count={ownerMembers.length} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ownerMembers.map((member, i) => (
              <OwnerCard
                key={member.id}
                member={member}
                index={i}
                isCurrent={member.id === currentUserId}
                onClick={() => setDrawer({ type: "owner", data: member })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Proxy team section — below owners */}
      <section className="flex flex-col gap-4">
        <SectionHeader title="The Proxy" count={proxyTeam.length} />
        {proxyTeam.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
            Your Proxy team members will appear here.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {proxyTeam.map((member, i) => (
              <ProxyCard
                key={member.id}
                member={member}
                index={i}
                onClick={() => setDrawer({ type: "proxy", data: member })}
              />
            ))}
          </div>
        )}
      </section>

      {/* Backdrop + Drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/30"
              onClick={closeDrawer}
              aria-hidden="true"
            />

            <motion.div
              key="drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 340 }}
              className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col shadow-2xl"
              style={{ backgroundColor: "var(--color-white)" }}
            >
              {/* Drawer header bar */}
              <div
                className="flex items-center justify-between border-b px-5 py-4"
                style={{ borderColor: "var(--color-warm-gray-200)" }}
              >
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {drawer.type === "proxy" ? "Team member" : "Owner"}
                </span>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-warm-gray-100)]"
                  style={{ color: "var(--color-text-tertiary)" }}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Horizontal hero zone */}
                {drawer.type === "proxy" ? (() => {
                  const dc = getMemberColors(drawer.data.name);
                  return (
                  <div
                    className="flex items-center gap-4 px-5 py-5"
                    style={{
                      background: dc.gradient,
                      borderBottom: `1px solid ${dc.drawerBorder}`,
                    }}
                  >
                    <Avatar
                      src={drawer.data.avatar_url}
                      name={drawer.data.name}
                      size={60}
                      theme="blue"
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-[15px] font-semibold leading-tight"
                        style={{ color: "rgba(255,255,255,0.97)" }}
                      >
                        {drawer.data.name}
                      </div>
                      {drawer.data.founding_member && (
                        <div className="mt-1">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              backgroundColor: "#D97706",
                              color: "#ffffff",
                            }}
                          >
                            <Sparkle size={9} weight="fill" />
                            Founding team
                          </span>
                        </div>
                      )}
                      <div className="mt-1.5">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                          style={{
                            backgroundColor: "rgba(255,255,255,0.18)",
                            color: "rgba(255,255,255,0.95)",
                          }}
                        >
                          {drawer.data.role}
                        </span>
                      </div>
                      {drawer.data.location && (
                        <div
                          className="mt-1.5 flex items-center gap-1 text-[11px]"
                          style={{ color: "rgba(255,255,255,0.60)" }}
                        >
                          <MapPin size={10} />
                          {drawer.data.location}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })() : (
                  <div
                    className="flex items-center gap-4 px-5 py-5"
                    style={{
                      background: "linear-gradient(180deg, var(--color-warm-gray-50) 0%, var(--color-white) 100%)",
                      borderBottom: "1px solid var(--color-warm-gray-200)",
                    }}
                  >
                    <Avatar
                      src={drawer.data.avatar_url}
                      name={drawer.data.full_name}
                      email={drawer.data.email}
                      size={60}
                      theme="light"
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-[15px] font-semibold leading-tight"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {drawer.data.full_name?.trim() || drawer.data.email}
                      </div>
                      <div className="mt-1.5">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                          style={{
                            backgroundColor: "rgba(2, 170, 235, 0.08)",
                            color: "var(--color-brand)",
                          }}
                        >
                          {drawer.data.responsibility?.trim() || "Owner"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {drawer.type === "proxy" ? (
                  <>
                    {/* Bio */}
                    {drawer.data.bio && (
                      <div
                        className="px-5 py-4 text-[13px] leading-relaxed"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {drawer.data.bio}
                      </div>
                    )}

                    <div
                      className="mx-5 border-t"
                      style={{ borderColor: "var(--color-warm-gray-200)" }}
                    />

                    {/* Contact — only render rows with data */}
                    <div className="flex flex-col gap-1 px-5 py-3">
                      {drawer.data.email && (
                        <DrawerContactRow
                          icon={<EnvelopeSimple size={15} />}
                          label={drawer.data.email}
                          href={`mailto:${drawer.data.email}`}
                        />
                      )}
                      {drawer.data.phone && (
                        <DrawerContactRow
                          icon={<Phone size={15} />}
                          label={drawer.data.phone}
                          href={`tel:${drawer.data.phone}`}
                        />
                      )}
                      {drawer.data.linkedin_url && (
                        <DrawerContactRow
                          icon={<LinkedinLogo size={15} />}
                          label="LinkedIn"
                          href={drawer.data.linkedin_url}
                          external
                        />
                      )}
                      {drawer.data.instagram_url && (
                        <DrawerContactRow
                          icon={<InstagramLogo size={15} />}
                          label="Instagram"
                          href={drawer.data.instagram_url}
                          external
                        />
                      )}
                      {drawer.data.website_url && (
                        <DrawerContactRow
                          icon={<Globe size={15} />}
                          label={drawer.data.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                          href={drawer.data.website_url}
                          external
                        />
                      )}
                    </div>

                    {/* Message button — only for messageable members */}
                    {drawer.data.is_messageable && (
                      <div className="px-5 pb-4">
                        <Link
                          href="/workspace/inbox"
                          onClick={closeDrawer}
                          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold"
                          style={{
                            background: "linear-gradient(135deg, #02AAEB 0%, #1B77BE 100%)",
                            color: "#fff",
                            textDecoration: "none",
                            boxShadow: "0 2px 8px rgba(2,170,235,0.25)",
                          }}
                        >
                          <ChatCircle size={15} weight="fill" />
                          Send a message
                        </Link>
                      </div>
                    )}

                    <div
                      className="mx-5 border-t"
                      style={{ borderColor: "var(--color-warm-gray-200)" }}
                    />

                    {/* Details */}
                    <div className="flex flex-col gap-4 px-5 py-4">
                      {drawer.data.member_since && (
                        <DrawerDetailRow
                          icon={<CalendarBlank size={14} />}
                          label="Member since"
                          value={formatMemberSince(drawer.data.member_since)}
                        />
                      )}
                      {drawer.data.languages && drawer.data.languages.length > 0 && (
                        <DrawerTagRow
                          icon={<Translate size={14} />}
                          label="Languages"
                          tags={drawer.data.languages}
                          tagStyle="neutral"
                        />
                      )}
                      {drawer.data.specialties && drawer.data.specialties.length > 0 && (
                        <DrawerTagRow
                          icon={<Star size={14} />}
                          label="Expertise"
                          tags={drawer.data.specialties}
                          tagStyle="blue"
                        />
                      )}
                    </div>
                  </>
                ) : (
                  /* Owner contact */
                  <div className="flex flex-col gap-1 px-5 py-3">
                    {drawer.data.email && (
                      <DrawerContactRow
                        icon={<EnvelopeSimple size={15} />}
                        label={drawer.data.email}
                        href={`mailto:${drawer.data.email}`}
                      />
                    )}
                    {drawer.data.phone && (
                      <DrawerContactRow
                        icon={<Phone size={15} />}
                        label={drawer.data.phone}
                        href={`tel:${drawer.data.phone}`}
                      />
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatMemberSince(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function DrawerDetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 shrink-0"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {label}
        </div>
        <div
          className="mt-0.5 text-[13px]"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function DrawerTagRow({
  icon,
  label,
  tags,
  tagStyle,
}: {
  icon: React.ReactNode;
  label: string;
  tags: string[];
  tagStyle: "neutral" | "blue";
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 shrink-0"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {label}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={
                tagStyle === "blue"
                  ? {
                      backgroundColor: "rgba(2, 170, 235, 0.08)",
                      color: "var(--color-brand)",
                    }
                  : {
                      backgroundColor: "var(--color-warm-gray-100)",
                      color: "var(--color-text-secondary)",
                    }
              }
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DrawerContactRow({
  icon,
  label,
  href,
  external = false,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors hover:bg-[var(--color-warm-gray-50)]"
      style={{ color: "var(--color-text-secondary)", textDecoration: "none" }}
    >
      <span style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {external && (
        <ArrowSquareOut
          size={13}
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: "var(--color-text-tertiary)" }}
        />
      )}
    </a>
  );
}

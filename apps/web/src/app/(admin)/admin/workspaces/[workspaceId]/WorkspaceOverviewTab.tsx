"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  ArrowsClockwise,
  Buildings,
  FolderOpen,
} from "@phosphor-icons/react";
import type { WorkspaceContactDetail, WorkspaceMember, ProxyTeamMember } from "@/lib/admin/workspace-contact-detail";
import type { WorkspaceDocument } from "@/lib/admin/workspace-documents";
import type { WorkspaceMessage } from "@/lib/admin/workspace-messages";
import type { Insight } from "@/lib/admin/ai-insights";
import type { OverviewTask } from "@/lib/admin/workspace-overview";
import type { WorkspaceDetailActivityEntry } from "@/lib/admin/workspace-detail-types";
import type { ProjectRow } from "@/lib/admin/project-types";
import { PROJECT_STATUS_LABEL, PROJECT_TYPE_LABEL } from "@/lib/admin/project-types";
import { regenerateWorkspaceIntelligence } from "./workspace-intelligence-actions";
import { WorkspaceTeamTab } from "./WorkspaceTeamTab";
import styles from "./WorkspaceOverviewTab.module.css";

type Props = {
  workspaceContact: WorkspaceContactDetail;
  workspaceId: string;
  projects: ProjectRow[];
  documents: WorkspaceDocument[];
  messages: WorkspaceMessage[];
  insights: Insight[];
  openTasks: OverviewTask[];
  activityLog: WorkspaceDetailActivityEntry[];
  members?: WorkspaceMember[];
  proxyTeam?: ProxyTeamMember[];
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatActivityAction(action: string, actorName: string | null): string {
  const a = action ?? "";
  const actor = actorName ?? "Someone";
  if (a.includes("message")) return `${actor} sent a message`;
  if (a.includes("meeting")) return "Meeting recorded";
  if (a.includes("document")) return "Document updated";
  if (a.includes("intelligence") || a.includes("insight")) return "Intelligence analysis generated";
  if (a.includes("stage")) return "Stage changed";
  if (a.includes("note")) return "Note added";
  return a.replace(/_/g, " ");
}

function formatActivityDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function WorkspaceOverviewTab({
  workspaceContact,
  workspaceId,
  projects,
  documents,
  messages,
  insights,
  openTasks,
  activityLog,
  members = [],
  proxyTeam = [],
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const briefInsight = insights.find(
    (i) => i.agentKey === "client_intelligence:relationship_summary",
  );
  const sentimentInsight = insights.find(
    (i) => i.agentKey === "client_intelligence:sentiment",
  );
  const riskInsights = insights.filter(
    (i) =>
      i.agentKey === "client_intelligence:risk_signals" &&
      i.severity === "warning",
  );

  const pendingDocs = documents.filter(
    (d) =>
      d.status !== "completed" &&
      d.status !== "signed" &&
      d.status !== "declined" &&
      d.status !== "expired",
  );
  const signedDocs = documents.filter(
    (d) => d.status === "completed" || d.status === "signed",
  );
  const unreadMessages = messages.filter(
    (m) => m.senderType === "person" && !m.readAt,
  );

  const attnItems: Array<{
    id: string;
    level: "red" | "amber";
    title: string;
    sub: string;
    cta: string;
    href: string;
  }> = [];

  for (const doc of pendingDocs.slice(0, 2)) {
    attnItems.push({
      id: `doc-${doc.id}`,
      level: "amber",
      title: `${doc.templateName} awaiting signature`,
      sub: doc.createdAt
        ? `Sent ${relativeTime(doc.createdAt)}, no response yet`
        : "No response yet",
      cta: "Documents →",
      href: `?tab=documents`,
    });
  }

  if (unreadMessages.length > 0) {
    attnItems.push({
      id: "unread-msgs",
      level: "amber",
      title: `${unreadMessages.length} unread message${unreadMessages.length > 1 ? "s" : ""} from ${workspaceContact.fullName.split(" ")[0]}`,
      sub: "Needs a reply",
      cta: "Inbox →",
      href: `?tab=messaging`,
    });
  }

  const sentimentPositive = sentimentInsight?.title?.toLowerCase().includes("positive");
  const sentimentNegative = sentimentInsight?.title?.toLowerCase().includes("negative");
  const sentimentEmoji = sentimentPositive ? "😊" : sentimentNegative ? "😟" : "😐";
  const briefChips: Array<{ label: string; color: "green" | "amber" | "blue" | "red" }> = [];
  if (sentimentInsight) {
    briefChips.push({
      label: `${sentimentEmoji} ${sentimentInsight.title}`,
      color: sentimentPositive ? "green" : sentimentNegative ? "red" : "blue",
    });
  }
  if (riskInsights.length > 0) {
    briefChips.push({
      label: `⚠ ${riskInsights.length} risk${riskInsights.length > 1 ? "s" : ""} flagged`,
      color: "amber",
    });
  }
  if (pendingDocs.length > 0) {
    briefChips.push({
      label: `📄 ${pendingDocs.length} doc${pendingDocs.length > 1 ? "s" : ""} pending`,
      color: "amber",
    });
  }
  if (workspaceContact.preferredContactMethod) {
    const method =
      workspaceContact.preferredContactMethod === "phone"
        ? "📞 Prefers phone"
        : workspaceContact.preferredContactMethod === "text"
          ? "💬 Prefers text"
          : workspaceContact.preferredContactMethod === "whatsapp"
            ? "💬 Prefers WhatsApp"
            : "📧 Prefers email";
    briefChips.push({ label: method, color: "blue" });
  }

  function handleRefresh() {
    startTransition(async () => {
      await regenerateWorkspaceIntelligence(workspaceContact.id);
      router.refresh();
    });
  }

  const recentMessages = messages.slice(0, 3);
  const recentActivity = activityLog.slice(0, 5);
  const activeProjects = projects.filter((project) => project.status !== "done");
  const displayProjects = activeProjects.length > 0 ? activeProjects : projects;

  const contactPath = `/admin/workspaces/${workspaceId}`;

  return (
    <div className={styles.root}>
      {/* Relationship Brief */}
      <div className={styles.brief}>
        <div className={styles.briefTop}>
          <div className={styles.briefIcon}>
            <Brain size={16} weight="fill" />
          </div>
          <div className={styles.briefMeta}>
            <div className={styles.briefHeader}>
              <span className={styles.briefLabel}>Relationship Brief</span>
              <div className={styles.briefTimestamp}>
                {briefInsight && (
                  <span>Updated {relativeTime(briefInsight.createdAt)}</span>
                )}
                <button
                  className={styles.refreshBtn}
                  onClick={handleRefresh}
                  disabled={isPending}
                >
                  <ArrowsClockwise
                    size={11}
                    weight="bold"
                    className={`${styles.refreshIcon} ${isPending ? styles.spinning : ""}`}
                  />
                  {isPending ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>
            {briefInsight ? (
              <p className={styles.briefText}>{briefInsight.body}</p>
            ) : (
              <p className={styles.briefEmpty}>
                No brief yet. Click Refresh to generate one.
              </p>
            )}
          </div>
        </div>
        {briefChips.length > 0 && (
          <div className={styles.briefChips}>
            {briefChips.map((chip) => (
              <span key={chip.label} className={`${styles.chip} ${styles[chip.color]}`}>
                {chip.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Needs Attention */}
      {attnItems.length > 0 && (
        <div className={styles.attn}>
          {attnItems.map((item) => (
            <a
              key={item.id}
              href={`${contactPath}${item.href}`}
              className={styles.attnItem}
            >
              <div className={`${styles.attnDot} ${styles[item.level]}`} />
              <div className={styles.attnBody}>
                <div className={styles.attnTitle}>{item.title}</div>
                <div className={styles.attnSub}>{item.sub}</div>
              </div>
              <span className={styles.attnCta}>{item.cta}</span>
            </a>
          ))}
        </div>
      )}

      {/* Bento Row 1: Open Tasks · Finances · Projects */}
      <div className={styles.bento}>
        {/* Open Tasks */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardHeadLabel}>Open Tasks</span>
          </div>
          <div className={styles.statBody}>
            <div className={`${styles.bigNum} ${openTasks.length > 0 ? styles.amber : ""}`}>
              {openTasks.length}
            </div>
            <div className={styles.bigSub}>
              {openTasks.length === 1 ? "task pending" : "tasks pending"}
            </div>
            <div className={styles.statList}>
              {openTasks.length === 0 && (
                <div className={styles.emptyHint}>All clear</div>
              )}
              {openTasks.slice(0, 3).map((t) => (
                <div key={t.id} className={styles.statRow}>
                  <span className={`${styles.sDot} ${styles.amber}`} />
                  <span>{t.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Finances */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardHeadLabel}>Finances</span>
            <a href={`${contactPath}?tab=finance`} className={styles.cardHeadLink}>
              →
            </a>
          </div>
          <div className={styles.statBody}>
            <div className={styles.bigNum}>
              {workspaceContact.lifetimeRevenue != null
                ? workspaceContact.lifetimeRevenue >= 100_000
                  ? `$${(workspaceContact.lifetimeRevenue / 100).toFixed(0)}`
                  : `$${(workspaceContact.lifetimeRevenue / 100).toFixed(0)}`
                : "$0"}
            </div>
            <div className={styles.bigSub}>lifetime revenue</div>
            <div className={styles.statList}>
              {workspaceContact.managementFeePercent != null && (
                <div className={styles.statRow}>
                  <span className={`${styles.sDot} ${styles.green}`} />
                  <span>{workspaceContact.managementFeePercent}% management fee</span>
                </div>
              )}
              <div className={styles.statRow}>
                <span className={`${styles.sDot} ${styles.green}`} />
                <span>All payouts current</span>
              </div>
            </div>
          </div>
        </div>

        {/* Projects */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardHeadLabel}>Projects</span>
            <a href={`${contactPath}?tab=projects`} className={styles.cardHeadLink}>
              {projects.length} total →
            </a>
          </div>
          <div className={styles.projectBody}>
            {projects.length === 0 ? (
              <div className={styles.emptyHint}>No projects yet</div>
            ) : (
              displayProjects.slice(0, 3).map((project) => (
                <a key={project.id} href={`/admin/projects/${project.id}`} className={styles.projectItem}>
                  <span className={styles.projectItemIcon}>
                    <FolderOpen size={13} weight="duotone" />
                  </span>
                  <span className={styles.projectItemBody}>
                    <span className={styles.projectItemName}>{project.name}</span>
                    <span className={styles.projectItemMeta}>
                      {PROJECT_TYPE_LABEL[project.projectType]} · {PROJECT_STATUS_LABEL[project.status]}
                    </span>
                  </span>
                  <span className={styles.projectProgress}>
                    {project.taskCount === 0
                      ? "0%"
                      : `${Math.round((project.taskDoneCount / project.taskCount) * 100)}%`}
                  </span>
                </a>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bento Row 2: Properties · Documents · Messages */}
      <div className={styles.bento}>
        {/* Properties */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardHeadLabel}>Properties</span>
            <a href={`${contactPath}?tab=properties`} className={styles.cardHeadLink}>
              View all →
            </a>
          </div>
          {workspaceContact.properties.length === 0 ? (
            <div className={styles.emptyHint}>No properties yet</div>
          ) : (
            workspaceContact.properties.map((p) => (
              <div key={p.id} className={styles.propRow}>
                <div className={styles.propIcon}>
                  <Buildings size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.propAddress}>{p.addressLine1 ?? "Address unknown"}</div>
                  <div className={styles.propSub}>
                    {[p.city, p.state].filter(Boolean).join(", ")}
                    {p.bedrooms != null && ` · ${p.bedrooms} bd / ${p.bathrooms ?? "?"} ba`}
                  </div>
                  <div className={styles.propBadges}>
                    {p.active && <span className={`${styles.badge} ${styles.green}`}>Active</span>}
                    <span className={`${styles.badge} ${styles.gray}`}>{p.setupStatus}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Documents */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardHeadLabel}>Documents</span>
            <a href={`${contactPath}?tab=documents`} className={styles.cardHeadLink}>
              {signedDocs.length}/{documents.length} signed →
            </a>
          </div>
          <div className={styles.statBody}>
            <div className={`${styles.bigNum} ${pendingDocs.length > 0 ? styles.amber : styles.green}`}>
              {signedDocs.length}/{documents.length}
            </div>
            <div className={styles.bigSub}>documents signed</div>
            <div className={styles.statList}>
              {pendingDocs.slice(0, 2).map((d) => (
                <div key={d.id} className={styles.docItem}>
                  <div className={`${styles.docStatusDot} ${styles.pending}`}>!</div>
                  <span className={`${styles.docName} ${styles.pending}`}>{d.templateName}</span>
                  <span className={styles.docPendingLabel}>Pending</span>
                </div>
              ))}
              {signedDocs.slice(0, 2).map((d) => (
                <div key={d.id} className={styles.docItem}>
                  <div className={`${styles.docStatusDot} ${styles.done}`}>✓</div>
                  <span className={styles.docName}>{d.templateName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Inbox */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardHeadLabel}>Inbox</span>
            <a href={`${contactPath}?tab=messaging`} className={styles.cardHeadLink}>
              {messages.length} total →
            </a>
          </div>
          {recentMessages.length === 0 ? (
            <div className={styles.emptyHint}>No messages yet</div>
          ) : (
            recentMessages.map((m) => (
              <div key={m.id} className={styles.msgItem}>
                <div className={styles.msgTop}>
                  <div
                    className={`${styles.msgAvatar} ${m.senderType === "admin" ? styles.admin : ""}`}
                  >
                    {initials(m.senderName)}
                  </div>
                  <span className={styles.msgFrom}>{m.senderName}</span>
                  <span className={styles.msgWhen}>
                    {formatActivityDate(m.createdAt)}
                  </span>
                </div>
                <div className={styles.msgPreview}>{m.body}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className={styles.activity}>
        <div className={styles.activityHead}>
          <span className={styles.cardHeadLabel}>Recent Activity</span>
        </div>
        {recentActivity.length === 0 ? (
          <div className={styles.emptyHint}>No recent activity</div>
        ) : (
          recentActivity.map((entry) => (
            <div key={entry.id} className={styles.activityItem}>
              <div className={styles.actDot} />
              <div className={styles.actText}>
                {formatActivityAction(entry.action, entry.actorName)}
              </div>
              <div className={styles.actDate}>{formatActivityDate(entry.createdAt)}</div>
            </div>
          ))
        )}
      </div>

      {members.length > 0 && (
        <WorkspaceTeamTab
          workspaceId={workspaceId}
          members={members}
          activeContactId={workspaceContact.id}
          proxyTeam={proxyTeam}
        />
      )}
    </div>
  );
}

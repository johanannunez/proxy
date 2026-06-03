"use client";

import { useTransition } from "react";
import {
  Brain,
  Warning,
  Smiley,
  LightbulbFilament,
  ChatCircleText,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { regenerateWorkspaceIntelligence } from "./workspace-intelligence-actions";
import type { Insight } from "@/lib/admin/ai-insights";
import styles from "./IntelligenceTab.module.css";

type Props = {
  contactId: string;
  insights: Insight[];
  generatedAt: string | null;
};

const SECTION_META: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  "client_intelligence:relationship_summary": {
    label: "Relationship summary",
    icon: Brain,
    description: "Where the relationship stands and communication patterns.",
  },
  "client_intelligence:risk_signals": {
    label: "Risk signals",
    icon: Warning,
    description: "Flags that may indicate churn risk or relationship strain.",
  },
  "client_intelligence:sentiment": {
    label: "Owner sentiment",
    icon: Smiley,
    description: "Current sentiment based on recent interactions.",
  },
  "client_intelligence:recommendations": {
    label: "Recommended actions",
    icon: LightbulbFilament,
    description: "Specific next steps for this relationship.",
  },
  "client_intelligence:conversation_themes": {
    label: "Conversation themes",
    icon: ChatCircleText,
    description: "Recurring topics across meetings and messages.",
  },
};

const SECTION_ORDER = [
  "client_intelligence:relationship_summary",
  "client_intelligence:risk_signals",
  "client_intelligence:sentiment",
  "client_intelligence:recommendations",
  "client_intelligence:conversation_themes",
];

const SEVERITY_CLASS: Record<string, string> = {
  info: styles.severityInfo,
  recommendation: styles.severityRecommendation,
  warning: styles.severityWarning,
  success: styles.severitySuccess,
};

export function IntelligenceTab({ contactId, insights, generatedAt }: Props) {
  const [isPending, startTransition] = useTransition();

  const byKey = new Map<string, Insight[]>();
  for (const insight of insights) {
    const list = byKey.get(insight.agentKey) ?? [];
    list.push(insight);
    byKey.set(insight.agentKey, list);
  }

  function handleRefresh() {
    startTransition(async () => {
      await regenerateWorkspaceIntelligence(contactId);
    });
  }

  const hasInsights = insights.length > 0;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Relationship Intelligence</h2>
          {generatedAt ? (
            <p className={styles.timestamp}>
              Last generated{" "}
              {new Date(generatedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          ) : (
            <p className={styles.timestamp}>Not yet generated</p>
          )}
        </div>
        <button
          className={styles.refreshBtn}
          onClick={handleRefresh}
          disabled={isPending}
          aria-label="Regenerate intelligence"
        >
          <ArrowsClockwise size={15} className={isPending ? styles.spinning : undefined} />
          {isPending ? "Generating…" : "Refresh"}
        </button>
      </div>

      {!hasInsights ? (
        <div className={styles.emptyState}>
          <Brain size={32} weight="duotone" className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>No intelligence yet</p>
          <p className={styles.emptyBody}>
            Click Refresh to generate AI insights for this relationship.
            Proxy analyzes communication events, meetings, and contact history.
          </p>
        </div>
      ) : (
        <div className={styles.sections}>
          {SECTION_ORDER.map((key) => {
            const meta = SECTION_META[key];
            if (!meta) return null;
            const sectionInsights = byKey.get(key) ?? [];
            if (sectionInsights.length === 0) return null;
            const Icon = meta.icon;

            return (
              <div key={key} className={styles.section}>
                <div className={styles.sectionHeader}>
                  <Icon size={16} weight="duotone" className={styles.sectionIcon} />
                  <h3 className={styles.sectionTitle}>{meta.label}</h3>
                </div>
                {sectionInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className={`${styles.insightCard} ${SEVERITY_CLASS[insight.severity] ?? ""}`}
                  >
                    <p className={styles.insightTitle}>{insight.title}</p>
                    <p className={styles.insightBody}>{insight.body}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

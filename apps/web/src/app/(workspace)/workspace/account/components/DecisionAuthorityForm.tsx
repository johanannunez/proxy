"use client";

import { useState, useTransition } from "react";
import { CheckCircle, Spinner, WarningCircle, FileText } from "@phosphor-icons/react";
import {
  AUTHORITY_DOMAINS,
  DOMAIN_LABELS,
  DOMAIN_DESCRIPTIONS,
} from "@/lib/workspace/decision-authority-types";
import type {
  AuthorityConfig,
  GovernanceMode,
  WorkspaceAuthority,
} from "@/lib/workspace/decision-authority-types";
import {
  saveAuthorityConfigAction,
  sendAddendumForSignatureAction,
} from "../decision-authority-actions";

export interface DecisionAuthorityFormMember {
  id: string;
  full_name: string | null;
  email: string;
}

interface DecisionAuthorityFormProps {
  workspaceId: string;
  members: DecisionAuthorityFormMember[];
  properties: { id: string; name: string }[];
  existingAuthority: WorkspaceAuthority | null;
  existingConfig: AuthorityConfig | null;
}

export function DecisionAuthorityForm({
  members,
  properties,
  existingAuthority,
  existingConfig,
}: DecisionAuthorityFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAuthorityId, setSavedAuthorityId] = useState<string | null>(
    existingAuthority?.status === "draft" ? existingAuthority.id : null
  );
  const [stage, setStage] = useState<"configure" | "pending_signature" | "signed">(
    existingAuthority?.status === "pending_signatures"
      ? "pending_signature"
      : existingAuthority?.status === "active"
        ? "signed"
        : "configure"
  );

  const [governanceMode, setGovernanceMode] = useState<GovernanceMode>(
    existingAuthority?.governance_mode ?? "workspace"
  );

  const [workspaceConfig, setWorkspaceConfig] = useState<AuthorityConfig>(
    existingConfig ?? { property_id: null, domains: {}, escalation_owner_ids: [] }
  );

  // For per-property mode: one config per property
  const [propertyConfigs] = useState<AuthorityConfig[]>(
    properties.map((p) => ({ property_id: p.id, domains: {}, escalation_owner_ids: [] }))
  );

  function getDisplayName(member: DecisionAuthorityFormMember) {
    return member.full_name?.trim() || member.email;
  }

  function updateWorkspaceDomain(domain: string, ownerId: string) {
    setWorkspaceConfig((prev) => ({
      ...prev,
      domains: { ...prev.domains, [domain]: ownerId },
    }));
  }

  function toggleWorkspaceEscalation(ownerId: string) {
    setWorkspaceConfig((prev) => {
      const current = prev.escalation_owner_ids;
      const next = current.includes(ownerId)
        ? current.filter((id) => id !== ownerId)
        : [...current, ownerId];
      return { ...prev, escalation_owner_ids: next };
    });
  }

  function handleSave() {
    setError(null);
    const configs = governanceMode === "workspace" ? [workspaceConfig] : propertyConfigs;
    startTransition(async () => {
      const result = await saveAuthorityConfigAction(governanceMode, configs);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSavedAuthorityId(result.authorityId);
    });
  }

  function handleSendForSignature() {
    if (!savedAuthorityId) return;
    setError(null);
    startTransition(async () => {
      const result = await sendAddendumForSignatureAction(savedAuthorityId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStage("pending_signature");
    });
  }

  if (stage === "signed") {
    return (
      <div
        className="flex items-center gap-3 rounded-xl border p-5"
        style={{
          backgroundColor: "rgba(16,185,129,0.06)",
          borderColor: "rgba(16,185,129,0.2)",
        }}
      >
        <CheckCircle size={22} weight="duotone" className="shrink-0 text-emerald-500" />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Decision authority is active
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            All owners have signed the addendum. Platform actions are now routed accordingly.
          </p>
        </div>
      </div>
    );
  }

  if (stage === "pending_signature") {
    return (
      <div
        className="flex items-center gap-3 rounded-xl border p-5"
        style={{
          backgroundColor: "rgba(245,158,11,0.06)",
          borderColor: "rgba(245,158,11,0.2)",
        }}
      >
        <FileText size={22} weight="duotone" className="shrink-0 text-amber-500" />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Awaiting signatures
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            Signing links have been sent to all owners. The addendum becomes active once
            everyone has signed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Governance mode selector */}
      <div>
        <p
          className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Governance mode
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(["workspace", "per_property"] as GovernanceMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setGovernanceMode(mode)}
              className="rounded-xl border p-4 text-left"
              style={{
                backgroundColor:
                  governanceMode === mode
                    ? "rgba(2,170,235,0.06)"
                    : "var(--color-white)",
                borderColor:
                  governanceMode === mode
                    ? "var(--color-brand)"
                    : "var(--color-warm-gray-200)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <p
                className="text-sm font-semibold"
                style={{
                  color:
                    governanceMode === mode
                      ? "var(--color-brand)"
                      : "var(--color-text-primary)",
                }}
              >
                {mode === "workspace" ? "Workspace-wide" : "Per-property"}
              </p>
              <p
                className="mt-1 text-xs"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {mode === "workspace"
                  ? "One set of assignments covers all properties."
                  : "Each property has its own authority assignments."}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Domain assignments — workspace-wide mode */}
      {governanceMode === "workspace" && (
        <div className="flex flex-col gap-3">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Authority domains
          </p>
          {AUTHORITY_DOMAINS.map((domain) => (
            <div
              key={domain}
              className="rounded-xl border p-4"
              style={{
                backgroundColor: "var(--color-white)",
                borderColor: "var(--color-warm-gray-200)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                {DOMAIN_LABELS[domain]}
              </p>
              <p
                className="mt-0.5 mb-3 text-xs"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {DOMAIN_DESCRIPTIONS[domain]}
              </p>
              <div className="flex flex-wrap gap-2">
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => updateWorkspaceDomain(domain, member.id)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                    style={{
                      backgroundColor:
                        workspaceConfig.domains[domain] === member.id
                          ? "rgba(2,170,235,0.08)"
                          : "transparent",
                      borderColor:
                        workspaceConfig.domains[domain] === member.id
                          ? "var(--color-brand)"
                          : "var(--color-warm-gray-200)",
                      color:
                        workspaceConfig.domains[domain] === member.id
                          ? "var(--color-brand)"
                          : "var(--color-text-secondary)",
                    }}
                  >
                    {getDisplayName(member)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Guest escalation routing */}
      {governanceMode === "workspace" && (
        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: "var(--color-white)",
            borderColor: "var(--color-warm-gray-200)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Guest escalation routing
          </p>
          <p
            className="mt-0.5 mb-3 text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            When a guest situation requires an owner decision, notify:
          </p>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => toggleWorkspaceEscalation(member.id)}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: workspaceConfig.escalation_owner_ids.includes(member.id)
                    ? "rgba(2,170,235,0.08)"
                    : "transparent",
                  borderColor: workspaceConfig.escalation_owner_ids.includes(member.id)
                    ? "var(--color-brand)"
                    : "var(--color-warm-gray-200)",
                  color: workspaceConfig.escalation_owner_ids.includes(member.id)
                    ? "var(--color-brand)"
                    : "var(--color-text-secondary)",
                }}
              >
                {getDisplayName(member)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Per-property mode note */}
      {governanceMode === "per_property" && (
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Per-property configuration: assign domains and escalation routing for each property
          below. (Full per-property UI follows in a future iteration.)
        </p>
      )}

      {error && (
        <div
          className="flex items-center gap-2 rounded-lg border p-3"
          style={{
            backgroundColor: "rgba(239,68,68,0.06)",
            borderColor: "rgba(239,68,68,0.2)",
          }}
        >
          <WarningCircle size={16} weight="duotone" className="shrink-0 text-red-500" />
          <p className="text-xs" style={{ color: "var(--color-text-primary)" }}>
            {error}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
          style={{
            backgroundColor: "var(--color-warm-gray-100)",
            color: "var(--color-text-primary)",
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending && <Spinner size={14} className="animate-spin" />}
          Save draft
        </button>

        {savedAuthorityId && (
          <button
            type="button"
            onClick={handleSendForSignature}
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{
              backgroundColor: "var(--color-brand)",
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending && <Spinner size={14} className="animate-spin" />}
            Send for signature
          </button>
        )}
      </div>
    </div>
  );
}

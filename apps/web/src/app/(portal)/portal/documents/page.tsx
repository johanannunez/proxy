import type { Metadata } from "next";
import Link from "next/link";
import {
  FileText,
  DownloadSimple,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import { getPortalContext } from "@/lib/portal-context";
import { EmptyState } from "@/components/portal/EmptyState";
import { propertyLabel } from "@/lib/address";
import {
  FORM_REGISTRY,
  computeFormCompletion,
} from "@/lib/forms/form-registry";
import {
  SECURE_DOC_TYPES,
  fmtDate,
  type SecureDocKey,
} from "@/lib/admin/documents-hub-shared";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { saveFormAnswers } from "@/lib/forms/save-form";

export const metadata: Metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

/* Which registry forms appear in each portal group, in display order. */
const FORM_GROUPS: { title: string; description: string; keys: (keyof typeof FORM_REGISTRY)[] }[] = [
  {
    title: "Property setup",
    description: "Everything about the home itself.",
    keys: [
      "setup_basic",
      "setup_access",
      "setup_security",
      "setup_utilities",
      "setup_appliances",
      "setup_contacts",
      "setup_tech",
      "setup_house_rules",
      "setup_amenities",
      "setup_listing",
      "setup_communication",
      "guidebook",
    ],
  },
  {
    title: "Compliance & operations",
    description: "Permits, insurance, platforms, and lifecycle.",
    keys: [
      "str_permit",
      "hoa_info",
      "insurance_certificate",
      "platform_authorization",
      "onboarding_inspection",
      "property_offboarding",
    ],
  },
];

const SECURE_STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  completed: { bg: "rgba(22, 163, 74, 0.12)", fg: "#15803d", label: "Signed" },
  pending: { bg: "rgba(245, 158, 11, 0.14)", fg: "#b45309", label: "Pending" },
  not_sent: { bg: "var(--color-warm-gray-100)", fg: "var(--color-text-tertiary)", label: "Not sent" },
};

type SignedDocRow = {
  id: string;
  template_name: string;
  status: string;
  signed_at: string | null;
  signed_pdf_url: string | null;
  created_at: string;
};

type PropertyRow = {
  id: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const { userId, client } = await getPortalContext();
  const params = await searchParams;

  // 1. Owner's properties
  const { data: properties } = await client
    .from("properties")
    .select("id, address_line1, address_line2, city, state, postal_code")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });

  const propList = (properties ?? []) as PropertyRow[];

  if (propList.length === 0) {
    return (
      <div className="flex flex-col gap-10">
        <EmptyState
          icon={<FileText size={26} weight="duotone" />}
          title="No properties yet"
          body="Once your first property is added, every document and form for it will appear here — ready to view and complete."
        />
      </div>
    );
  }

  // 2. Selected property (from ?property=, else first)
  const selected = propList.find((p) => p.id === params.property) ?? propList[0];

  // 3. Forms for the selected property + signed docs for the owner
  const [formsResult, signedResult] = await Promise.all([
    // property_forms is not in the generated Supabase types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)
      .from("property_forms")
      .select("form_key, data")
      .eq("property_id", selected.id),
    client
      .from("signed_documents")
      .select("id, template_name, status, signed_at, signed_pdf_url, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const formDataByKey = new Map<string, Record<string, unknown>>();
  for (const row of (formsResult.data ?? []) as Array<{ form_key: string; data: unknown }>) {
    formDataByKey.set(row.form_key, (row.data as Record<string, unknown>) ?? {});
  }

  const signedDocs = (signedResult.data ?? []) as SignedDocRow[];

  // Overall form completion across the selected property
  const allKeys = FORM_GROUPS.flatMap((g) => g.keys);
  let totalFilled = 0;
  let totalFields = 0;
  for (const key of allKeys) {
    const c = computeFormCompletion(FORM_REGISTRY[key], formDataByKey.get(key));
    totalFilled += c.filled;
    totalFields += c.total;
  }
  const overallPct = totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0;

  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.14em] sm:text-[12px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Documents
          </span>
          <h1 className="text-[28px] font-semibold tracking-tight sm:text-[34px]" style={{ color: "var(--color-text-primary)" }}>
            Your documents
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Every question for your property — view and update any field at any time. Prefer a guided walkthrough?{" "}
            <Link href="/portal/setup" className="font-medium underline" style={{ color: "var(--color-brand)" }}>
              Complete guided setup
            </Link>
            .
          </p>
        </div>

        {/* Overall completion */}
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: "var(--color-warm-gray-100)", color: "var(--color-text-secondary)" }}
          >
            {overallPct}% of fields complete
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: "var(--color-warm-gray-100)", color: "var(--color-text-secondary)" }}
          >
            {totalFilled} of {totalFields} fields filled
          </span>
        </div>
      </div>

      {/* Property switcher */}
      {propList.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {propList.map((p) => {
            const active = p.id === selected.id;
            return (
              <Link
                key={p.id}
                href={`/portal/documents?property=${p.id}`}
                className="inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors"
                style={{
                  borderColor: active ? "var(--color-text-primary)" : "var(--color-warm-gray-200)",
                  backgroundColor: active ? "var(--color-text-primary)" : "var(--color-white)",
                  color: active ? "var(--color-white)" : "var(--color-text-secondary)",
                }}
              >
                {propertyLabel(p)}
              </Link>
            );
          })}
        </div>
      )}

      {/* Form groups */}
      {FORM_GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--color-text-tertiary)" }}>
              {group.title}
            </h2>
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              {group.description}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {group.keys.map((key) => (
              <DocumentCard
                key={key}
                def={FORM_REGISTRY[key]}
                data={formDataByKey.get(key) ?? {}}
                action={saveFormAnswers}
                hiddenFields={{ form_key: key, property_id: selected.id }}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Signed documents */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--color-text-tertiary)" }}>
            Signed documents
          </h2>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Legal and financial documents handled through secure e-signature.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {(Object.keys(SECURE_DOC_TYPES) as SecureDocKey[]).map((key) => {
            const def = SECURE_DOC_TYPES[key];
            const match = signedDocs.find((d) =>
              def.templateNames.some((n) => n.toLowerCase() === d.template_name.toLowerCase()),
            );
            const status = match
              ? match.status?.toLowerCase() === "completed"
                ? "completed"
                : "pending"
              : "not_sent";
            const style = SECURE_STATUS_STYLE[status];

            return (
              <div
                key={key}
                className="flex items-center gap-4 rounded-2xl border p-5"
                style={{ backgroundColor: "var(--color-white)", borderColor: "var(--color-warm-gray-200)" }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${def.color}18`, color: def.color }}
                >
                  <ShieldCheck size={18} weight="duotone" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    {def.label}
                  </div>
                  <div className="mt-0.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {def.description}
                    {match?.signed_at ? ` · Signed ${fmtDate(match.signed_at)}` : ""}
                  </div>
                </div>
                <span
                  className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: style.bg, color: style.fg }}
                >
                  {style.label}
                </span>
                {match?.signed_pdf_url ? (
                  <a
                    href={match.signed_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--color-warm-gray-50)]"
                    style={{ borderColor: "var(--color-warm-gray-200)", color: "var(--color-text-secondary)" }}
                    aria-label={`Download ${def.label}`}
                  >
                    <DownloadSimple size={16} weight="bold" />
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

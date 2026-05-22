import type { Metadata } from "next";
import { CheckCircle, Clock, FileText, Warning } from "@phosphor-icons/react/dist/ssr";
import { StepShell } from "@/components/portal/setup/StepShell";
import { getPortalContext } from "@/lib/portal-context";
import { getTaxProfile } from "@/lib/tax/w9-storage";
import { formatMedium } from "@/lib/format";
import { W9UploadForm } from "./W9UploadForm";

export const metadata: Metadata = { title: "Tax Form (W-9)" };
export const dynamic = "force-dynamic";

export default async function W9Page({
  searchParams,
}: {
  searchParams?: Promise<{ uploaded?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { userId, client } = await getPortalContext();
  const taxProfile = await getTaxProfile(client, userId);

  const status = taxProfile?.status ?? "incomplete";
  const justUploaded = params.uploaded === "1";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRow } = await (client as any)
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();
  const defaultLegalName =
    taxProfile?.legalName ?? (profileRow?.full_name as string | null) ?? "";

  return (
    <StepShell
      track="owner"
      stepNumber={3}
      title="Tax form (W-9)"
      whyWeAsk="The IRS requires a W-9 from anyone we send more than $600 in a year. We file a 1099 on your behalf."
      estimateMinutes={5}
      lastUpdated={taxProfile?.updatedAt ?? null}
    >
      {status === "verified" ? (
        <StatusPanel
          tone="success"
          icon={<CheckCircle size={28} weight="duotone" />}
          title="W-9 verified"
          body={
            taxProfile?.reviewedAt
              ? `Verified by The Parcel Company on ${formatMedium(taxProfile.reviewedAt)}.`
              : "Verified by The Parcel Company. You are all set for tax season."
          }
        />
      ) : status === "submitted" ? (
        <StatusPanel
          tone="pending"
          icon={<Clock size={28} weight="duotone" />}
          title={justUploaded ? "W-9 received" : "W-9 in review"}
          body={
            justUploaded
              ? "Thanks. We have your form. The Parcel Company will mark it verified within one business day."
              : `Submitted ${
                  taxProfile?.updatedAt ? formatMedium(taxProfile.updatedAt) : "recently"
                }. We will mark it verified within one business day.`
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {status === "rejected" && taxProfile?.rejectionReason ? (
            <div
              className="flex items-start gap-3 rounded-2xl border p-5"
              style={{
                backgroundColor: "rgba(220, 38, 38, 0.04)",
                borderColor: "rgba(220, 38, 38, 0.20)",
              }}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: "rgba(220, 38, 38, 0.10)", color: "#b91c1c" }}
              >
                <Warning size={18} weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  We need a new W-9
                </p>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {taxProfile.rejectionReason}
                </p>
              </div>
            </div>
          ) : null}

          <div
            className="flex items-start gap-4 rounded-2xl border p-6"
            style={{
              backgroundColor: "var(--color-white)",
              borderColor: "var(--color-warm-gray-200)",
            }}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: "rgba(2, 170, 235, 0.10)", color: "var(--color-brand)" }}
            >
              <FileText size={18} weight="duotone" />
            </span>
            <div className="min-w-0 flex-1">
              <h2
                className="text-base font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Upload your completed W-9
              </h2>
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Print the IRS Form W-9, fill it out, and upload it here. We store it in an
                encrypted private bucket. Only you, The Parcel Company compliance team, and
                Parcel admins can read it, and every read is logged.
              </p>
              <a
                href="https://www.irs.gov/pub/irs-pdf/fw9.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-xs font-semibold underline"
                style={{ color: "var(--color-brand)" }}
              >
                Download a blank Form W-9 from IRS.gov
              </a>
            </div>
          </div>

          <W9UploadForm
            defaultLegalName={defaultLegalName}
            ctaLabel={status === "rejected" ? "Submit revised W-9" : "Submit W-9"}
          />
        </div>
      )}
    </StepShell>
  );
}

function StatusPanel({
  tone,
  icon,
  title,
  body,
}: {
  tone: "success" | "pending";
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  const palette =
    tone === "success"
      ? {
          background: "rgba(22, 163, 74, 0.06)",
          border: "rgba(22, 163, 74, 0.22)",
          iconBg: "rgba(22, 163, 74, 0.12)",
          iconFg: "#15803d",
        }
      : {
          background: "rgba(245, 158, 11, 0.06)",
          border: "rgba(245, 158, 11, 0.24)",
          iconBg: "rgba(245, 158, 11, 0.14)",
          iconFg: "#b45309",
        };

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-2xl border p-10 text-center"
      style={{
        backgroundColor: palette.background,
        borderColor: palette.border,
      }}
    >
      <span
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: palette.iconBg, color: palette.iconFg }}
      >
        {icon}
      </span>
      <div>
        <h2
          className="text-lg font-semibold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          {title}
        </h2>
        <p
          className="mt-2 max-w-md text-sm leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}
